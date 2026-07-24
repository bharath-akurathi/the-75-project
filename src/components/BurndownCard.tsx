import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Typography, Spacing, Radius, Shadow } from '@/lib/theme/tokens';
import type { BurndownResult } from '@/lib/regulation/engine';

interface BurndownCardProps {
  result: BurndownResult;
}

/**
 * BurndownCard component (FR-5.4)
 * Displays the worst-case burndown date. Stable by construction.
 */
export function BurndownCard({ result }: BurndownCardProps) {
  const { colors } = useTheme();

  const isSafe = result.isSafeForSemester;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, Shadow.sm]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        WORST-CASE DANGER DATE
      </Text>
      
      <Text style={[styles.dateText, { color: isSafe ? colors.safe : colors.danger }]}>
        {isSafe 
          ? 'Safe for the semester ✓' 
          : result.dangerDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        }
      </Text>
      
      <Text style={[styles.noteText, { color: colors.textTertiary }]}>
        {isSafe 
          ? 'Even if you skip every remaining class, you stay above threshold.'
          : `If you never attend another class, you'll cross the threshold on this date.`
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  dateText: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  noteText: {
    ...Typography.bodySmall,
  },
});
