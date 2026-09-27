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
  const [threadOpen, setThreadOpen] = useState(false);
  const [createNonce, setCreateNonce] = useState(0);
  const [chatTarget, setChatTarget] = useState<{ groupId: string; nonce: number } | null>(null);
  const [focusEventId, setFocusEventId] = useState<string | null>(null);

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
        setScreen('groups');
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

  function requestCreate() {
    setScreen('home');
    setCreateNonce((n) => n + 1);
  }

  function navigate(tab: NavTab) {
    setCreateNonce(0);
    setScreen(tab);
  }

  const navHidden = screen === 'groups' && threadOpen;

  return (
    <View style={styles.app}>
      <View style={styles.body}>
        {screen === 'groups' ? (
          <GroupChatScreen
            key={chatTarget ? `chat-${chatTarget.nonce}` : 'chat'}
            user={user}
            initialGroupId={chatTarget?.groupId ?? null}
            onThreadChange={setThreadOpen}
          />
        ) : screen === 'explore' ? (
          <ExploreScreen userId={user.id} />
        ) : screen === 'you' ? (
          <YouScreen user={user} />
        ) : (
          <HomeScreen
            user={user}
            createNonce={createNonce}
            focusEventId={focusEventId}
            onFocusHandled={() => setFocusEventId(null)}
            onOpenChat={(groupId) => {
              setChatTarget({ groupId, nonce: Date.now() });
              setScreen('groups');
            }}
          />
        )}
      </View>

      {navHidden ? null : (
        <BottomNav active={screen} onNavigate={navigate} onCreate={requestCreate} />
      )}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
  app: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
