/**
 * The 75 Project — Root Layout
 * Wraps app in GestureHandlerRootView + SQLiteProvider
 * Routes to onboarding or main tabs based on onboarding_complete
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { migrateDatabase } from '@/database/migrations';
import { getPreferences } from '@/database/queries';
import { Colors } from '@/theme/colors';

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Re-check DB on every segment change so we pick up the state after done.tsx
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getPreferences(db);
        if (!cancelled) {
          setOnboardingComplete(prefs.onboarding_complete === 1);
        }
      } catch {
        if (!cancelled) setOnboardingComplete(false);
      }
      if (!cancelled) setIsReady(true);
    })();
    return () => { cancelled = true; };
  }, [db, segments]);

  useEffect(() => {
    if (!isReady) return;

    const inOnboarding = segments[0] === '(onboarding)';

    if (!onboardingComplete && !inOnboarding) {
      router.replace('/(onboarding)/welcome');
    } else if (onboardingComplete && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [isReady, onboardingComplete, segments, router]);

  if (!isReady) {
    return <View style={styles.loading} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.bg} />
      <SQLiteProvider databaseName="the75.db" onInit={migrateDatabase}>
        <NavigationGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.dark.bg },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </NavigationGuard>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
  },
  loading: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
  },
});
