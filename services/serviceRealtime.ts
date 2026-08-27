import { supabase } from './supabaseClient';
import { getMessages } from './serviceGroup';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function openGroupChat(
  groupId: string, 
  onNewMessage: (message: any) => void): RealtimeChannel {
  return supabase
    .channel('group-' + groupId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe();
}

export async function closeGroupChat(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

/**
 * Ανοίγει μια συνομιλία: η πρώτη σελίδα ιστορικού και το κανάλι μαζί.
 *
 * Το ιστορικό φορτώνεται ΠΡΙΝ ανοίξει το κανάλι, ώστε ένα μήνυμα που φτάνει
 * ενδιάμεσα να μη χαθεί — στη χειρότερη θα έρθει δύο φορές, και η οθόνη
 * ξεχωρίζει τα διπλά από το id.
 */
export async function startChat(
  groupId: string,
  onNewMessage: (message: any) => void,
  limit?: number
) {
  const page = await getMessages(groupId, { limit });
  const channel = openGroupChat(groupId, onNewMessage);
  return { messages: page.messages, hasMore: page.hasMore, channel };
}
