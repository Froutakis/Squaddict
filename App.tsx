import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { User } from '@supabase/supabase-js';
import RegisterScreen from './screens/RegisterScreen';
import { supabase } from './services/supabaseClient';
import { colors } from './theme';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import GroupChatScreen from './screens/GroupChatScreen';
import ExploreScreen from './screens/ExploreScreen';
import YouScreen from './screens/YouScreen';
import BottomNav, { type NavTab } from './components/general/BottomNav';
import {
  onPushOpened,
  registerForPush,
  showNotificationsInForeground,
} from './services/serviceNotifications';

showNotificationsInForeground();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [screen, setScreen] = useState<NavTab>('home');
  const [chatTarget, setChatTarget] = useState<{ groupId: string; nonce: number } | null>(null);
  const [unread, setUnread] = useState(0);
  const [chatClosedNonce, setChatClosedNonce] = useState(0);
  const [focusEventId, setFocusEventId] = useState<string | null>(null);
  const [selectGroup, setSelectGroup] = useState<{ id: string; nonce: number } | null>(null);
  const [createNonce, setCreateNonce] = useState(0);

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
      } else {
        setFocusEventId(target.eventId);
        setScreen('home');
      }
    });
  }, []);

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

  return (
    <View style={styles.app}>
      <View style={styles.body}>
        {screen === 'explore' ? (
          <ExploreScreen userId={user.id} />
        ) : screen === 'you' ? (
          <YouScreen
            user={user}
            onOpenParea={(groupId) => {
              setSelectGroup({ id: groupId, nonce: Date.now() });
              setScreen('home');
            }}
            onPlan={() => {
              setCreateNonce((n) => n + 1);
              setScreen('home');
            }}
          />
        ) : (
          <HomeScreen
            user={user}
            focusEventId={focusEventId}
            onFocusHandled={() => setFocusEventId(null)}
            onOpenChat={(groupId) => setChatTarget({ groupId, nonce: Date.now() })}
            chatClosedNonce={chatClosedNonce}
            onUnreadChange={setUnread}
            selectGroup={selectGroup}
            createNonce={createNonce}
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
            />
          </View>
        ) : null}
      </View>

      {chatTarget ? null : (
        <BottomNav
          active={screen}
          onNavigate={(tab) => {
            // One-off requests from another tab must not replay when Parea remounts.
            setCreateNonce(0);
            setSelectGroup(null);
            setScreen(tab);
          }}
          badges={{ home: unread }}
        />
      )}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
  app: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg },
});
