import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { colors } from "./theme";

// System notifications without Firebase: a WorkManager-backed background task
// polls /api/app/notifications (~every 15 min, OS permitting) and raises local
// notifications for anything newer than the last-seen watermark. The same sync
// runs on every app launch, so an open app notifies immediately.

const TASK = "dk-notification-poll";
const SEEN_KEY = "dk_notif_last_seen";
const CHANNEL = "alerts";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function syncAndNotify(): Promise<boolean> {
  try {
    const { notifications } = await api.notifications();
    if (notifications.length === 0) return true;
    const newest = notifications.reduce((m, n) => (n.created_at > m ? n.created_at : m), "");
    const lastSeen = await SecureStore.getItemAsync(SEEN_KEY);
    if (lastSeen) {
      const fresh = notifications.filter((n) => n.created_at > lastSeen);
      for (const n of fresh.slice(0, 3)) {
        await Notifications.scheduleNotificationAsync({
          content: { title: n.title, body: n.body ?? undefined },
          trigger: null,
        });
      }
      if (fresh.length > 3) {
        await Notifications.scheduleNotificationAsync({
          content: { title: "New alerts", body: `${fresh.length - 3} more notifications` },
          trigger: null,
        });
      }
    }
    // First run: set the watermark silently so old alerts don't blast the user.
    if (!lastSeen || newest > lastSeen) await SecureStore.setItemAsync(SEEN_KEY, newest);
    return true;
  } catch {
    return false;
  }
}

TaskManager.defineTask(TASK, async () => {
  const ok = await syncAndNotify();
  return ok ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
});

export async function initNotifications(): Promise<void> {
  try {
    // Android 13+ shows the permission prompt only after a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.accent,
    });
    await Notifications.requestPermissionsAsync();
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
    await syncAndNotify();
  } catch {
    // notifications are best-effort; never block the app on them
  }
}
