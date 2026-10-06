import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthField from '../components/general/AuthField';
import Button from '../components/general/Button';
import { AuthCard, AuthHero, AuthSwitch, authStyles } from '../components/general/AuthTicket';
import { login } from '../services/serviceAuth';

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
  // Which field the error belongs under.
  const [errorAt, setErrorAt] = useState<'email' | 'password'>('password');

  function updateField(setValue: (value: string) => void, value: string) {
    setValue(value);
    setError('');
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
            lead="Your squad's plans are where you left them."
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
