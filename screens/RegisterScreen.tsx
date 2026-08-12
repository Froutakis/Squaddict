import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthField from '../components/AuthField';
import Button from '../components/Button';
import { register } from '../services/serviceAuth';
import { colors, font, radius, space } from '../theme';

type RegisterScreenProps = {
  onSwitchToLogin?: () => void;
};

// Μετατρέπει τα τεχνικά μηνύματα του Supabase σε φιλικά μηνύματα για τον χρήστη.
function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('already registered') || message.includes('already exists') || message.includes('already in use')) {
    return 'This email is already in use. Try signing in instead.';
  }
  if (message.includes('valid email') || message.includes('invalid email')) return 'Enter a valid email address.';
  if (message.includes('password')) return 'Password must be at least 6 characters.';
  if (message.includes('network') || message.includes('fetch')) return 'Check your internet connection and try again.';
  return 'Something went wrong. Please try again.';
}

export default function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Καθαρίζει το προηγούμενο σφάλμα κάθε φορά που αλλάζει ένα πεδίο.
  function updateField(setValue: (value: string) => void, value: string) {
    setValue(value);
    setError('');
  }

  // Ελέγχει τα στοιχεία, δημιουργεί λογαριασμό και αφήνει το auth listener του App να αλλάξει οθόνη.
  async function handleRegister() {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await register(cleanEmail, password, cleanName);
      // Επιτυχία: το onAuthStateChange στο App.tsx κάνει auto-login και αλλάζει οθόνη.
    } catch (registerError) {
      setError(authErrorMessage(registerError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <LinearGradient colors={['rgba(231,104,84,0.15)', 'rgba(255,248,244,0)']} style={styles.glow} pointerEvents="none" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Squad<Text style={styles.accent}>dict</Text></Text>
            <Text style={styles.subtitle}>Create your account and find your squad.</Text>
          </View>

          <View style={styles.form}>
            <AuthField
              label="Name"
              icon="person-outline"
              value={name}
              onChangeText={(value) => updateField(setName, value)}
              placeholder="Your name"
              loading={loading}
            />

            <AuthField
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={(value) => updateField(setEmail, value)}
              placeholder="name@example.com"
              loading={loading}
            />

            <AuthField
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={(value) => updateField(setPassword, value)}
              placeholder="At least 6 characters"
              loading={loading}
              password
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
            />

            <AuthField
              label="Confirm password"
              icon="lock-closed-outline"
              value={confirmPassword}
              onChangeText={(value) => updateField(setConfirmPassword, value)}
              placeholder="Repeat your password"
              loading={loading}
              password
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
              onSubmit={handleRegister}
            />

            {error ? (
              <View accessibilityRole="alert" style={styles.error}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button title="Sign up" onPress={handleRegister} loading={loading} />

            {onSwitchToLogin ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={onSwitchToLogin} disabled={loading}>
                  <Text style={styles.footerLink}>Sign in</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  content: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: space.xl },
  header: { alignItems: 'center', marginBottom: 36 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 42, letterSpacing: -1.5 },
  accent: { color: colors.accent, fontFamily: font.display },
  subtitle: { marginTop: space.xs, color: colors.textSoft, fontFamily: font.medium, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  form: { gap: 20 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.sm, backgroundColor: '#FFF0EE' },
  errorText: { flex: 1, color: colors.danger, fontFamily: font.medium, fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
  footerLink: { color: colors.accent, fontFamily: font.semi, fontSize: 14 },
});
