import { supabase } from './supabaseClient';
import { getMessages } from './serviceGroup';
import type { RealtimeChannel } from '@supabase/supabase-js';

const TYPING_EVENT = 'typing';

export type ChatHandlers = {
  onNewMessage: (message: any) => void;
  onMessageUpdate?: (message: any) => void;
  onStatus?: (status: string) => void;
  onTyping?: (who: { id: string; name: string }) => void;
  onPresence?: (online: number) => void;
  onReaction?: (row: any) => void;
  onReactionGone?: (row: any) => void;
};

export type Me = { id: string; name: string };

export function openGroupChat(
  groupId: string,
  me: Me,
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

export function sendTyping(channel: RealtimeChannel, me: Me): void {
  channel
    .send({ type: 'broadcast', event: TYPING_EVENT, payload: { id: me.id, name: me.name } })
    .catch(function () {
    });
}

export async function closeGroupChat(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

export async function startChat(
  groupId: string,
  me: Me,
  handlers: ChatHandlers,
  limit?: number,
) {
  const page = await getMessages(groupId, { limit });
  const channel = openGroupChat(groupId, me, handlers);
  return { messages: page.messages, hasMore: page.hasMore, channel };
}
