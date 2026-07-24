/**
 * The 75 Project — Mode Selection Screen (Onboarding Step 2)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { setCalculationMode } from '@/lib/database/queries';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

type Mode = 'aggregate' | 'per_subject';

export default function ModeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [selectedMode, setSelectedMode] = useState<Mode>('aggregate');

  const handleSelect = (mode: Mode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMode(mode);
  };

  const handleContinue = async () => {
    await setCalculationMode(db, selectedMode);
    router.push('/(onboarding)/semester');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.stepLabel}>STEP 1 OF 4</Text>
        <Text style={styles.title}>Calculation Mode</Text>
        <Text style={styles.subtitle}>
          How does your college calculate attendance?
        </Text>

        {/* Aggregate Option */}
        <TouchableOpacity
          style={[styles.optionCard, selectedMode === 'aggregate' && styles.optionCardSelected]}
          onPress={() => handleSelect('aggregate')}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <View style={[styles.radio, selectedMode === 'aggregate' && styles.radioSelected]}>
              {selectedMode === 'aggregate' && <View style={styles.radioInner} />}
            </View>
            <Text style={[styles.optionTitle, selectedMode === 'aggregate' && styles.optionTitleSelected]}>
              Aggregate
            </Text>
          </View>
          <Text style={styles.optionDescription}>
            75% calculated across ALL subjects combined.{'\n'}
            Common for B.Tech / Early IDP semesters.
          </Text>
          <View style={styles.optionExample}>
            <Ionicons name="calculator-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.optionExampleText}>
              Total Attended / Total Held ≥ 75%
            </Text>
          </View>
        </TouchableOpacity>

        {/* Per-Subject Option */}
        <TouchableOpacity
          style={[styles.optionCard, selectedMode === 'per_subject' && styles.optionCardSelected]}
          onPress={() => handleSelect('per_subject')}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <View style={[styles.radio, selectedMode === 'per_subject' && styles.radioSelected]}>
              {selectedMode === 'per_subject' && <View style={styles.radioInner} />}
            </View>
            <Text style={[styles.optionTitle, selectedMode === 'per_subject' && styles.optionTitleSelected]}>
              Per Subject
            </Text>
          </View>
          <Text style={styles.optionDescription}>
            75% calculated individually for each subject.{'\n'}
            Common for M.Tech / Late IDP semesters.
          </Text>
          <View style={styles.optionExample}>
            <Ionicons name="list-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.optionExampleText}>
              Each Subject Attended / Held ≥ 75%
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
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
    marginBottom: Spacing['2xl'],
  },
  optionCard: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  optionCardSelected: {
    borderColor: Colors.rose,
    backgroundColor: 'rgba(225, 29, 72, 0.06)',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.dark.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  radioSelected: {
    borderColor: Colors.rose,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.rose,
  },
  optionTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
  },
  optionTitleSelected: {
    color: Colors.rose,
  },
  optionDescription: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textSecondary,
    marginLeft: 34,
    lineHeight: Typography.size.sm * Typography.lineHeight.relaxed,
    marginBottom: Spacing.sm,
  },
  optionExample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 34,
    backgroundColor: Colors.dark.bgElevated,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  optionExampleText: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    fontFamily: Typography.fontFamily.mono,
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
