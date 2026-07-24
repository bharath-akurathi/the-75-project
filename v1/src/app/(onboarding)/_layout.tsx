/**
 * The 75 Project — Onboarding Layout
 */

import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '@/theme/colors';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="mode" />
      <Stack.Screen name="semester" />
      <Stack.Screen name="periods" />
      <Stack.Screen name="timetable" />
      <Stack.Screen name="done" />
    </Stack>
  );
}
