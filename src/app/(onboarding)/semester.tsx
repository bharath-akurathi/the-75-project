/**
 * The 75 Project — Semester Start Date Screen (Onboarding Step 3)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { setSemesterStart, setSemesterEnd } from '@/lib/database/queries';
import { formatDate, formatDateDisplay } from '@/utils/dateHelpers';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

export default function SemesterScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().setMonth(new Date().getMonth() + 6)));
  const [showStartPicker, setShowStartPicker] = useState(Platform.OS === 'ios');
  const [showEndPicker, setShowEndPicker] = useState(Platform.OS === 'ios');

  const handleStartDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (selectedDate) setStartDate(selectedDate);
  };

  const handleEndDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (selectedDate) setEndDate(selectedDate);
  };

  const handleContinue = async () => {
    await setSemesterStart(db, formatDate(startDate));
    await setSemesterEnd(db, formatDate(endDate));
    router.push('/(onboarding)/periods');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.stepLabel}>STEP 2 OF 4</Text>
        <Text style={styles.title}>Semester Dates</Text>
        <Text style={styles.subtitle}>
          When does your current semester start and end? This helps calculate how many classes have been held.
        </Text>

        {/* Start Date Display */}
        <Text style={styles.fieldLabel}>SEMESTER START</Text>
        <TouchableOpacity
          style={styles.dateCard}
          onPress={() => setShowStartPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={24} color={Colors.amber} />
          <View style={styles.dateInfo}>
            <Text style={styles.dateLabel}>Start Date</Text>
            <Text style={styles.dateValue}>{formatDateDisplay(startDate)}, {startDate.getFullYear()}</Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={Colors.dark.textMuted} />
        </TouchableOpacity>

        {showStartPicker && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleStartDateChange}
              maximumDate={new Date()}
              themeVariant="dark"
            />
          </View>
        )}

        {/* End Date Display */}
        <Text style={[styles.fieldLabel, { marginTop: Spacing.xl }]}>SEMESTER END</Text>
        <TouchableOpacity
          style={styles.dateCard}
          onPress={() => setShowEndPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={24} color={Colors.rose} />
          <View style={styles.dateInfo}>
            <Text style={styles.dateLabel}>End Date</Text>
            <Text style={styles.dateValue}>{formatDateDisplay(endDate)}, {endDate.getFullYear()}</Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={Colors.dark.textMuted} />
        </TouchableOpacity>

        {showEndPicker && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleEndDateChange}
              minimumDate={startDate}
              themeVariant="dark"
            />
          </View>
        )}
      </View>

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
    justifyContent: 'space-between',
    paddingTop: 70,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
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
    marginBottom: Spacing['2xl'],
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: Spacing.base,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
  },
  fieldLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.textMuted,
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom: Spacing.sm,
  },
  pickerContainer: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.base,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
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
