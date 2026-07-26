import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Typography, Spacing, Radius } from '@/lib/theme/tokens';

/**
 * Guest vs. Account Comparison Screen (FR-1.2)
 *
 * Honest comparison of what's available in each mode.
 * v3.1: includes explicit persistence warning for guest data.
 * "Continue without an account" is not buried or discouraged.
 */

interface ComparisonRow {
  feature: string;
  guest: boolean;
  account: boolean;
}

const comparisons: ComparisonRow[] = [
  { feature: 'Manual timetable creation', guest: true, account: true },
  { feature: 'Paste-JSON timetable extraction', guest: true, account: true },
  { feature: 'Full daily marking (present/absent)', guest: true, account: true },
  { feature: 'Extra Classes logging', guest: true, account: true },
  { feature: 'Personal exceptions & day swaps', guest: true, account: true },
  { feature: 'Complete calculation engine', guest: true, account: true },
  { feature: 'Insights, heatmap & burndown', guest: true, account: true },
  { feature: 'Light & dark mode', guest: true, account: true },
  { feature: 'AI Image-to-Timetable parser', guest: false, account: true },
  { feature: 'Evidence Log & Condonation Drafter', guest: false, account: true },
  { feature: 'Cloud backup & multi-device sync', guest: false, account: true },
  { feature: 'Share timetable by code', guest: false, account: true },
  { feature: 'Crowd-sourced cancellations', guest: false, account: true },
];

export default function CompareScreen() {
  const router = useRouter();
  const { activateGuestMode } = useAuth();
  const { colors } = useTheme();

  const handleContinueAsGuest = async () => {
    await activateGuestMode();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          What You Get
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          The core attendance tracker is identical in both modes.
        </Text>

        {/* Comparison Table */}
        <View style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerFeature, { color: colors.textSecondary }]}>Feature</Text>
            <Text style={[styles.headerCell, { color: colors.textSecondary }]}>Guest</Text>
            <Text style={[styles.headerCell, { color: colors.textSecondary }]}>Account</Text>
          </View>

          {/* Rows */}
          {comparisons.map((row, i) => (
            <View
              key={i}
              style={[
                styles.tableRow,
                i < comparisons.length - 1 && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
              ]}
            >
              <Text style={[styles.cellFeature, { color: colors.text }]}>{row.feature}</Text>
              <Text style={styles.cellCheck}>{row.guest ? '✓' : '—'}</Text>
              <Text style={styles.cellCheck}>{row.account ? '✓' : '—'}</Text>
            </View>
          ))}
        </View>

        {/* Persistence Warning (v3.1) */}
        <View style={[styles.warningBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
          <Text style={[styles.warningTitle, { color: colors.text }]}>
            ⚠️  Guest Data Warning
          </Text>
          <Text style={[styles.warningText, { color: colors.textSecondary }]}>
            Guest data lives entirely on this device. Clearing app data or uninstalling
            the app permanently deletes your attendance history. You can always create
            an account later to enable cloud backup.
          </Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.guestButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={handleContinueAsGuest}
          activeOpacity={0.85}
        >
          <Text style={[styles.guestButtonText, { color: colors.text }]}>
            Continue Without an Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.accountButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(auth)/sign-up')}
          activeOpacity={0.85}
        >
          <Text style={[styles.accountButtonText, { color: colors.textInverse }]}>
            Sign Up Instead
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    marginBottom: Spacing.xl,
  },
  table: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
  },
  headerFeature: {
    ...Typography.caption,
    flex: 1,
    textTransform: 'uppercase',
  },
  headerCell: {
    ...Typography.caption,
    width: 56,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  cellFeature: {
    ...Typography.bodySmall,
    flex: 1,
  },
  cellCheck: {
    width: 56,
    textAlign: 'center',
    fontSize: 16,
  },
  warningBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
  },
  warningTitle: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  warningText: {
    ...Typography.bodySmall,
    lineHeight: 20,
  },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.md,
  },
  guestButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  guestButtonText: {
    ...Typography.button,
  },
  accountButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  accountButtonText: {
    ...Typography.button,
  },
});
