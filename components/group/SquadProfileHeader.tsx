import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../../services/serviceGroup';
import { sinceYear } from '../../lib/acting';
import { nightsLabel } from '../../lib/squadLook';
import Ticket from '../general/Ticket';
import Punch from '../general/Punch';
import Monogram from '../general/Monogram';
import ImageViewer from '../general/ImageViewer';
import { colors, radius, space, textSize, typo } from '../../theme';

const AVATAR = 64;
const WHITE = '#FFFFFF';

export type ProfileStat = { value: number | null; label: string };

type SquadProfileHeaderProps = {
  group: Group;
  stats: ProfileStat[];
  nights: number;
  acting: boolean;
};

// The squad as one of our tickets: the banner is the cover, the name sits on
// it like an event title, and the numbers live on the stub below the tear.
// The acting squad's photo carries a punched hole, "the punched one".
export default function SquadProfileHeader({ group, stats, nights, acting }: SquadProfileHeaderProps) {
  const [bannerBroken, setBannerBroken] = useState(false);
  const [viewing, setViewing] = useState<'banner' | 'avatar' | null>(null);

  useEffect(() => {
    setBannerBroken(false);
  }, [group.bannerUrl]);

  const banner = group.bannerUrl && !bannerBroken ? group.bannerUrl : null;
  const onPhoto = banner !== null;
  const year = sinceYear(group.createdAt);
  const handleLine = [`@${group.handle}`, year ? `SINCE ${year}` : null].filter(Boolean).join(' · ');

  const stub = (
    <View style={styles.stub}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={styles.stat}
          accessible
          accessibilityLabel={`${stat.value ?? 'unknown'} ${stat.label}`}
        >
          <Text style={styles.statValue}>{stat.value === null ? '–' : stat.value}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {stat.label.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Ticket
        cover={banner}
        onCoverError={() => setBannerBroken(true)}
        onPress={banner ? () => setViewing('banner') : undefined}
        stub={stub}
        accessibilityLabel={`${group.name}${acting ? ', the squad you act as' : ''}`}
      >
        <View style={[styles.main, onPhoto && styles.mainOnPhoto]}>
          {nights > 0 ? (
            <View style={[styles.tag, onPhoto ? styles.tagOnPhoto : styles.tagPlain]}>
              <Text style={[styles.tagText, !onPhoto && styles.tagTextPlain]}>
                {nightsLabel(nights).toUpperCase()} ON THE WALL
              </Text>
            </View>
          ) : null}

          {onPhoto ? <View style={styles.spacer} /> : null}

          <View style={styles.identity}>
            <Pressable
              onPress={() => (group.avatarUrl ? setViewing('avatar') : undefined)}
              disabled={!group.avatarUrl}
              accessibilityRole={group.avatarUrl ? 'imagebutton' : undefined}
              accessibilityLabel={`${group.name} photo`}
            >
              <Monogram
                name={group.name}
                size={AVATAR}
                uri={group.avatarUrl}
                ring={3}
                ringColor={onPhoto ? 'rgba(255,255,255,0.9)' : colors.surface}
              />
              {acting ? (
                <View style={styles.punch}>
                  <Punch state="in" size={20} holeColor={onPhoto ? '#05090D' : colors.bg} />
                </View>
              ) : null}
            </Pressable>

            <View style={styles.names}>
              <Text style={[styles.name, onPhoto && styles.onPhoto]} numberOfLines={2}>
                {group.name}
              </Text>
              <Text style={[styles.handle, onPhoto && styles.handleOnPhoto]} numberOfLines={1}>
                {handleLine}
              </Text>
            </View>
          </View>
        </View>
      </Ticket>

      {group.bio ? <Text style={styles.bio}>{group.bio}</Text> : null}

      <ImageViewer
        uri={viewing === 'banner' ? banner : viewing === 'avatar' ? group.avatarUrl : null}
        label={viewing === 'banner' ? `${group.name} banner` : `${group.name} photo`}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  main: { gap: space.sm },
  mainOnPhoto: { minHeight: 176 },
  spacer: { flex: 1 },
  tag: {
    alignSelf: 'flex-end',
    paddingHorizontal: space.sm,
    height: 22,
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  tagOnPhoto: { backgroundColor: 'rgba(0,0,0,0.38)' },
  tagPlain: { backgroundColor: colors.surfaceAlt },
  tagText: { color: WHITE, ...typo.mono, fontSize: 9.5, letterSpacing: 1.2 },
  tagTextPlain: { color: colors.textSoft },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  punch: { position: 'absolute', right: -2, bottom: -2 },
  names: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: colors.text, ...typo.display, fontSize: textSize.heading + 2, letterSpacing: -0.5, lineHeight: 26 },
  onPhoto: { color: WHITE },
  handle: { color: colors.textFaint, ...typo.mono, fontSize: textSize.caption, letterSpacing: 0.8 },
  handleOnPhoto: { color: 'rgba(255,255,255,0.8)' },
  bio: { color: colors.text, ...typo.regular, fontSize: textSize.body, lineHeight: 19, paddingHorizontal: space.xxs },

  stub: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: colors.text, ...typo.title, fontSize: textSize.heading },
  statLabel: { color: colors.textFaint, ...typo.mono, fontSize: 9.5, letterSpacing: 0.8 },
});
