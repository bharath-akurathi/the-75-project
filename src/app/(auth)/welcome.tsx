import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Typography, Spacing, Radius } from '@/lib/theme/tokens';
import { Logo } from '@/components/Logo';

/**
 * Welcome Screen (FR-1.1)
 * Two equally prominent paths: create account or continue as guest.
 * Neither is hidden behind the other.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.iconContainer}>
          <Logo size={100} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          The 75 Project
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Track your attendance. Know exactly how many classes you can safely skip.
        </Text>
      </View>

      {/* Feature highlights */}
      <View style={styles.features}>
        {[
          { icon: '📊', text: 'Regulation-aware attendance tracking' },
          { icon: '🔒', text: 'Works fully offline — your data, your device' },
          { icon: '⚡', text: 'Mark attendance in under 10 seconds' },
        ].map((item, i) => (
          <View key={i} style={[styles.featureRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={styles.featureIcon}>{item.icon}</Text>
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
              {item.text}
            </Text>
          </View>
        ))}
      </View>

      {/* Two equally prominent paths (FR-1.1) */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(auth)/sign-up')}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
            Create an Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => router.push('/(auth)/compare')}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Continue as Guest
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          style={styles.linkButton}
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Already have an account? <Text style={{ color: colors.primary }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: Spacing['3xl'],
  },
  heroSection: {
    alignItems: 'center',
    gap: Spacing.base,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    paddingHorizontal: Spacing.base,
    lineHeight: 24,
  },
  features: {
    gap: Spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    ...Typography.bodySmall,
    flex: 1,
  },
  actions: {
    gap: Spacing.md,
  },
  primaryButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...Typography.button,
  },
  secondaryButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    ...Typography.button,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  linkText: {
    ...Typography.bodySmall,
  },
});
