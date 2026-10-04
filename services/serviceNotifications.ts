import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import type * as NotificationsModule from "expo-notifications";
import { supabase } from "./supabaseClient";

export type PushTarget =
  | { type: "message"; groupId: string }
  | { type: "event"; groupId: string; eventId: string }
  | { type: "votes"; groupId: string };

let registeredToken: string | null = null;

const pushSupported = Platform.OS === "ios" || (Platform.OS === "android" && !isRunningInExpoGo());

function notifications(): typeof NotificationsModule | null {
  return pushSupported ? (require("expo-notifications") as typeof NotificationsModule) : null;
}

function projectId(): string | null {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  return fromConfig ?? Constants.easConfig?.projectId ?? null;
}

export function showNotificationsInForeground(): void {
  notifications()?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPush(): Promise<string | null> {
  const Notifications = notifications();
  if (!Notifications) return null;

  const id = projectId();
  if (!id) {
    console.warn("[squaddict] push is off: app.json has no EAS projectId (run `npx eas-cli init`).");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Squaddict",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;

  const { error } = await supabase.rpc("register_push_token", {
    push_token: token,
    device_platform: Platform.OS,
  });
  if (error) throw error;

  registeredToken = token;
  return token;
}

export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  if (!token) return;

  registeredToken = null;
  await supabase.rpc("unregister_push_token", { push_token: token });
}

function targetOf(response: NotificationsModule.NotificationResponse | null): PushTarget | null {
  const data = response?.notification.request.content.data as Record<string, unknown> | undefined;
  if (!data || typeof data.groupId !== "string") return null;

  if (data.type === "message") return { type: "message", groupId: data.groupId };
  if (data.type === "event" && typeof data.eventId === "string") {
    return { type: "event", groupId: data.groupId, eventId: data.eventId };
  }
  if (data.type === "votes") return { type: "votes", groupId: data.groupId };
  return null;
}

export function onPushOpened(handler: (target: PushTarget) => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => {};

  const launched = targetOf(Notifications.getLastNotificationResponse());
  if (launched) {
    Notifications.clearLastNotificationResponse();
    handler(launched);
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const target = targetOf(response);
    if (target) handler(target);
  });

  return () => subscription.remove();
}
