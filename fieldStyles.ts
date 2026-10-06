import { StyleSheet } from 'react-native';
import { colors, typo, space, tint } from './theme';

// Fields: the label above, a filled box, what went wrong under it. The box
// turns white with a blue ring while you type, red-soft with a red ring when
// something is wrong. The border is always there (clear), so nothing moves.
export const fieldStyles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.text, ...typo.semi, fontSize: 13 },
  box: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  focused: { borderColor: colors.primary, backgroundColor: colors.surface },
  errorBox: { borderColor: colors.danger, backgroundColor: tint.danger },
  disabled: { opacity: 0.6 },
  // The box shows focus, so the web's own outline is dropped.
  input: { flex: 1, minHeight: 44, color: colors.text, ...typo.regular, fontSize: 15, outlineStyle: 'none' } as any,
  mono: { ...typo.mono, letterSpacing: 0.4 },
  placeholder: { color: colors.textFaint },
  error: { flexShrink: 1, color: colors.danger, ...typo.medium, fontSize: 12.5 },
  // A line under the field: an error with its icon, or a check that is met.
  help: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  helpText: { flexShrink: 1, color: colors.textFaint, ...typo.medium, fontSize: 12.5 },
  ok: { color: colors.success },
});
