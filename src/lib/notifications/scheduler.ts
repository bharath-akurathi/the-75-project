import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync,
  setupNotificationListeners,
  scheduleLocalNotification,
} from './NotificationService';

/**
 * Notification Scheduler (FR-6)
 * Handles notification setup, scheduling, and cleanup.
 * Works with both local and push notifications.
 */

// ============================================================================
// Setup
// ============================================================================

/**
 * Initializes notification system on app startup.
 * Registers for push notifications and sets up listeners.
 */
export async function initializeNotifications(): Promise<{
  pushToken: string | null;
  hasPermission: boolean;
}> {
  // Register for push notifications
  const pushToken = await registerForPushNotificationsAsync();

  // Setup notification listeners
  setupNotificationListeners(
    (notification) => {
      // Handle incoming notification in foreground
      console.log('Foreground notification:', notification.request.content);
    },
    (response) => {
      // Handle notification tap - can navigate based on data
      const data = response.notification.request.content.data;
      handleNotificationNavigation(data);
    }
  );

  // Schedule evening reminder
  await scheduleEveningReminder();

  return {
    pushToken,
    hasPermission: pushToken !== null,
  };
}

/**
 * Handles navigation when a notification is tapped.
 */
/**
 * Navigation reference - set this from your root navigator.
 * Example: navigationRef.current?.navigate('AttendanceScreen');
 */
let navigationRef: React.RefObject<any> | null = null;

/**
 * Sets the navigation reference for notification-driven navigation.
 * Call this from your root navigator component.
 */
export function setNavigationRef(ref: React.RefObject<any>) {
  navigationRef = ref;
}

/**
 * Handles navigation when a notification is tapped.
 */
function handleNotificationNavigation(data: Record<string, unknown> | undefined) {
  if (!data || !navigationRef?.current) {
    console.log('Navigation not available for notification:', data);
    return;
  }

  const type = data.type as string;

  switch (type) {
    case 'evening_reminder':
      navigationRef.current.navigate('(tabs)', { screen: 'index' });
      break;
    case 'class_reminder':
      navigationRef.current.navigate('(tabs)', { screen: 'index' });
      break;
    case 'crowd_claim':
      navigationRef.current.navigate('class-groups');
      break;
    default:
      console.log('Unknown notification type:', type);
  }
}

// ============================================================================
// Scheduling
// ============================================================================

/**
 * Schedules the evening reminder at 18:00 (6:00 PM) every day.
 * Triggered only if periods haven't been reviewed for the day (FR-6.1).
 */
export async function scheduleEveningReminder() {
  try {
    // Clear any existing evening reminders first
    await clearEveningReminder();

    // Schedule recurring daily notification at 18:00
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "How did today's classes go?",
        body: 'Take 10 seconds to mark your attendance before you forget.',
        data: { type: 'evening_reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 18,
        minute: 0,
      },
    });
  } catch (e) {
    console.warn('Failed to schedule evening reminder:', e);
  }
}

/**
 * Clears all evening reminder notifications.
 */
export async function clearEveningReminder() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'evening_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.warn('Failed to clear evening reminder:', e);
  }
}

/**
 * Schedules notifications right after a class period ends (FR-6.2).
 */
export async function scheduleClassReminder(subjectName: string, delayMinutes: number = 0) {
  try {
    await scheduleLocalNotification(
      `Did you attend ${subjectName}?`,
      'Tap to quickly mark your attendance.',
      { type: 'class_reminder', subjectName },
      delayMinutes > 0 ? delayMinutes * 60 : undefined
    );
  } catch (e) {
    console.warn('Failed to schedule class reminder:', e);
  }
}

/**
 * Schedules a notification for crowd-source claims.
 */
export async function scheduleCrowdClaimNotification(
  claimType: string,
  subjectName: string
) {
  try {
    await scheduleLocalNotification(
      `${claimType} reported for ${subjectName}`,
      'Tap to view and vote on this claim.',
      { type: 'crowd_claim', claimType, subjectName }
    );
  } catch (e) {
    console.warn('Failed to schedule crowd claim notification:', e);
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Cleans up all notification-related resources.
 * Should be called on app termination or sign-out.
 */
export async function cleanupNotifications(): Promise<void> {
  await cancelAllNotifications();
}
