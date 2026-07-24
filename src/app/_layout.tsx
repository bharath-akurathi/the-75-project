import 'react-native-url-polyfill/auto';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
// Note: We use V1's Theme context logic if it existed, but V1 just used static exports.
// However, to keep it simple, we don't need ThemeProvider if V1 didn't use it.
import { requestNotificationPermissions, scheduleEveningReminder } from '@/lib/notifications/scheduler';
import { flushOutbox } from '@/lib/database/syncWorker';
import { migrateDatabase } from '@/lib/database/migrations';
import { Colors } from '@/theme/colors';
import { ThemeProvider } from '@/lib/theme/ThemeContext';

// We'll write this check in queries.ts later. It will verify if student profile exists.
import { checkOnboardingComplete } from '@/lib/database/queries';

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { mode: authMode, user, localUserId } = useAuth();
  const db = useSQLiteContext();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    async function checkState() {
      if (authMode === 'loading') return;
      
      if (authMode === 'unauthenticated') {
        if (!cancelled) {
          setOnboardingComplete(false);
          setIsReady(true);
        }
        return;
      }
      
      // If guest or authenticated, check DB for student profile
      try {
        const isComplete = await checkOnboardingComplete(db, localUserId, user?.id);
        if (!cancelled) {
          setOnboardingComplete(isComplete);
          setIsReady(true);
        }
      } catch (err) {
        console.error("Error checking onboarding:", err);
        if (!cancelled) {
          setOnboardingComplete(false);
          setIsReady(true);
        }
      }
    }
    
    checkState();
    
    return () => { cancelled = true; };
  }, [authMode, db, segments, user, localUserId]);

  useEffect(() => {
    if (!isReady || authMode === 'loading') return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (authMode === 'unauthenticated') {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
    } else {
      // Authenticated or Guest
      if (!onboardingComplete && !inOnboardingGroup) {
        router.replace('/(onboarding)/welcome');
      } else if (onboardingComplete && (inAuthGroup || inOnboardingGroup)) {
        router.replace('/(tabs)');
      }
    }
  }, [isReady, authMode, onboardingComplete, segments, router]);

  if (!isReady || authMode === 'loading') {
    return <View style={styles.loading} />;
  }

  return <>{children}</>;
}

function AppContent() {
  useEffect(() => {
    async function setupNotifications() {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleEveningReminder();
      }
    }
    setupNotifications();

    const syncInterval = setInterval(() => {
      flushOutbox().catch(console.error);
    }, 30000);
    
    flushOutbox().catch(console.error);

    return () => clearInterval(syncInterval);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SQLiteProvider databaseName="the75.db" onInit={migrateDatabase}>
        <ThemeProvider>
          <AuthProvider>
            <NavigationGuard>
              <AppContent />
            </NavigationGuard>
          </AuthProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark.bg },
  loading: { flex: 1, backgroundColor: Colors.dark.bg },
});
