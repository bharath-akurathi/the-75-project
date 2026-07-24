/**
 * The 75 Project — Empty State Component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing } from '@/theme/spacing';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color={Colors.dark.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
    paddingHorizontal: Spacing['2xl'],
  },
  title: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.textSecondary,
    marginTop: Spacing.base,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
