import type { Person } from "../lib/people";
import { supabase } from './supabaseClient';
import { getMessages } from './serviceChat';
import type { RealtimeChannel } from '@supabase/supabase-js';

const TYPING_EVENT = 'typing';
// A card in the chat changed (a vote, a question, someone on their way): the
// others read it again. Ballots have no group to filter realtime rows on, so
// the one who answered tells the chat.
const CARDS_EVENT = 'cards';

export type ChatHandlers = {
  onNewMessage: (message: any) => void;
  onMessageUpdate?: (message: any) => void;
  onStatus?: (status: string) => void;
  onTyping?: (who: { id: string; name: string }) => void;
  onPresence?: (online: number) => void;
  onReaction?: (row: any) => void;
  onReactionGone?: (row: any) => void;
  onCards?: (messageIds: string[]) => void;
};

export function openGroupChat(
  groupId: string,
  me: Person,
  handlers: ChatHandlers,
): RealtimeChannel {
  const filter = `group_id=eq.${groupId}`;

  const channel = supabase.channel('group-' + groupId, {
    config: {
      presence: { key: me.id },
      broadcast: { self: false },
    },
  });

  channel
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onNewMessage(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onMessageUpdate?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'message_reactions', filter },
      (payload) => handlers.onReaction?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'message_reactions', filter },
      (payload) => handlers.onReaction?.(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'message_reactions', filter },
      (payload) => handlers.onReactionGone?.(payload.old),
    )
    .on('broadcast', { event: TYPING_EVENT }, function (message) {
      const payload = message.payload as { id?: string; name?: string } | undefined;
      if (!payload?.id || payload.id === me.id) {
        return;
      }
      handlers.onTyping?.({ id: payload.id, name: payload.name ?? '' });
    })
    .on('broadcast', { event: CARDS_EVENT }, function (message) {
      const payload = message.payload as { messageIds?: unknown } | undefined;
      const ids = Array.isArray(payload?.messageIds)
        ? payload.messageIds.filter((id): id is string => typeof id === 'string')
        : [];
      if (ids.length > 0) {
        handlers.onCards?.(ids);
      }
    })
    .on('presence', { event: 'sync' }, function () {
      handlers.onPresence?.(Object.keys(channel.presenceState()).length);
    })
    .subscribe(function (status) {
      handlers.onStatus?.(status);
      if (status === 'SUBSCRIBED') {
        channel.track({ id: me.id, name: me.name }).catch(function () {
        });
      }
    });

  return channel;
}

export function sendTyping(channel: RealtimeChannel, me: Person): void {
  channel
    .send({ type: 'broadcast', event: TYPING_EVENT, payload: { id: me.id, name: me.name } })
    .catch(function () {
    });
}

export function sendCardsChanged(channel: RealtimeChannel, messageIds: string[]): void {
  channel
    .send({ type: 'broadcast', event: CARDS_EVENT, payload: { messageIds } })
    .catch(function () {
    });
}

export async function closeGroupChat(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

export async function startChat(
  groupId: string,
  me: Person,
  handlers: ChatHandlers,
  limit?: number,
) {
  const page = await getMessages(groupId, { limit });
  const channel = openGroupChat(groupId, me, handlers);
  return { messages: page.messages, hasMore: page.hasMore, channel };
}
