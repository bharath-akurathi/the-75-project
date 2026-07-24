import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Typography, Spacing, Radius } from '@/lib/theme/tokens';

/**
 * Sign In Screen (FR-1.3)
 * Email/password via Supabase Auth.
 * Google Sign-In button is conditionally rendered based on Expo Go detection (FR-1.7).
 */
export default function SignInScreen() {
  const router = useRouter();
  const { signIn, isExpoGo } = useAuth();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Sign in to sync your attendance across devices
        </Text>

        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {/* Email */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          }]}
          placeholder="you@example.com"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        {/* Password */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          }]}
          placeholder="Your password"
          placeholderTextColor={colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {/* Forgot password */}
        <TouchableOpacity style={styles.forgotButton}>
          <Text style={[styles.forgotText, { color: colors.primary }]}>
            Forgot password?
          </Text>
        </TouchableOpacity>

        {/* Sign In button */}
        <TouchableOpacity
          style={[styles.primaryButton, {
            backgroundColor: loading ? colors.textTertiary : colors.primary,
          }]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* Google Sign-In — hidden in Expo Go (FR-1.7) */}
        {!isExpoGo && (
          <>
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.googleButtonText, { color: colors.text }]}>
                Sign in with Google
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Sign up link */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-up')}
          style={styles.linkButton}
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Don't have an account? <Text style={{ color: colors.primary }}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing['3xl'],
  },
  backButton: {
    marginBottom: Spacing['2xl'],
  },
  backText: {
    ...Typography.body,
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    marginBottom: Spacing['2xl'],
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: Radius.sm,
    marginBottom: Spacing.base,
  },
  errorText: {
    ...Typography.bodySmall,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  forgotText: {
    ...Typography.bodySmall,
  },
  primaryButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  primaryButtonText: {
    ...Typography.button,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...Typography.bodySmall,
  },
  googleButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  googleButtonText: {
    ...Typography.button,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  linkText: {
    ...Typography.bodySmall,
  },
});
