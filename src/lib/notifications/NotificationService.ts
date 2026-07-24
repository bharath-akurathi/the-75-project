// import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// MOCKED for Expo Go SDK 53 compatibility: 
// "Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go with the release of SDK 53."

export async function registerForPushNotificationsAsync() {
  console.log("Mock: registerForPushNotificationsAsync called (disabled for Expo Go)");
  return false;
}

export async function scheduleEveningNudge() {
  console.log("Mock: scheduleEveningNudge called (disabled for Expo Go)");
}
