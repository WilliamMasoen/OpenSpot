import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore, REFRESH_TOKEN_KEY } from '@/store/authStore';
import { authService } from '@/services/authService';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '@/constants/theme';

function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    async function hydrate() {
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const tokenResponse = await authService.refresh(refreshToken);
          await setAuth(tokenResponse);
        }
      } catch {
        await clearAuth();
      } finally {
        setLoading(false);
      }
    }
    hydrate();
  }, []);

  const { isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
