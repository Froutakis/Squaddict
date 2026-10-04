import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import type { User } from '@supabase/supabase-js';
import RegisterScreen from './screens/RegisterScreen';
import { supabase } from './services/supabaseClient';
import { colors, radius, space, typo, textSize } from './theme';
import { joinByInviteCode } from './services/serviceGroup';
import { inviteCodeFrom } from './lib/invite';
import LoginScreen from './screens/LoginScreen';
import HomeScreen, { type RailData } from './screens/HomeScreen';
import GroupChatScreen from './screens/GroupChatScreen';
import ExploreScreen, { EXPLORE_FAB_DROP } from './screens/ExploreScreen';
import YouScreen from './screens/YouScreen';
import PareaSidebar, { RAIL_CLOSE_MS } from './components/home/PareaSidebar';
import MenuFab from './components/general/MenuFab';
import {
  onPushOpened,
  registerForPush,
  showNotificationsInForeground,
} from './services/serviceNotifications';
import { features } from './lib/features';

showNotificationsInForeground();

// Parea has two faces, both one HomeScreen: its memories (home) and its plans (events).
type Screen = 'home' | 'events' | 'explore' | 'you';

// Things the side rail can ask Parea to open once it is showing.
type HomeAsk = 'plan' | 'calendar' | 'squad';

// An invite opened before signing in waits here until there is someone to join.
const PENDING_INVITE_KEY = 'squaddict.pendingInvite';
const NOTICE_MS = 4000;

const NO_RAIL_DATA: RailData = { squads: [], activeId: null, unread: {}, votes: 0, me: { name: '', avatarUrl: null } };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [screen, setScreen] = useState<Screen>('home');
  const [chatTarget, setChatTarget] = useState<{ groupId: string; nonce: number } | null>(null);
  const [unread, setUnread] = useState(0);
  const [chatClosedNonce, setChatClosedNonce] = useState(0);
  const [focusEventId, setFocusEventId] = useState<string | null>(null);
  const [selectGroup, setSelectGroup] = useState<{ id: string; nonce: number } | null>(null);
  const [createNonce, setCreateNonce] = useState(0);
  const [votesNonce, setVotesNonce] = useState(0);
  const [calendarNonce, setCalendarNonce] = useState(0);
  const [newSquadNonce, setNewSquadNonce] = useState(0);
  const [railOpen, setRailOpen] = useState(false);
  // Parea keeps this up to date; the rail shows it on every screen.
  const [railData, setRailData] = useState<RailData>(NO_RAIL_DATA);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped to load Parea afresh, e.g. after joining a new squad.
  const [homeKey, setHomeKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    registerForPush().catch((problem) => {
      console.warn('[squaddict] push registration failed:', problem);
    });
  }, [user?.id]);

  useEffect(() => {
    return onPushOpened(function (target) {
      if (target.type === 'message') {
        setChatTarget({ groupId: target.groupId, nonce: Date.now() });
        setScreen('home');
      } else if (target.type === 'votes') {
        setSelectGroup({ id: target.groupId, nonce: Date.now() });
        setVotesNonce((n) => n + 1);
        setScreen('home');
      } else {
        setFocusEventId(target.eventId);
        setScreen('events');
      }
    });
  }, []);

  // Invite links: squaddict://join/CODE in the app, /join/CODE on the web.
  useEffect(() => {
    function take(url: string | null) {
      const code = inviteCodeFrom(url);
      if (!code) return;

      setPendingInvite(code);
      AsyncStorage.setItem(PENDING_INVITE_KEY, code).catch(() => {});
      // Leave /join/CODE behind, so a reload doesn't join again.
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', '/');
    }

    Linking.getInitialURL().then(take).catch(() => {});
    AsyncStorage.getItem(PENDING_INVITE_KEY)
      .then((code) => {
        if (code) setPendingInvite((current) => current ?? code);
      })
      .catch(() => {});

    const sub = Linking.addEventListener('url', ({ url }) => take(url));
    return () => sub.remove();
  }, []);

  // Join as soon as someone is signed in: right away, or after login or sign up.
  useEffect(() => {
    if (!user || !pendingInvite) return;

    const code = pendingInvite;
    setPendingInvite(null);
    AsyncStorage.removeItem(PENDING_INVITE_KEY).catch(() => {});

    joinByInviteCode(code)
      .then(function (group) {
        setCreateNonce(0);
        setCalendarNonce(0);
        setNewSquadNonce(0);
        setSelectGroup({ id: group.id, nonce: Date.now() });
        setScreen('home');
        setHomeKey((n) => n + 1);
        setNotice(`You're in ${group.name}.`);
      })
      .catch(function (problem) {
        setNotice(problem instanceof Error ? problem.message : 'That invite did not work.');
      });
  }, [user?.id, pendingInvite]);

  useEffect(() => {
    if (!notice) return;
    const hide = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(hide);
  }, [notice]);

  if (checkingSession) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

  if (!user) {
    return authScreen === 'login' ? (
      <LoginScreen onSwitchToRegister={() => setAuthScreen('register')} />
    ) : (
      <RegisterScreen onSwitchToLogin={() => setAuthScreen('login')} />
    );
  }

  function closeChat() {
    setChatTarget(null);
    setChatClosedNonce((n) => n + 1);
  }

  // Back to Parea, maybe with something to open there. Plans and the calendar
  // open on the plans face, a new squad on the memories face, and with no ask
  // Parea keeps whichever face it was on. An ask made on another screen must
  // not replay the next time Parea mounts, so those counters start over
  // whenever Parea is coming back.
  function goHome(ask?: HomeAsk) {
    const onParea = screen === 'home' || screen === 'events';
    if (!onParea) {
      setCreateNonce(0);
      setCalendarNonce(0);
      setNewSquadNonce(0);
      setVotesNonce(0);
    }
    if (ask === 'plan' || ask === 'calendar') setScreen('events');
    else if (ask === 'squad' || !onParea) setScreen('home');
    if (ask === 'plan') setCreateNonce((n) => n + 1);
    if (ask === 'calendar') setCalendarNonce((n) => n + 1);
    if (ask === 'squad') setNewSquadNonce((n) => n + 1);
  }

  // Every vote starts on the Votes page, so buttons elsewhere that would have
  // opened one bring you here instead. groupId is the squad deciding; without
  // it, Parea's current squad.
  function openVotes(groupId?: string) {
    if (chatTarget) closeChat();
    if (groupId) setSelectGroup({ id: groupId, nonce: Date.now() });
    goHome();
    setVotesNonce((n) => n + 1);
  }

  // Sheets wait for the rail to finish sliding away (iOS can't stack them).
  function afterRail(open: () => void) {
    setRailOpen(false);
    setTimeout(open, RAIL_CLOSE_MS);
  }

  return (
    <View style={styles.app}>
      <View style={styles.body}>
        {screen === 'explore' && features.explore ? (
          <ExploreScreen userId={user.id} onOpenVotes={openVotes} />
        ) : screen === 'you' ? (
          <YouScreen user={user} onPlan={() => goHome('plan')} onOpenVotes={openVotes} />
        ) : (
          <HomeScreen
            key={`home-${homeKey}`}
            user={user}
            focusEventId={focusEventId}
            onFocusHandled={() => setFocusEventId(null)}
            onOpenChat={(groupId) => setChatTarget({ groupId, nonce: Date.now() })}
            chatClosedNonce={chatClosedNonce}
            onUnreadChange={setUnread}
            selectGroup={selectGroup}
            createNonce={createNonce}
            openVotesNonce={votesNonce}
            calendarNonce={calendarNonce}
            newSquadNonce={newSquadNonce}
            onOpenRail={() => setRailOpen(true)}
            view={screen === 'events' ? 'events' : 'memories'}
            onOpenEvents={() => setScreen('events')}
            onRailData={setRailData}
          />
        )}

        {/* A squad's chat opens on top of Parea, which stays put underneath. */}
        {chatTarget ? (
          <View style={styles.overlay}>
            <GroupChatScreen
              key={`chat-${chatTarget.nonce}`}
              user={user}
              initialGroupId={chatTarget.groupId}
              onExit={closeChat}
              onOpenVotes={openVotes}
            />
          </View>
        ) : null}
      </View>

      {/* The side rail is the only menu, so its button floats over every screen. */}
      {chatTarget ? null : <MenuFab unread={unread} drop={screen === 'explore' ? EXPLORE_FAB_DROP : 0} onPress={() => setRailOpen(true)} />}

      <PareaSidebar
        visible={railOpen}
        squads={railData.squads}
        activeId={railData.activeId}
        unread={railData.unread}
        me={railData.me}
        current={screen}
        onSelectSquad={(id) => {
          setRailOpen(false);
          setSelectGroup({ id, nonce: Date.now() });
          goHome();
        }}
        onNewSquad={() => afterRail(() => goHome('squad'))}
        onChat={() => {
          setRailOpen(false);
          if (railData.activeId) setChatTarget({ groupId: railData.activeId, nonce: Date.now() });
        }}
        onPlan={() => afterRail(() => goHome('plan'))}
        onHome={() => {
          setRailOpen(false);
          goHome();
          setScreen('home');
        }}
        onEvents={() => {
          setRailOpen(false);
          goHome();
          setScreen('events');
        }}
        votes={railData.votes}
        onVotes={() =>
          afterRail(() => {
            goHome();
            setVotesNonce((n) => n + 1);
          })
        }
        onCalendar={() => {
          setRailOpen(false);
          // A page, not a sheet, so it can open while the rail slides away.
          goHome('calendar');
        }}
        onExplore={() => {
          setRailOpen(false);
          setScreen('explore');
        }}
        onYou={() => {
          setRailOpen(false);
          setScreen('you');
        }}
        onClose={() => setRailOpen(false)}
      />
      {notice ? (
        <Pressable
          onPress={() => setNotice(null)}
          accessibilityRole="button"
          accessibilityLabel={`${notice} Dismiss`}
          accessibilityLiveRegion="polite"
          style={styles.notice}
        >
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
  app: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg },
  notice: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.xl,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  noticeText: { color: colors.onInk, ...typo.semi, fontSize: textSize.base, textAlign: 'center' },
});
