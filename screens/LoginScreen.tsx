import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthField from '../components/general/AuthField';
import Button from '../components/general/Button';
import { AuthCard, AuthHero, AuthSwitch, authStyles } from '../components/general/AuthTicket';
import { login, sendPasswordReset } from '../services/serviceAuth';
import { colors, radius, space, textSize, tint, typo } from '../theme';

type LoginScreenProps = {
  onSwitchToRegister?: () => void;
};

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Confirm your email address first.';
  if (message.includes('network') || message.includes('fetch')) return 'Check your internet connection and try again.';
  return "That didn't work. Try again.";
}

export default function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Which field the error belongs under.
  const [errorAt, setErrorAt] = useState<'email' | 'password'>('password');
  // Where the reset link went, once it has been sent.
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  function updateField(setValue: (value: string) => void, value: string) {
    setValue(value);
    setError('');
    setResetSentTo(null);
  }

  // Forgot password: a link to set a new one goes to the email typed above.
  async function handleForgot() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorAt('email');
      setError("Enter your email, and we'll send you a link to set a new password.");
      return;
    }

    setError('');
    setSendingReset(true);
    try {
      await sendPasswordReset(cleanEmail);
      setResetSentTo(cleanEmail);
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message.toLowerCase() : '';
      setErrorAt('email');
      setError(
        message.includes('rate') || message.includes('seconds')
          ? 'A link was sent a moment ago. Wait a minute and try again.'
          : authErrorMessage(resetError),
      );
    } finally {
      setSendingReset(false);
    }
  }

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorAt(cleanEmail ? 'password' : 'email');
      setError('Enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(cleanEmail, password);
    } catch (loginError) {
      setErrorAt('password');
      setError(authErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={authStyles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={authStyles.grow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={authStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero
            title="Welcome back."
            lead="Your parea's plans are where you left them."
            stub={{ kicker: 'Tonight', name: 'Ladadika', line: '22:00, 4 going' }}
          />

          <AuthCard mode="signin" onSwitch={onSwitchToRegister} busy={loading}>
            <AuthField
              label="Email"
              value={email}
              onChangeText={(value) => updateField(setEmail, value)}
              placeholder="name@example.com"
              loading={loading}
              email
              error={error && errorAt === 'email' ? error : undefined}
            />

            <AuthField
              label="Password"
              value={password}
              onChangeText={(value) => updateField(setPassword, value)}
              placeholder="Enter your password"
              loading={loading}
              password
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
              onSubmit={handleLogin}
              error={error && errorAt === 'password' ? error : undefined}
            />

            <Pressable
              onPress={handleForgot}
              disabled={loading || sendingReset}
              accessibilityRole="button"
              accessibilityLabel="Forgot password? Email me a link to set a new one"
              style={({ pressed }) => [styles.forgot, pressed && styles.pressed]}
            >
              <Text style={styles.forgotText}>{sendingReset ? 'Sending…' : 'Forgot password?'}</Text>
            </Pressable>

            {resetSentTo ? (
              <Text style={styles.sent} accessibilityLiveRegion="polite">
                We sent a link to {resetSentTo}. Open it to set a new password.
              </Text>
            ) : null}

            <View style={authStyles.button}>
              <Button title="Sign in" onPress={handleLogin} loading={loading} />
            </View>
          </AuthCard>

          <View style={authStyles.grow} />
          <AuthSwitch text="Don't have an account?" action="Sign up" onPress={onSwitchToRegister} busy={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', minHeight: 44, marginTop: -6, justifyContent: 'center' },
  forgotText: { color: colors.primary, ...typo.bold, fontSize: textSize.body },
  sent: {
    color: colors.success,
    ...typo.medium,
    fontSize: textSize.body,
    lineHeight: 19,
    marginBottom: space.xs,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: tint.success,
  },
  pressed: { opacity: 0.6 },
});
