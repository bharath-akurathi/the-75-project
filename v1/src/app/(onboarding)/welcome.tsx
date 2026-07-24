/**
 * The 75 Project — Welcome Screen (Onboarding Step 1)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '@/components/Logo';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Logo size={100} />
        </View>

        {/* Title */}
        <Text style={styles.title}>The 75 Project</Text>
        <Text style={styles.subtitle}>
          Track your attendance the smart way.{'\n'}
          Mark absences, not presences.
        </Text>

        {/* Features */}
        <View style={styles.features}>
          {[
            { icon: 'shield-checkmark-outline' as const, text: '100% offline — your data stays on your device' },
            { icon: 'flash-outline' as const, text: 'One-tap absence marking' },
            { icon: 'analytics-outline' as const, text: 'Know exactly how many classes you can skip' },
          ].map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={20} color={Colors.rose} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/(onboarding)/mode')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Unofficial. Built by a student, for students.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
    justifyContent: 'space-between',
    paddingTop: 80,
  },
  content: {
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: Spacing['2xl'],
  },
  title: {
    fontSize: Typography.size['3xl'],
    fontWeight: Typography.weight.heavy,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
    letterSpacing: Typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: Typography.size.base,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.size.base * Typography.lineHeight.relaxed,
    marginBottom: Spacing['3xl'],
  },
  features: {
    width: '100%',
    gap: Spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  featureText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.dark.textSecondary,
    lineHeight: Typography.size.sm * Typography.lineHeight.normal,
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
    marginBottom: Spacing.base,
  },
  ctaText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
  disclaimer: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
});
