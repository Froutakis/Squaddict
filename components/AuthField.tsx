import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

export default function AuthField({
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

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.textStrong, fontFamily: font.semi, fontSize: 15 },
  inputBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.md, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 54, color: colors.text, fontSize: 16 },
});