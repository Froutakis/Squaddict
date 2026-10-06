import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import TicketBackdrop from './TicketBackdrop';
import TicketShape from './TicketShape';
import DashedDivider from './DashedDivider';
import { brand, colors, space, typo } from '../../theme';

// Sign in and Sign up share one look: a cobalt night with faint white
// tickets on top, and the form below is a ticket itself.

// The night: deep cobalt at the top left, brighter low right.
const NIGHT = [brand[0], colors.primary, '#3D5FE8'] as const;
// Words on the white stub, a quiet cobalt.
const STUB_INK = '#1A2D8A';
const STUB_SOFT = '#5A6B9D';
// Where the form's tear sits, from its top: just under Sign in | Sign up.
const TEAR_AT = 70;

type AuthHeroProps = {
  title: string;
  lead?: string;
  // The white ticket stub tilted in the corner.
  stub: { kicker: string; name: string; line: string };
  // Sign up has more fields, so its sky is shorter and the stub sits up top.
  short?: boolean;
};

export function AuthHero({ title, lead, stub, short = false }: AuthHeroProps) {
  return (
    <View style={[styles.sky, short && styles.skyShort]}>
      <LinearGradient colors={NIGHT} locations={[0, 0.62, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(143,166,245,0.55)', 'rgba(143,166,245,0)']}
        start={{ x: 0.9, y: 0 }}
        end={{ x: 0.35, y: 0.7 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <TicketBackdrop tone="night" />

      <View style={styles.brand} accessibilityRole="header">
        <View style={styles.logo}>
          <Ionicons name="people" size={17} color={colors.primary} />
        </View>
        <Text style={styles.brandText}>Squaddict</Text>
      </View>
      <Text style={[styles.title, short && styles.titleShort]}>{title}</Text>
      {lead ? <Text style={styles.lead}>{lead}</Text> : null}

      <View
        style={[styles.stub, short && styles.stubShort]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <TicketShape fill={colors.surface} corner={10} notch={6} />
        <Text style={styles.stubKicker}>{stub.kicker}</Text>
        <Text style={[styles.stubName, short && styles.stubNameShort]} numberOfLines={1}>
          {stub.name}
        </Text>
        <Text style={styles.stubLine} numberOfLines={1}>
          {stub.line}
        </Text>
      </View>
    </View>
  );
}

type AuthCardProps = {
  mode: 'signin' | 'signup';
  // Switches to the other screen; left out, the tabs only show where you are.
  onSwitch?: () => void;
  busy?: boolean;
  children: ReactNode;
};

// The form as a ticket: Sign in | Sign up on the stub, a tear with a notch on
// each side, then the fields.
export function AuthCard({ mode, onSwitch, busy = false, children }: AuthCardProps) {
  return (
    <View style={styles.card}>
      <TicketShape fill={colors.surface} corner={24} notch={9} notchAt={TEAR_AT} />
      <View style={styles.mode} accessibilityRole="tablist">
        <ModeTab label="Sign in" on={mode === 'signin'} onPress={mode === 'signin' ? undefined : onSwitch} busy={busy} />
        <ModeTab label="Sign up" on={mode === 'signup'} onPress={mode === 'signup' ? undefined : onSwitch} busy={busy} />
      </View>
      <View style={styles.tear}>
        <DashedDivider />
      </View>
      <View style={styles.fields}>{children}</View>
    </View>
  );
}

function ModeTab({ label, on, onPress, busy }: { label: string; on: boolean; onPress?: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || busy}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
    >
      <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
    </Pressable>
  );
}

// "Don't have an account? Sign up", at the foot of the page.
export function AuthSwitch({ text, action, onPress, busy = false }: { text: string; action: string; onPress?: () => void; busy?: boolean }) {
  if (!onPress) return null;
  return (
    <View style={styles.switch}>
      <Text style={styles.switchText}>{text} </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={action} hitSlop={8} onPress={onPress} disabled={busy}>
        <Text style={styles.switchLink}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { height: 352, paddingHorizontal: 24, paddingTop: space.xl + 6, overflow: 'hidden' },
  skyShort: { height: 232 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  brandText: { color: colors.onInk, ...typo.display, fontSize: 17, letterSpacing: -0.3 },
  title: { marginTop: 30, maxWidth: 260, color: colors.onInk, ...typo.display, fontSize: 31, lineHeight: 33, letterSpacing: -1.2 },
  // Clear of the stub, which sits up by the name.
  titleShort: { marginTop: 50 },
  lead: { marginTop: 8, maxWidth: 260, color: 'rgba(255,255,255,0.78)', ...typo.medium, fontSize: 14.5, lineHeight: 20 },

  stub: {
    position: 'absolute',
    right: 20,
    bottom: 58,
    width: 118,
    minHeight: 70,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    transform: [{ rotate: '6deg' }],
    shadowColor: '#0A1450',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
  },
  stubShort: { top: 54, bottom: undefined, right: 22, width: 112, minHeight: 62, paddingVertical: 8, paddingHorizontal: 11, transform: [{ rotate: '-5deg' }] },
  stubKicker: { color: STUB_SOFT, ...typo.medium, fontSize: 10.5 },
  stubName: { marginTop: 2, color: STUB_INK, ...typo.display, fontSize: 17, letterSpacing: -0.4 },
  stubNameShort: { fontSize: 15.5 },
  stubLine: { marginTop: 3, color: STUB_SOFT, ...typo.mono, fontSize: 10.5 },

  // The radius only rounds the shadow; the ticket itself is drawn.
  card: {
    borderRadius: 24,
    marginTop: -36,
    marginHorizontal: 14,
    paddingTop: 6,
    paddingHorizontal: 18,
    paddingBottom: 20,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  mode: { flexDirection: 'row', gap: 4, marginTop: 8, padding: 4, borderRadius: 14, backgroundColor: colors.bg },
  tab: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.primary },
  tabText: { color: colors.textSoft, ...typo.semi, fontSize: 14 },
  tabTextOn: { color: colors.onInk },
  pressed: { opacity: 0.8 },
  // Edge to edge, between the notches.
  tear: { marginTop: TEAR_AT - 61, marginHorizontal: -9, overflow: 'hidden' },
  fields: { gap: 12, marginTop: 12 },

  switch: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', paddingTop: 14, paddingBottom: 34 },
  switchText: { color: colors.textSoft, ...typo.medium, fontSize: 14 },
  switchLink: { color: colors.primary, ...typo.bold, fontSize: 14 },
});

export const authStyles = StyleSheet.create({
  // The page: the sky on top, the ticket over its edge, the switch at the foot.
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center' },
  grow: { flex: 1 },
  button: { marginTop: 4 },
});
