import { supabase } from './supabaseClient';
import { getMessages } from './serviceGroup';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function openGroupChat(
  groupId: string,
  onNewMessage: (message: any) => void,
  onStatus?: (status: string) => void): RealtimeChannel {
  return supabase
    .channel('group-' + groupId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe((status) => onStatus?.(status));
}

export async function closeGroupChat(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

export async function startChat(
  groupId: string,
  onNewMessage: (message: any) => void,
  limit?: number,
  onStatus?: (status: string) => void
) {
  const page = await getMessages(groupId, { limit });
  const channel = openGroupChat(groupId, onNewMessage, onStatus);
  return { messages: page.messages, hasMore: page.hasMore, channel };
}
