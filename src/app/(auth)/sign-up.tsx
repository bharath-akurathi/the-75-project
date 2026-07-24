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
 * Sign Up Screen (FR-1.3)
 * Account creation via email/password or Google OAuth.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, isExpoGo } = useAuth();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signUpError } = await signUp(email.trim(), password);
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Get cloud backup and class group features
        </Text>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

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

        <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          }]}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm Password</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          }]}
          placeholder="Re-enter your password"
          placeholderTextColor={colors.textTertiary}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <View style={{ height: Spacing.xl }} />

        <TouchableOpacity
          style={[styles.primaryButton, {
            backgroundColor: loading ? colors.textTertiary : colors.primary,
          }]}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
              Create Account
            </Text>
          )}
        </TouchableOpacity>

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
                Sign up with Google
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          style={styles.linkButton}
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Already have an account? <Text style={{ color: colors.primary }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing['3xl'],
  },
  backButton: { marginBottom: Spacing['2xl'] },
  backText: { ...Typography.body },
  title: { ...Typography.h1, marginBottom: Spacing.sm },
  subtitle: { ...Typography.body, marginBottom: Spacing['2xl'] },
  errorBox: { padding: Spacing.md, borderRadius: Radius.sm, marginBottom: Spacing.base },
  errorText: { ...Typography.bodySmall },
  label: { ...Typography.label, marginBottom: Spacing.sm, marginTop: Spacing.base },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  primaryButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  primaryButtonText: { ...Typography.button },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    gap: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { ...Typography.bodySmall },
  googleButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  googleButtonText: { ...Typography.button },
  linkButton: { alignItems: 'center', marginTop: Spacing.xl, paddingVertical: Spacing.sm },
  linkText: { ...Typography.bodySmall },
});
