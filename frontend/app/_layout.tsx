import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore, REFRESH_TOKEN_KEY } from '@/store/authStore';
import { authService } from '@/services/authService';
import { signalRService } from '@/services/signalRService';
import { chatService } from '@/services/chatService';
import { useChatStore } from '@/store/chatStore';
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
  const { setAuth, clearAuth, setLoading, isAuthenticated } = useAuthStore();

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

  const setUnreadCount = useChatStore((s) => s.setUnreadCount);
  const incrementUnread = useChatStore((s) => s.incrementUnread);

  useEffect(() => {
    if (isAuthenticated) {
      signalRService.connect().catch(console.warn);
      chatService.getConversations()
        .then((data) => setUnreadCount(data.reduce((sum, c) => sum + c.unreadCount, 0)))
        .catch(() => {});
      return signalRService.onMessage(() => incrementUnread());
    } else {
      signalRService.disconnect().catch(console.warn);
      setUnreadCount(0);
    }
  }, [isAuthenticated, setUnreadCount, incrementUnread]);

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
        <Stack.Screen name="create" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
