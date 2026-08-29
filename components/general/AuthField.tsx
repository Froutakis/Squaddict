import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radius, space } from '../../theme';
import { useRef, useState } from 'react';

type AuthFieldProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  loading: boolean;
  password?: boolean;
  email?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  onSubmit?: () => void;
  error?: string;
  style?: StyleProp<ViewStyle>;
};

export default function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  loading,
  password = false,
  email = false,
  showPassword = false,
  onTogglePassword,
  onSubmit,
  error,
  style,
}: AuthFieldProps) {

  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.inputBox, focused && styles.focused, !!error && styles.errorBox]}
        onPress={function () {
          inputRef.current?.focus();
        }}
      >
        <Ionicons name={icon} size={20} color={error ? colors.danger : focused ? colors.primary : colors.textSoft} />
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          keyboardType={email ? 'email-address' : 'default'}
          secureTextEntry={password && !showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={password ? 'password' : email ? 'email' : 'name'}
          textContentType={password ? 'password' : email ? 'emailAddress' : 'name'}
          editable={!loading}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.textStrong, fontFamily: font.semi, fontSize: 15 },
  inputBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.md, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 54, color: colors.text, fontFamily: font.medium, fontSize: 16 },
  focused: { borderColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  errorBox: { borderColor: colors.danger },
  error: { color: colors.danger, fontFamily: font.medium, fontSize: 13 },
});