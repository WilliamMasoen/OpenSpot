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

const ONBOARDING_KEY = 'hasSeenOnboarding';

function AuthGuard() {
  const { isAuthenticated, isLoading, hasSeenOnboarding } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!hasSeenOnboarding) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup && !inOnboarding) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, hasSeenOnboarding, segments]);

  return null;
}

export default function RootLayout() {
  const { setAuth, clearAuth, setLoading, setHasSeenOnboarding, isAuthenticated } = useAuthStore();

  useEffect(() => {
    async function hydrate() {
      try {
        const [onboarded, refreshToken] = await Promise.all([
          SecureStore.getItemAsync(ONBOARDING_KEY),
          SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        ]);
        setHasSeenOnboarding(onboarded === 'true');
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
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-listing/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
