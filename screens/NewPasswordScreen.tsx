import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AuthField from '../components/general/AuthField';
import Button from '../components/general/Button';
import TicketShape from '../components/general/TicketShape';
import { AuthHero, authStyles } from '../components/general/AuthTicket';
import { logout, updatePassword } from '../services/serviceAuth';
import { colors, space, textSize, typo } from '../theme';

type NewPasswordScreenProps = {
  // The new password is saved: on to the app.
  onDone: () => void;
};

const MIN_LENGTH = 6;

// Opened from the reset link in the email: the account is signed in for this
// one step, and the new password replaces the old one.
export default function NewPasswordScreen({ onDone }: NewPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorAt, setErrorAt] = useState<'password' | 'confirm'>('password');

  async function save() {
    if (password.length < MIN_LENGTH) {
      setErrorAt('password');
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (confirm !== password) {
      setErrorAt('confirm');
      setError("Passwords don't match.");
      return;
    }

    setError('');
    setLoading(true);
    try {
      await updatePassword(password);
      onDone();
    } catch (problem) {
      const message = problem instanceof Error ? problem.message.toLowerCase() : '';
      setErrorAt('password');
      setError(
        message.includes('different from the old')
          ? 'Pick a password you have not used here before.'
          : message.includes('network') || message.includes('fetch')
            ? 'Check your internet connection and try again.'
            : 'Could not save the new password. Open the link from the email again.',
      );
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
            title="A new password."
            lead="Pick one, and you're straight back in."
            stub={{ kicker: 'Admit one', name: 'You again', line: 'New password' }}
          />

          <View style={styles.card}>
            <TicketShape fill={colors.surface} corner={24} notch={9} notchAt={44} />
            <Text style={styles.title} accessibilityRole="header">
              Set a new password
            </Text>

            <AuthField
              label="New password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError('');
              }}
              placeholder="New password"
              loading={loading}
              password
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
              error={error && errorAt === 'password' ? error : undefined}
              help={{ text: `At least ${MIN_LENGTH} characters`, met: password.length >= MIN_LENGTH }}
            />

            <AuthField
              label="Confirm password"
              value={confirm}
              onChangeText={(value) => {
                setConfirm(value);
                setError('');
              }}
              placeholder="Repeat your password"
              loading={loading}
              password
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
              onSubmit={save}
              error={error && errorAt === 'confirm' ? error : undefined}
            />

            <View style={authStyles.button}>
              <Button title="Save password" onPress={save} loading={loading} />
            </View>

            {/* Not now: signing out drops the one-step session and shows sign in. */}
            <Pressable
              onPress={() => logout().catch(() => {})}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Text style={styles.backText}>Back to sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: -36,
    marginHorizontal: 14,
    paddingHorizontal: 18,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.sm,
  },
  title: { color: colors.text, ...typo.bold, fontSize: textSize.lead, marginBottom: space.sm },
  back: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  backText: { color: colors.primary, ...typo.bold, fontSize: textSize.base, textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
