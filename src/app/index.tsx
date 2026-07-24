import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';

/**
 * Entry point — redirects based on auth state:
 * - Loading: spinner
 * - Authenticated: main app tabs
 * - Guest with profile set up: main app tabs
 * - No session, no guest: welcome screen
 */
export default function Index() {
  const { mode } = useAuth();
  const { colors } = useTheme();

  if (mode === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (mode === 'authenticated' || mode === 'guest') {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
