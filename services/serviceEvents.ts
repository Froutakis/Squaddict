import { supabase } from "./supabaseClient";

type EventRow = {
  id: string;
  group_id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  created_by: string;
};

export type GroupEvent = {
  id: string;
  groupId: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  createdBy: string;
};

function toEvent(r: EventRow): GroupEvent {
  return {
    id: r.id,
    groupId: r.group_id,
    title: r.title,
    date: r.date,
    startTime: r.start_time?.slice(0, 5) ?? undefined,
    endTime: r.end_time?.slice(0, 5) ?? undefined,
    location: r.location ?? undefined,
    description: r.description ?? undefined,
    createdBy: r.created_by,
  };
}

export async function getEvents(groupId: string): Promise<GroupEvent[]> {
    const {data, error} = await supabase
        .from("events")
        .select("*")
        .eq("group_id", groupId)
        .order("date", { ascending: true});
    if (error) throw error;
    return (data as EventRow[]).map(toEvent);
}

export type NewEvent = {
    title: string;
    date: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
};

export async function createEvent(groupId: string, input: NewEvent): Promise<GroupEvent> {
    const { title, date, startTime, endTime, location, description } = input;
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) {
        throw new Error("Πρέπει να συνδεθείς για να δημιουργήσεις εκδήλωση.");
    }

    const {data, error} = await supabase
        .from("events")
        .insert({
            group_id: groupId,
            title,
            date,
            start_time: startTime || null,
            end_time: endTime || null,
            location: location || null,
            description: description || null,
            created_by: userData.user.id,
            })
        .select()
        .single();
    if (error) throw error;
    return toEvent(data as EventRow);
}

export type MyEvent = GroupEvent & { groupName: string };

export async function getMyEvents(userId: string): Promise<MyEvent[]> {

    const { data: memberships, error: mErr } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);
    if (mErr) throw mErr;

    const ids = memberships.map((m) => m.group_id);

    if (ids.length === 0) return [];

    const { data, error } = await supabase
        .from("events")
        .select("*, groups(name)")
        .in("group_id", ids)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: true });
    if (error) throw error;

    type RowWithGroup = EventRow & { groups: { name: string } | null };

    return (data as RowWithGroup[]).map((r) => ({
        ...toEvent(r),
        groupName: r.groups?.name ?? "Παρέα",
    }));
}

export async function deleteEvent(eventId: string): Promise<void> {
    const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
    if (error) throw error;
}
