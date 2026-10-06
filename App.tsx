import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import type { User } from '@supabase/supabase-js';
import RegisterScreen from './screens/RegisterScreen';
import { supabase } from './services/supabaseClient';
import { colors, radius, space, typo, textSize } from './theme';
import { joinByInviteCode } from './services/serviceGroup';
import { forgetBlocks, loadBlocks } from './services/serviceSafety';
import { inviteCodeFrom } from './lib/invite';
import LoginScreen from './screens/LoginScreen';
import NewPasswordScreen from './screens/NewPasswordScreen';
import HomeScreen, { type HomeOverlay, type RailData } from './screens/HomeScreen';
import GroupChatScreen from './screens/GroupChatScreen';
import ChatSlide from './components/chat/ChatSlide';
import ExploreScreen, { EXPLORE_FAB_DROP } from './screens/ExploreScreen';
import YouScreen from './screens/YouScreen';
import PareaSidebar, { RAIL_CLOSE_MS, type RailScreen } from './components/home/PareaSidebar';
import MenuFab from './components/general/MenuFab';
import {
  onPushOpened,
  registerForPush,
  showNotificationsInForeground,
} from './services/serviceNotifications';
import { features } from './lib/features';
import type { VoteStart } from './components/votes/NewVoteSheet';

showNotificationsInForeground();

// Parea is Home: its plans above NOW and its memories below, one HomeScreen.
type Screen = 'home' | 'explore' | 'you';

// Things the side rail can ask Parea to open once it is showing.
type HomeAsk = 'plan' | 'calendar' | 'squad';

// An invite opened before signing in waits here until there is someone to join.
const PENDING_INVITE_KEY = 'squaddict.pendingInvite';
const NOTICE_MS = 4000;

// On the web, a reset link lands with #...type=recovery. Read it now, before the
// client tidies the address, in case PASSWORD_RECOVERY fired before we listened.
const OPENED_FOR_RECOVERY =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

const NO_RAIL_DATA: RailData = { squads: [], activeId: null, unread: {}, votes: 0, me: { name: '', avatarUrl: null } };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  // Signed in from a reset-password link: a new password comes first.
  const [recovering, setRecovering] = useState(OPENED_FOR_RECOVERY);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [screen, setScreen] = useState<Screen>('home');
  // The chat open on top of it all; 'votes' opens it on its Votes tab, and
  // start opens the new-vote sheet there too (Invite, Follow).
  const [chatTarget, setChatTarget] = useState<{
    groupId: string;
    nonce: number;
    filter?: 'all' | 'votes';
    start?: VoteStart;
  } | null>(null);
  const [unread, setUnread] = useState(0);
  const [chatClosedNonce, setChatClosedNonce] = useState(0);
  const [focusEventId, setFocusEventId] = useState<string | null>(null);
  const [selectGroup, setSelectGroup] = useState<{ id: string; nonce: number } | null>(null);
  const [createNonce, setCreateNonce] = useState(0);
  const [calendarNonce, setCalendarNonce] = useState(0);
  const [railHomeNonce, setRailHomeNonce] = useState(0);
  const [newSquadNonce, setNewSquadNonce] = useState(0);
  const [railOpen, setRailOpen] = useState(false);
  // Parea keeps this up to date; the rail shows it on every screen.
  const [railData, setRailData] = useState<RailData>(NO_RAIL_DATA);
  // The page open on top of Parea, which the rail marks as the screen you are on.
  const [homeOverlay, setHomeOverlay] = useState<HomeOverlay>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped to load Parea afresh, e.g. after joining a new squad.
  const [homeKey, setHomeKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') {
        setRecovering(false);
        forgetBlocks();
      }
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    loadBlocks().catch(() => {});
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
        setChatTarget({ groupId: target.groupId, nonce: Date.now(), filter: 'votes' });
        setScreen('home');
      } else {
        setFocusEventId(target.eventId);
        setScreen('home');
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

  if (recovering) {
    return (
      <NewPasswordScreen
        onDone={() => {
          setRecovering(false);
          setNotice('Your new password is saved.');
        }}
      />
    );
  }

  function closeChat() {
    setChatTarget(null);
    setChatClosedNonce((n) => n + 1);
  }

  // Back to Parea, maybe with something to open there (a new plan, the
  // calendar, a new squad). An ask made on another screen must not replay the
  // next time Parea mounts, so those counters start over whenever Parea is
  // coming back.
  function goHome(ask?: HomeAsk) {
    if (screen !== 'home') {
      setCreateNonce(0);
      setCalendarNonce(0);
      setNewSquadNonce(0);
      setScreen('home');
    }
    if (ask === 'plan') setCreateNonce((n) => n + 1);
    if (ask === 'calendar') setCalendarNonce((n) => n + 1);
    if (ask === 'squad') setNewSquadNonce((n) => n + 1);
  }

  // Votes live in the parea's chat: buttons elsewhere that would open one
  // open that chat on its Votes tab. groupId is the parea deciding; without
  // it, the current one. With start, the chat opens that new vote right away.
  function openVotes(groupId?: string, start?: VoteStart) {
    const id = groupId ?? railData.activeId;
    if (!id) return;
    if (groupId) setSelectGroup({ id: groupId, nonce: Date.now() });
    setChatTarget({ groupId: id, nonce: Date.now(), filter: 'votes', start });
  }

  // Sheets wait for the rail to finish sliding away (iOS can't stack them).
  function afterRail(open: () => void) {
    setRailOpen(false);
    setTimeout(open, RAIL_CLOSE_MS);
  }

  // Going anywhere from the rail leaves the chat, which sits on top of it all.
  function leaveChat() {
    if (chatTarget) closeChat();
  }

  const onParea = screen === 'home';
  // Where you are, as the rail marks it: a page on top wins over the screen under it.
  const current: RailScreen = chatTarget
    ? 'chat'
    : onParea && homeOverlay === 'calendar'
      ? homeOverlay
      : screen;
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
            onOpenVotes={openVotes}
            calendarNonce={calendarNonce}
            railHomeNonce={railHomeNonce}
            newSquadNonce={newSquadNonce}
            onOpenRail={() => setRailOpen(true)}
            onRailData={setRailData}
            onOverlayChange={setHomeOverlay}
          />
        )}

        {/* A squad's chat slides in on top of Parea, which stays put underneath.
            Its back button (and Android's, and Esc) closes it again. */}
        {chatTarget ? (
          <ChatSlide onClosed={closeChat}>
            {(close) => (
              <GroupChatScreen
                key={`chat-${chatTarget.nonce}`}
                user={user}
                initialGroupId={chatTarget.groupId}
                initialFilter={chatTarget.filter}
                initialVoteStart={chatTarget.start}
                onExit={close}
                onNewPlan={(groupId) => {
                  closeChat();
                  setSelectGroup({ id: groupId, nonce: Date.now() });
                  goHome('plan');
                }}
              />
            )}
          </ChatSlide>
        ) : null}

      </View>

      {/* The side rail is the only menu, so its button floats over every screen
          (the chat has a back button in its place). */}
      {chatTarget ? null : <MenuFab unread={unread} drop={screen === 'explore' ? EXPLORE_FAB_DROP : 0} onPress={() => setRailOpen(true)} />}

      <PareaSidebar
        visible={railOpen}
        squads={railData.squads}
        activeId={railData.activeId}
        unread={railData.unread}
        me={railData.me}
        current={current}
        onSelectSquad={(id) => {
          setRailOpen(false);
          setSelectGroup({ id, nonce: Date.now() });
          // In the chat, switching parea switches the chat too.
          if (chatTarget) setChatTarget({ groupId: id, nonce: Date.now() });
          goHome();
        }}
        onNewSquad={() => {
          leaveChat();
          afterRail(() => goHome('squad'));
        }}
        onChat={() => {
          setRailOpen(false);
          if (railData.activeId) setChatTarget({ groupId: railData.activeId, nonce: Date.now() });
        }}
        onPlan={() => {
          leaveChat();
          afterRail(() => goHome('plan'));
        }}
        onHome={() => {
          setRailOpen(false);
          leaveChat();
          goHome();
          setRailHomeNonce((n) => n + 1);
        }}
        votes={railData.votes}
        onCalendar={() => {
          setRailOpen(false);
          leaveChat();
          // A page, not a sheet, so it can open while the rail slides away.
          goHome('calendar');
          setRailHomeNonce((n) => n + 1);
        }}
        onExplore={() => {
          setRailOpen(false);
          leaveChat();
          setScreen('explore');
        }}
        onYou={() => {
          setRailOpen(false);
          leaveChat();
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
