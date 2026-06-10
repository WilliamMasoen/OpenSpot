import { useEffect, useRef, useState } from 'react';
import { Platform, AppState, Modal, View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore, REFRESH_TOKEN_KEY } from '@/store/authStore';
import { authService } from '@/services/authService';
import { signalRService } from '@/services/signalRService';
import { chatService } from '@/services/chatService';
import { userService } from '@/services/userService';
import { ratingService } from '@/services/ratingService';
import { useChatStore } from '@/store/chatStore';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { theme } from '@/constants/theme';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { StarRating } from '@/components/ui/StarRating';
import { PendingRating } from '@/types/user';

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

function PendingRatingModal({
  pending,
  onDone,
}: {
  pending: PendingRating;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (stars === 0) {
      setError('Please select a rating.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await ratingService.create(pending.saleId, stars, comment.trim() || undefined);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit rating.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible animationType="fade" transparent presentationStyle="overFullScreen">
      <View style={ratingStyles.overlay}>
        <View style={ratingStyles.sheet}>
          <Text style={ratingStyles.title}>Rate your experience</Text>
          <Text style={ratingStyles.subtitle}>
            You recently completed a transaction for{' '}
            <Text style={ratingStyles.listingName}>{pending.listingTitle}</Text>
          </Text>

          <View style={ratingStyles.avatar}>
            <AvatarImage name={pending.revieweeName} imageUrl={pending.revieweeProfileImageUrl} size={64} />
            <Text style={ratingStyles.revieweeName}>{pending.revieweeName}</Text>
          </View>

          <StarRating value={stars} onChange={setStars} size={36} />

          <TextInput
            style={ratingStyles.commentInput}
            placeholder="Leave a comment (optional)"
            placeholderTextColor={theme.colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {error ? <Text style={ratingStyles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[ratingStyles.submitBtn, submitting && ratingStyles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={ratingStyles.submitText}>Submit Rating</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onDone} style={ratingStyles.skipBtn}>
            <Text style={ratingStyles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  const { setAuth, clearAuth, setLoading, setHasSeenOnboarding, updateUser, isAuthenticated } = useAuthStore();
  const pushTokenRef = useRef<string | null>(null);
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);

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
          const me = await userService.getMe();
          if (me.profileImageUrl) updateUser({ profileImageUrl: me.profileImageUrl });
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

      const checkPending = () => {
        ratingService.getPending()
          .then((data) => { if (data.length > 0) setPendingRatings(data); })
          .catch(() => {});
      };

      checkPending();

      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') checkPending();
      });

      const unsubSignalR = signalRService.onMessage(() => incrementUnread());
      return () => {
        appStateSub.remove();
        unsubSignalR();
      };
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

  const currentPending = pendingRatings[0] ?? null;

  return (
    <>
      <AuthGuard />
      {currentPending && (
        <PendingRatingModal
          pending={currentPending}
          onDone={() => setPendingRatings((prev) => prev.slice(1))}
        />
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-listing/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="support" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="ratings/[userId]" />
      </Stack>
    </>
  );
}

const ratingStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: theme.spacing.xl,
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  listingName: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  avatar: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  revieweeName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  commentInput: {
    width: '100%',
    minHeight: 80,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.text,
  },
  error: {
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
  },
  submitBtn: {
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  skipBtn: {
    padding: theme.spacing.sm,
  },
  skipText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
