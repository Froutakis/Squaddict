import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Button from '../components/Button';
import { login } from '../services/serviceAuth';
import { colors, font, radius, space } from '../theme';

type AuthFieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  loading: boolean;
  password?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  onSubmit?: () => void;
};

// Κοινό πεδίο φόρμας για να χρησιμοποιείται σε login, register και άλλες auth οθόνες.
function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  loading,
  password = false,
  showPassword = false,
  onTogglePassword,
  onSubmit,
}: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <Ionicons name={icon} size={20} color={colors.textSoft} />
        <TextInput
          accessibilityLabel={label}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          keyboardType={password ? 'default' : 'email-address'}
          secureTextEntry={password && !showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={password ? 'password' : 'email'}
          editable={!loading}
          returnKeyType={password ? 'go' : 'next'}
          onSubmitEditing={onSubmit}
          selectionColor={colors.primary}
        />
        {password && onTogglePassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={10}
            onPress={onTogglePassword}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSoft} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Μετατρέπει τα τεχνικά μηνύματα του Supabase σε φιλικά μηνύματα για τον χρήστη.
function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Please confirm your email address first.';
  if (message.includes('network') || message.includes('fetch')) return 'Check your internet connection and try again.';
  return 'Something went wrong. Please try again.';
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Καθαρίζει το προηγούμενο σφάλμα κάθε φορά που αλλάζει ένα πεδίο.
  function updateField(setValue: (value: string) => void, value: string) {
    setValue(value);
    setError('');
  }

  // Ελέγχει τα στοιχεία και αφήνει το auth listener του App να αλλάξει οθόνη.
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
      <LinearGradient colors={['rgba(231,104,84,0.15)', 'rgba(255,248,244,0)']} style={styles.glow} pointerEvents="none" />
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

            {error ? <View accessibilityRole="alert" style={styles.error}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}

            <Button title="Sign in" onPress={handleLogin} loading={loading} />
            <Text style={styles.hint}>Don't have an account? Sign up will be added in the next step.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  content: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: space.xl },
  header: { alignItems: 'center', marginBottom: 36 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 42, letterSpacing: -1.5 },
  accent: { color: colors.accent, fontFamily: font.display },
  subtitle: { marginTop: space.xs, color: colors.textSoft, fontFamily: font.medium, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  form: { gap: 20 }, field: { gap: 8 },
  label: { color: colors.textStrong, fontFamily: font.semi, fontSize: 15 },
  inputBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.md, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 54, color: colors.text, fontSize: 16 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.sm, backgroundColor: '#FFF0EE' },
  errorText: { flex: 1, color: colors.danger, fontFamily: font.medium, fontSize: 14 },
  hint: { color: colors.textSoft, fontFamily: font.medium, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
