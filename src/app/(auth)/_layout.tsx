import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme/ThemeContext';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="compare" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
