import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthField from '../components/general/AuthField';
import Button from '../components/general/Button';
import { login } from '../services/serviceAuth';
import { colors, font, radius, space, tint } from '../theme';

type LoginScreenProps = {
  onSwitchToRegister?: () => void;
};

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Please confirm your email address first.';
  if (message.includes('network') || message.includes('fetch')) return 'Check your internet connection and try again.';
  return 'Something went wrong. Please try again.';
}

export default function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateField(setValue: (value: string) => void, value: string) {
    setValue(value);
    setError('');
  }

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(cleanEmail, password);
    } catch (loginError) {
      setError(authErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <LinearGradient colors={['rgba(33,69,230,0.10)', 'rgba(237,240,245,0)']} style={styles.glow} pointerEvents="none" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Squad<Text style={styles.accent}>dict</Text></Text>
            <Text style={styles.subtitle}>Welcome back to your squad.</Text>
          </View>

          <View style={styles.form}>
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
              placeholder="Enter your password"
              loading={loading}
              password
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
              onSubmit={handleLogin}
            />

            {error ? (
              <View accessibilityRole="alert" style={styles.error}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button title="Sign in" onPress={handleLogin} loading={loading} />

            {onSwitchToRegister ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={onSwitchToRegister} disabled={loading}>
                  <Text style={styles.footerLink}>Sign up</Text>
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
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.sm, backgroundColor: tint.danger },
  errorText: { flex: 1, color: colors.danger, fontFamily: font.medium, fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14 },
  footerLink: { color: colors.accent, fontFamily: font.semi, fontSize: 14 },
});
