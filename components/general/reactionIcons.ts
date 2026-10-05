import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { ReactionEmoji } from '../../lib/photoFeed';

type IconName = ComponentProps<typeof Ionicons>['name'];

// The reactions are kept as emoji; on memories and in the chat they are drawn
// as line icons, filled in once they are yours.
export const REACTION_ICONS: Record<ReactionEmoji, [IconName, IconName]> = {
  '🔥': ['flame-outline', 'flame'],
  '😂': ['happy-outline', 'happy'],
  '😍': ['heart-outline', 'heart'],
  '🍻': ['beer-outline', 'beer'],
};

export const REACTION_NAMES: Record<ReactionEmoji, string> = {
  '🔥': 'fire',
  '😂': 'laugh',
  '😍': 'heart',
  '🍻': 'cheers',
};
