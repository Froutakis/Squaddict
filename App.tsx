import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, useFonts } from '@expo-google-fonts/poppins';
import {
  Commissioner_400Regular,
  Commissioner_500Medium,
  Commissioner_600SemiBold,
} from '@expo-google-fonts/commissioner';
import { AlegreyaSans_700Bold } from '@expo-google-fonts/alegreya-sans';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono';
import type { User } from '@supabase/supabase-js';
import RegisterScreen from './screens/RegisterScreen';
import { supabase } from './services/supabaseClient';
import { colors } from './theme';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import GroupChatScreen from './screens/GroupChatScreen';
import ExploreScreen from './screens/ExploreScreen';
import BottomNav, { type NavTab } from './components/general/BottomNav';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [screen, setScreen] = useState<NavTab>('home');
  const [threadOpen, setThreadOpen] = useState(false);
  const [createNonce, setCreateNonce] = useState(0);
  const [fontsLoaded, fontError] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Commissioner_400Regular,
    Commissioner_500Medium,
    Commissioner_600SemiBold,
    AlegreyaSans_700Bold,
    DMMono_400Regular,
  });

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

  if (checkingSession || (!fontsLoaded && !fontError)) {
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
          <GroupChatScreen user={user} onThreadChange={setThreadOpen} />
        ) : screen === 'explore' ? (
          <ExploreScreen />
        ) : (
          <HomeScreen user={user} createNonce={createNonce} />
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
