import { supabase } from "./supabaseClient";
import { toRsvp, type MyEvent, type RsvpStatus } from "./serviceEvents";

// "Suggest to my parea": a member points their parea at another parea's
// public plan. It is not a vote: the plan shows in the chat as a card and on
// the parea's Home line, and everyone answers I'm in / Pass on their own.

export type PlanSuggestion = {
  // The chat message that carries the card (null if it was removed).
  messageId: string | null;
  suggestedBy: string | null;
  suggesterName: string;
  suggestedAt: string;
  event: MyEvent;
  goingCount: number;
};

// Posts the card in the parea's chat. False when the parea had it already.
export async function suggestPlan(groupId: string, eventId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("suggest_plan", { p_group_id: groupId, p_event_id: eventId });
  if (error) throw error;

  return data !== false;
}

function toStatus(value: unknown): RsvpStatus | undefined {
  return toRsvp(value);
}

// The parea's suggestions of plans still ahead. Before plans_by_vote.sql is
// installed there are none, and the chat and Home simply show nothing.
export async function getSuggestions(groupId: string): Promise<PlanSuggestion[]> {
  const { data, error } = await supabase.rpc("parea_suggestions", { p_group_id: groupId });
  if (error) {
    console.warn("[squaddict] suggestions unavailable:", error.message);
    return [];
  }

  return ((data ?? []) as any[]).map(function (r) {
    return {
      messageId: r.message_id ?? null,
      suggestedBy: r.suggested_by ?? null,
      suggesterName: r.suggester_name ?? "Someone",
      suggestedAt: r.suggested_at ?? "",
      goingCount: r.going_count ?? 0,
      event: {
        id: r.event_id,
        groupId: r.group_id,
        groupName: r.group_name ?? "Parea",
        title: r.title,
        date: r.date,
        startTime: r.start_time?.slice(0, 5) ?? undefined,
        endTime: r.end_time?.slice(0, 5) ?? undefined,
        location: r.location ?? undefined,
        placeLabel: r.place_label ?? undefined,
        description: r.description ?? undefined,
        lat: r.lat ?? undefined,
        lng: r.lng ?? undefined,
        createdBy: "",
        isPublic: true,
        tags: [],
        going: [],
        myStatus: toStatus(r.my_status),
      },
    };
  });
}
