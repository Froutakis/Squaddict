import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthField from '../components/general/AuthField';
import Button from '../components/general/Button';
import { AuthCard, AuthHero, AuthSwitch, authStyles } from '../components/general/AuthTicket';
import { register } from '../services/serviceAuth';
import { PRIVACY_URL, TERMS_URL } from '../lib/config';
import { colors, space, textSize, typo } from '../theme';

type RegisterScreenProps = {
  onSwitchToLogin?: () => void;
};

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('already registered') || message.includes('already exists') || message.includes('already in use')) {
    return 'This email is already in use. Try signing in instead.';
  }
  if (message.includes('valid email') || message.includes('invalid email')) return 'Enter a valid email address.';
  if (message.includes('password')) return 'Password must be at least 6 characters.';
  if (message.includes('network') || message.includes('fetch')) return 'Check your internet connection and try again.';
  return "That didn't work. Try again.";
}

type Field = 'name' | 'email' | 'password' | 'confirm';

export default function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Which field the error belongs under.
  const [errorAt, setErrorAt] = useState<Field>('name');

  function updateField(setValue: (value: string) => void, value: string) {
    setValue(value);
    setError('');
  }

  function fail(at: Field, message: string) {
    setErrorAt(at);
    setError(message);
  }

  async function handleRegister() {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      fail(!cleanName ? 'name' : !cleanEmail ? 'email' : !password ? 'password' : 'confirm', 'Fill in all fields.');
      return;
    }
    if (password.length < 6) {
      fail('password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      fail('confirm', 'Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await register(cleanEmail, password, cleanName);
    } catch (registerError) {
      const message = authErrorMessage(registerError);
      fail(message.toLowerCase().includes('email') ? 'email' : message.startsWith('Password') ? 'password' : 'confirm', message);
    } finally {
      setLoading(false);
    }
  }

  const errorFor = (field: Field) => (error && errorAt === field ? error : undefined);

  return (
    <SafeAreaView style={authStyles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={authStyles.grow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={authStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* The stub writes your name as you type it. */}
          <AuthHero short title="Find your parea." stub={{ kicker: 'Admit one', name: name.trim() || 'You', line: 'New member' }} />

          <AuthCard mode="signup" onSwitch={onSwitchToLogin} busy={loading}>
            <AuthField
              label="Name"
              value={name}
              onChangeText={(value) => updateField(setName, value)}
              placeholder="Your name"
              loading={loading}
              error={errorFor('name')}
            />

            <AuthField
              label="Email"
              value={email}
              onChangeText={(value) => updateField(setEmail, value)}
              placeholder="name@example.com"
              loading={loading}
              email
              error={errorFor('email')}
            />

            <AuthField
              label="Password"
              value={password}
              onChangeText={(value) => updateField(setPassword, value)}
              placeholder="At least 6 characters"
              loading={loading}
              password
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
              error={errorFor('password')}
              help={{ text: 'At least 6 characters', met: password.length >= 6 }}
            />

            <AuthField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(value) => updateField(setConfirmPassword, value)}
              placeholder="Repeat your password"
              loading={loading}
              password
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
              onSubmit={handleRegister}
              error={errorFor('confirm')}
            />

            <View style={authStyles.button}>
              <Button title="Sign up" onPress={handleRegister} loading={loading} />
            </View>

            <Text style={styles.agree}>
              By signing up you agree to the{' '}
              <Text style={styles.agreeLink} accessibilityRole="link" onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}>
                Terms of use
              </Text>{' '}
              and the{' '}
              <Text style={styles.agreeLink} accessibilityRole="link" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>
                Privacy policy
              </Text>
              .
            </Text>
          </AuthCard>

          <View style={authStyles.grow} />
          <AuthSwitch text="Already have an account?" action="Sign in" onPress={onSwitchToLogin} busy={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  agree: { color: colors.textSoft, ...typo.medium, fontSize: textSize.body, lineHeight: 22, textAlign: 'center', marginTop: space.sm },
  agreeLink: { color: colors.primary, ...typo.bold },
});
