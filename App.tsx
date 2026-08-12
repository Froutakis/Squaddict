import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold, useFonts } from '@expo-google-fonts/poppins';
import type { User } from '@supabase/supabase-js';
import LoginScreen from './screens/LoginScreen';
import { supabase } from './services/supabaseClient';
import { colors, font } from './theme';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [fontsLoaded] = useFonts({ Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold });

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

  if (checkingSession || !fontsLoaded) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><StatusBar style="dark" /></View>;
  }

  if (!user) return <LoginScreen />;

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Squaddict</Text>
      <Text style={styles.subtitle}>Συνδεδεμένος ως {user.email}</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: colors.text, fontFamily: font.bold, fontSize: 26 },
  subtitle: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
});
