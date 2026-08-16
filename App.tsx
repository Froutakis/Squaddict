import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, useFonts } from '@expo-google-fonts/poppins';
import type { User } from '@supabase/supabase-js';
import RegisterScreen from './screens/RegisterScreen';
import { supabase } from './services/supabaseClient';
import { colors } from './theme';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [fontsLoaded, fontError] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
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

  if (!user) 
    return authScreen === 'login' ? (
      <LoginScreen onSwitchToRegister={() => setAuthScreen('register')} />
    ) : (
      <RegisterScreen onSwitchToLogin={() => setAuthScreen('login')} />
    );
  

  return <HomeScreen user={user} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
