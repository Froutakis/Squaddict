import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme';
import { fieldStyles } from '../../fieldStyles';
import { useRef, useState } from 'react';

type AuthFieldProps = {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  loading: boolean;
  password?: boolean;
  email?: boolean;
  mono?: boolean;
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
  mono = false,
  showPassword = false,
  onTogglePassword,
  onSubmit,
  error,
  style,
}: AuthFieldProps) {

  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={[fieldStyles.field, style]}>
      {label ? <Text style={fieldStyles.label}>{label}</Text> : null}

      <Pressable
        style={[fieldStyles.box, focused && fieldStyles.focused, !!error && fieldStyles.errorBox]}
        onPress={function () {
          inputRef.current?.focus();
        }}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={error ? colors.danger : focused ? colors.primary : colors.textSoft}
          />
        ) : null}

        <TextInput
          ref={inputRef}
          accessibilityLabel={label ?? placeholder}
          style={[fieldStyles.input, mono && fieldStyles.mono]}
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

      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  );
}
