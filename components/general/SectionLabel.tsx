import { StyleSheet, Text } from 'react-native';
import { colors, font, space } from '../../theme';

type SectionLabelProps = {
  children: string;
};

export default function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: colors.textFaint,
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: space.xs,
    marginHorizontal: 2,
  },
});
