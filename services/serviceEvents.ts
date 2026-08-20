import { supabase } from "./supabaseClient";
import { requireUser } from "./serviceAuth";

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

type AttendeeRow = {
  user_id: string;
  status: string;
  profiles: { display_name: string } | null;
};

type EventRowWithJoins = EventRow & {
  groups: { name: string } | null;
  event_attendees: AttendeeRow[] | null;
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

export type NewEvent = Omit<GroupEvent, 'id' | 'groupId' | 'createdBy'>;

export type RsvpStatus = "in" | "out";

export type Attendee = {
  userId: string;
  name: string;
  status: RsvpStatus;
};

export type MyEvent = GroupEvent & {
  groupName: string;
  myStatus?: RsvpStatus;
  going: { id: string; name: string }[];
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

function toAttendee(a: AttendeeRow): Attendee {
  return {
    userId: a.user_id,
    name: a.profiles?.display_name ?? "",
    status: a.status === "in" ? "in" : "out",
  };
}

function toColumns(input: NewEvent) {
  return {
    title: input.title,
    date: input.date,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    location: input.location || null,
    description: input.description || null,
  };
}

export async function createEvent(groupId: string, input: NewEvent): Promise<GroupEvent> {
    const user = await requireUser();

    const { data, error } = await supabase
        .from("events")
        .insert({
            ...toColumns(input),
            group_id: groupId,
            created_by: user.id,
        })
        .select()
        .single();
    if (error) throw error;

    return toEvent(data as EventRow);
}

export async function updateEvent(eventId: string, input: NewEvent): Promise<GroupEvent> {
    const user = await requireUser();

    const { data, error } = await supabase
        .from("events")
        .update(toColumns(input))
        .eq("id", eventId)
        .eq("created_by", user.id)
        .select()
        .single();
    if (error) throw error;

    return toEvent(data as EventRow);
}

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
        .select("*, groups(name), event_attendees(user_id, status, profiles(display_name))")
        .in("group_id", ids)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: true });
    if (error) throw error;

    return (data as EventRowWithJoins[]).map((r) => {
        const answers = r.event_attendees ?? [];
        const mine = answers.find((a) => a.user_id === userId)?.status;

        return {
            ...toEvent(r),
            groupName: r.groups?.name ?? "Squad",
            myStatus: mine === "in" || mine === "out" ? mine : undefined,
            going: answers
                .filter((a) => a.status === "in")
                .map((a) => ({ id: a.user_id, name: a.profiles?.display_name ?? "" })),
        };
    });
}

export async function deleteEvent(eventId: string): Promise<void> {
    const user = await requireUser();

    const { data, error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
        .eq("created_by", user.id)
        .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error("You can only delete events you created.");
    }
}

export async function setRsvp(eventId: string, status: RsvpStatus): Promise<void> {
    const user = await requireUser();

    const { error } = await supabase
        .from("event_attendees")
        .upsert(
            {
                event_id: eventId,
                user_id: user.id,
                status,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "event_id,user_id" }
        );
    if (error) throw error;
}

export async function clearRsvp(eventId: string): Promise<void> {
    const user = await requireUser();

    const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);
    if (error) throw error;
}

export async function getAttendees(eventId: string): Promise<Attendee[]> {
    const { data, error } = await supabase
        .from("event_attendees")
        .select("user_id, status, profiles(display_name)")
        .eq("event_id", eventId)
        .in("status", ["in", "out"]);
    if (error) throw error;

    return (data as unknown as AttendeeRow[]).map(toAttendee);
}
