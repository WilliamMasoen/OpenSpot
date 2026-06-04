import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore, REFRESH_TOKEN_KEY } from '@/store/authStore';
import { authService } from '@/services/authService';
import { signalRService } from '@/services/signalRService';
import { chatService } from '@/services/chatService';
import { userService } from '@/services/userService';
import { useChatStore } from '@/store/chatStore';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '@/constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted'
    ? { status: existing }
    : await Notifications.requestPermissionsAsync();

  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await userService.savePushToken(token);
    return token;
  } catch {
    // Not supported in Expo Go (SDK 53+) — requires a development build.
    return null;
  }
}

export default function RootLayout() {
  const { setAuth, clearAuth, setLoading, setHasSeenOnboarding, isAuthenticated } = useAuthStore();
  const pushTokenRef = useRef<string | null>(null);

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

      registerPushToken()
        .then((token) => { if (token) pushTokenRef.current = token; })
        .catch(() => {});

      return signalRService.onMessage(() => incrementUnread());
    } else {
      signalRService.disconnect().catch(console.warn);
      setUnreadCount(0);

      if (pushTokenRef.current) {
        userService.deletePushToken(pushTokenRef.current).catch(() => {});
        pushTokenRef.current = null;
      }
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
