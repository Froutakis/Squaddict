import { StyleSheet } from 'react-native';
import { colors, typo, radius, space } from './theme';

export const fieldStyles = StyleSheet.create({
  field: { gap: space.xs },
  label: {
    color: colors.textFaint,
    ...typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  box: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  errorBox: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
  input: { flex: 1, minHeight: 48, color: colors.text, ...typo.medium, fontSize: 15 },
  mono: { ...typo.mono, letterSpacing: 0.4 },
  placeholder: { color: colors.textFaint },
  error: { color: colors.danger, ...typo.medium, fontSize: 12.5 },
});
