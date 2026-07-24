/**
 * The 75 Project — Attendance Ring Component
 * Circular progress indicator for attendance percentage
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';

interface AttendanceRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export function AttendanceRing({
  percentage,
  size = 180,
  strokeWidth = 12,
  label,
  sublabel,
}: AttendanceRingProps) {
  const getColor = () => {
    if (percentage >= 85) return Colors.success;
    if (percentage >= 75) return Colors.amber;
    return Colors.danger;
  };

  const displayPercentage = Math.min(100, Math.max(0, percentage));
  const color = getColor();

  // Ring dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPercentage = (displayPercentage / 100) * circumference;
  const dashOffset = circumference - fillPercentage;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background ring */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: Colors.dark.border,
          },
        ]}
      />

      {/* Foreground ring (simplified - using a partial border) */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderRightColor: displayPercentage < 25 ? 'transparent' : color,
            borderBottomColor: displayPercentage < 50 ? 'transparent' : color,
            borderLeftColor: displayPercentage < 75 ? 'transparent' : color,
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      />

      {/* Center content */}
      <View style={styles.centerContent}>
        <Text style={[styles.percentageText, { color }]}>
          {Math.round(percentage)}%
        </Text>
        {label && <Text style={styles.label}>{label}</Text>}
        {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: Typography.size['3xl'],
    fontWeight: Typography.weight.heavy,
    letterSpacing: Typography.letterSpacing.tight,
  },
  label: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  sublabel: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
});
