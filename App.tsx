import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './services/supabaseClient';

export default function App() {
  // null = δεν υπάρχει συνδεδεμένος χρήστης
  const [user, setUser] = useState<any>(null);

  // true όσο ρωτάμε τη Supabase αν υπάρχει αποθηκευμένο session
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Υπάρχει ήδη session από προηγούμενη φορά;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecking(false);
    });

    // Μόνιμη συνδρομή: κάθε login / logout / ανανέωση token μας ειδοποιεί.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Squaddict</Text>

      {user ? (
        <Text style={styles.sub}>Συνδεδεμένος ως {user.email}</Text>
      ) : (
        <Text style={styles.sub}>Κανένας συνδεδεμένος χρήστης</Text>
      )}

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111111' },
  sub: { fontSize: 14, color: '#666666' },
});
