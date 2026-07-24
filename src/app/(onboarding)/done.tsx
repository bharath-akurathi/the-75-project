/**
 * The 75 Project — Onboarding Done Screen
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { setOnboardingComplete } from '@/lib/database/queries';
import { Logo } from '@/components/Logo';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

export default function DoneScreen() {
  const router = useRouter();
  const db = useSQLiteContext();

  const handleFinish = async () => {
    // Request notification permissions (FR-9.1)
    const { requestNotificationPermissions } = await import('@/lib/notifications/scheduler');
    await requestNotificationPermissions();

    await setOnboardingComplete(db);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
        </View>

        <Text style={styles.title}>You're All Set!</Text>
        <Text style={styles.subtitle}>
          Your timetable is ready. Start tracking your attendance today.
        </Text>

        <View style={styles.tips}>
          <View style={styles.tipRow}>
            <View style={[styles.tipIcon, { backgroundColor: Colors.successBg }]}>
              <Ionicons name="checkmark" size={16} color={Colors.success} />
            </View>
            <Text style={styles.tipText}>All classes default to Present</Text>
          </View>
          <View style={styles.tipRow}>
            <View style={[styles.tipIcon, { backgroundColor: Colors.dangerBg }]}>
              <Ionicons name="close" size={16} color={Colors.danger} />
            </View>
            <Text style={styles.tipText}>Tap to mark Absent when you skip</Text>
          </View>
          <View style={styles.tipRow}>
            <View style={[styles.tipIcon, { backgroundColor: Colors.warningBg }]}>
              <Ionicons name="analytics" size={16} color={Colors.amber} />
            </View>
            <Text style={styles.tipText}>Check Insights to see how many you can skip</Text>
          </View>
        </View>

        <Logo size={60} />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.ctaButton} onPress={handleFinish} activeOpacity={0.8}>
          <Text style={styles.ctaText}>Start Tracking</Text>
          <Ionicons name="rocket-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
    justifyContent: 'space-between',
    paddingTop: 100,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.base,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.size.base * Typography.lineHeight.relaxed,
    marginBottom: Spacing['3xl'],
  },
  tips: {
    width: '100%',
    gap: Spacing.base,
    marginBottom: Spacing['3xl'],
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.rose,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  ctaText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
});
