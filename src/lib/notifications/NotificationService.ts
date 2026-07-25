import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ============================================================================
// Constants
// ============================================================================

const PUSH_TOKEN_KEY = '@the75project:push_token';

// ============================================================================
// Notification Handler Setup
// ============================================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============================================================================
// Types
// ============================================================================

export interface PushTokenRegistration {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Registers for push notifications and returns the push token.
 * Works on physical devices; returns null in Expo Go or simulators.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications require a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check if running in Expo Go - push notifications are disabled
  if (Constants.appOwnership === 'expo') {
    console.log('Push notifications are disabled in Expo Go (SDK 53+)');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E11D48',
      sound: 'default',
    });
  }

  // Get the Expo push token
  try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!projectId) {
      console.warn('EXPO_PUBLIC_EAS_PROJECT_ID not set');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData.data;

    // Store the token locally
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);

    return pushToken;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Retrieves the stored push token from secure storage.
 */
export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Clears the stored push token from secure storage.
 */
export async function clearPushToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Notification Listeners
// ============================================================================

type NotificationListener = (notification: Notifications.Notification) => void;

let notificationSubscription: Notifications.Subscription | null = null;
let responseSubscription: Notifications.Subscription | null = null;

/**
 * Sets up listeners for incoming notifications and notification responses.
 * Returns a cleanup function to remove listeners.
 */
export function setupNotificationListeners(
  onNotificationReceived?: NotificationListener,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
): () => void {
  // Remove existing listeners
  removeNotificationListeners();

  // Listen for incoming notifications (foreground)
  notificationSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received:', notification);
      onNotificationReceived?.(notification);
    }
  );

  // Listen for notification taps
  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('Notification tapped:', response);
      onNotificationTapped?.(response);
    }
  );

  return () => removeNotificationListeners();
}

/**
 * Removes all notification listeners.
 */
export function removeNotificationListeners(): void {
  if (notificationSubscription) {
    Notifications.removeNotificationSubscription(notificationSubscription);
    notificationSubscription = null;
  }
  if (responseSubscription) {
    Notifications.removeNotificationSubscription(responseSubscription);
    responseSubscription = null;
  }
}

// ============================================================================
// Notification Actions
// ============================================================================

/**
 * Cancels all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Gets all currently scheduled notifications.
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Sets the badge count (iOS only).
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(count);
  }
}

/**
 * Schedules a local notification (for testing or immediate alerts).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  delaySeconds?: number
): Promise<string> {
  const content: Notifications.NotificationContentInput = {
    title,
    body,
    data: data || {},
    sound: true,
  };

  // Validate delay to prevent negative values
  const validDelay = delaySeconds && delaySeconds > 0 ? delaySeconds : undefined;

  if (validDelay) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: validDelay,
      },
    });
    return id;
  }

  // Fire immediately if no delay specified
  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
  });
  return id;
}
