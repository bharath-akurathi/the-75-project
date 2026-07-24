import { Platform } from 'react-native';

/**
 * Notification Scheduler (FR-6)
 * Handles local push notifications for evening reminders and class prompts.
 */

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn("expo-notifications is not available in this environment (e.g. Expo Go on Android SDK 53). Notifications are disabled.");
}

export async function requestNotificationPermissions() {
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    
    return finalStatus === 'granted';
  } catch (e) {
    console.warn("Failed to request notification permissions:", e);
    return false;
  }
}

/**
 * Schedules the evening reminder at 18:00 (6:00 PM) every day.
 * Triggered only if periods haven't been reviewed for the day (FR-6.1).
 */
export async function scheduleEveningReminder() {
  if (!Notifications) return;

  try {
    // Clear any existing evening reminders first
    await clearEveningReminder();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "How did today's classes go?",
        body: "Take 10 seconds to mark your attendance before you forget.",
        data: { type: 'evening_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 18,
        minute: 0,
      },
    });
  } catch (e) {
    console.warn("Failed to schedule evening reminder:", e);
  }
}

export async function clearEveningReminder() {
  if (!Notifications) return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'evening_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.warn("Failed to clear evening reminder:", e);
  }
}

/**
 * Schedules notifications right after a class period ends (FR-6.2).
 */
export async function scheduleClassReminder(subjectName: string, endTime: Date) {
  if (!Notifications) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Did you attend ${subjectName}?`,
        body: "Tap to quickly mark your attendance.",
        data: { type: 'class_reminder', subjectName },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endTime,
      },
    });
  } catch (e) {
    console.warn("Failed to schedule class reminder:", e);
  }
}
