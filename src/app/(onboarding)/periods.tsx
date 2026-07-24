/**
 * The 75 Project — Period Timings Screen (Onboarding Step 3.5)
 * Lets user define start/end times for each period
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { bulkInsertPeriodTimings } from '@/database/queries';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

interface PeriodEntry {
  period_num: number;
  start_time: string;
  end_time: string;
}

const DEFAULT_TIMINGS: PeriodEntry[] = [
  { period_num: 1, start_time: '10:00', end_time: '11:30' },
  { period_num: 2, start_time: '11:30', end_time: '13:00' },
  { period_num: 3, start_time: '14:00', end_time: '15:30' },
  { period_num: 4, start_time: '15:30', end_time: '17:00' },
];

export default function PeriodsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [periods, setPeriods] = useState<PeriodEntry[]>(DEFAULT_TIMINGS);

  const handleAddPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextNum = periods.length > 0 ? periods[periods.length - 1].period_num + 1 : 1;
    setPeriods([...periods, { period_num: nextNum, start_time: '', end_time: '' }]);
  };

  const handleRemovePeriod = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = [...periods];
    updated.splice(index, 1);
    setPeriods(updated);
  };

  const handleTimeChange = (index: number, field: 'start_time' | 'end_time', value: string) => {
    // Auto-format: add colon after 2 digits
    let formatted = value.replace(/[^0-9]/g, '');
    if (formatted.length > 2) {
      formatted = formatted.slice(0, 2) + ':' + formatted.slice(2, 4);
    }
    if (formatted.length > 5) formatted = formatted.slice(0, 5);

    const updated = [...periods];
    updated[index] = { ...updated[index], [field]: formatted };
    setPeriods(updated);
  };

  const handleContinue = async () => {
    // Validate
    for (const p of periods) {
      if (!p.start_time || !p.end_time) {
        Alert.alert('Incomplete', `Please fill in all times for Period ${p.period_num}.`);
        return;
      }
    }

    await bulkInsertPeriodTimings(db, periods);
    router.push('/(onboarding)/timetable');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepLabel}>STEP 3 OF 4</Text>
        <Text style={styles.title}>Period Timings</Text>
        <Text style={styles.subtitle}>
          Set the start and end times for each period. We've pre-filled common JNTUH timings.
        </Text>

        {periods.map((period, index) => (
          <View key={index} style={styles.periodRow}>
            <View style={styles.periodBadge}>
              <Text style={styles.periodBadgeText}>P{period.period_num}</Text>
            </View>

            <View style={styles.timeInputs}>
              <TextInput
                style={styles.timeInput}
                value={period.start_time}
                onChangeText={(v) => handleTimeChange(index, 'start_time', v)}
                placeholder="09:00"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="numeric"
                maxLength={5}
              />
              <Text style={styles.timeSeparator}>to</Text>
              <TextInput
                style={styles.timeInput}
                value={period.end_time}
                onChangeText={(v) => handleTimeChange(index, 'end_time', v)}
                placeholder="09:50"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemovePeriod(index)}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={20} color={Colors.dark.textMuted} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={handleAddPeriod}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.amber} />
          <Text style={styles.addButtonText}>Add Period</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.dark.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctaButton} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.ctaText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
    paddingTop: 70,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  stepLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.rose,
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom: Spacing.sm,
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
    lineHeight: Typography.size.base * Typography.lineHeight.relaxed,
    marginBottom: Spacing.xl,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  periodBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  periodBadgeText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.amber,
  },
  timeInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeInput: {
    flex: 1,
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.size.base,
    color: Colors.dark.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    fontFamily: Typography.fontFamily.mono,
  },
  timeSeparator: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textMuted,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
    marginTop: Spacing.sm,
  },
  addButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.amber,
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
    paddingTop: Spacing.base,
    gap: Spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  backText: {
    fontSize: Typography.size.base,
    color: Colors.dark.textSecondary,
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
