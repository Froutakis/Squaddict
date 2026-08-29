import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../../theme';
import CloseButton from './CloseButton';

type SheetHeaderProps = {
  title: string;
  onClose: () => void;
  closeDisabled?: boolean;
  grabber?: boolean;
};

export default function SheetHeader({
  title,
  onClose,
  closeDisabled = false,
  grabber = false,
}: SheetHeaderProps) {
  return (
    <View style={styles.header}>
      {grabber ? <View style={styles.grabber} /> : null}

      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <CloseButton onPress={onClose} disabled={closeDisabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, color: colors.text, fontFamily: font.bold, fontSize: 20 },
});
