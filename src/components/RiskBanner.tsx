import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Typography, Spacing, Radius } from '@/lib/theme/tokens';
import type { RegulationMode } from '@/lib/regulation/engine';

interface RiskBannerProps {
  mode: RegulationMode;
  percentage: number;
  threshold: number;
  condonableFloor: number;
  subjectName?: string; // Provided if this is a per-subject warning
}

/**
 * RiskBanner component (FR-5.7)
 * Phase-aware banner that appears when a student is near or below threshold.
 * Uses alarm red *only* for genuine danger.
 */
export function RiskBanner({
  mode,
  percentage,
  threshold,
  condonableFloor,
  subjectName,
}: RiskBannerProps) {
  const { colors } = useTheme();

  // Determine risk level
  let risk: 'safe' | 'warning' | 'danger' | 'critical' = 'safe';
  if (percentage < condonableFloor) risk = 'critical';
  else if (percentage < threshold) risk = 'danger';
  else if (percentage < threshold + 0.03) risk = 'warning'; // Within 3% buffer

  if (risk === 'safe') return null; // Don't show if safe

  const bgColor =
    risk === 'warning' ? colors.warningLight :
    risk === 'danger' ? colors.dangerLight :
    colors.criticalLight;

  const textColor =
    risk === 'warning' ? colors.warning :
    risk === 'danger' ? colors.danger :
    colors.critical;

  // Phase-aware language
  const unit = mode === 'aggregate' ? 'the semester overall' : `this subject (${subjectName})`;
  
  let title = '';
  let description = '';

  if (risk === 'warning') {
    title = 'Buffer is running low';
    description = `You are within 3% of the threshold for ${unit}. Be careful skipping next time.`;
  } else if (risk === 'danger') {
    title = 'Below threshold';
    description = `You are in the condonable band for ${unit}. You may need to submit a medical certificate if you don't recover.`;
  } else if (risk === 'critical') {
    title = 'Critical Danger';
    description = `You are below the absolute condonable floor (65%) for ${unit}. Detention is highly likely unless you attend immediately.`;
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor: textColor }]}>
      <Text style={[styles.title, { color: textColor }]}>⚠️ {title}</Text>
      <Text style={[styles.description, { color: textColor }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.base,
  },
  title: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  description: {
    ...Typography.bodySmall,
  },
});
