/**
 * The 75 Project — Subject Row Component
 * Used in Insights for per-subject attendance display
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

interface SubjectRowProps {
  subjectName: string;
  percentage: number;
  safeBunks: number;
  classesNeeded: number;
  held: number;
  attended: number;
}

export function SubjectRow({
  subjectName,
  percentage,
  safeBunks,
  classesNeeded,
  held,
  attended,
}: SubjectRowProps) {
  const getColor = () => {
    if (percentage >= 85) return Colors.success;
    if (percentage >= 75) return Colors.amber;
    return Colors.danger;
  };

  const color = getColor();
  const barWidth = Math.min(100, Math.max(0, percentage));
  const isInDanger = percentage < 75;
  const isSafe = safeBunks > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subjectName} numberOfLines={1}>{subjectName}</Text>
        <View style={styles.percentageContainer}>
          <Text style={[styles.percentage, { color }]}>{Math.round(percentage)}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: color }]} />
        {/* 75% marker */}
        <View style={styles.thresholdLine} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>{attended}/{held} attended</Text>
        <View style={styles.bunkInfo}>
          {isSafe ? (
            <>
              <Ionicons name="shield-checkmark" size={13} color={Colors.success} />
              <Text style={[styles.bunkText, { color: Colors.success }]}>
                Can skip {safeBunks}
              </Text>
            </>
          ) : isInDanger ? (
            <>
              <Ionicons name="warning" size={13} color={Colors.danger} />
              <Text style={[styles.bunkText, { color: Colors.danger }]}>
                Need {classesNeeded} more
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle" size={13} color={Colors.amber} />
              <Text style={[styles.bunkText, { color: Colors.amber }]}>
                At the edge
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  subjectName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentage: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  barContainer: {
    height: 6,
    backgroundColor: Colors.dark.border,
    borderRadius: 3,
    marginBottom: Spacing.sm,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  thresholdLine: {
    position: 'absolute',
    left: '75%',
    top: -3,
    bottom: -3,
    width: 1.5,
    backgroundColor: Colors.dark.textMuted,
    borderRadius: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
  },
  bunkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bunkText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
});
