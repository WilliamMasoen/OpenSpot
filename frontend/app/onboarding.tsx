import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/authStore';
import { theme } from '@/constants/theme';

const ONBOARDING_KEY = 'hasSeenOnboarding';

const SLIDES = [
  {
    icon: '🅿️',
    title: 'Find Your\nPerfect Spot',
    body: 'Browse available parking spots near you. Filter by location, date, and price to find the ideal match.',
  },
  {
    icon: '💸',
    title: 'List Your\nSpace',
    body: 'Have an empty driveway or garage? Post it in minutes and earn reliable monthly income.',
  },
  {
    icon: '💬',
    title: 'Chat with\nOwners',
    body: 'Message spot owners directly — no middlemen, no agents. Arrange everything on your own terms.',
  },
  {
    icon: '👤',
    title: 'Everything\nin One Place',
    body: "Manage your listings, browse your favourites, and update your account — all from your profile.",
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const setHasSeenOnboarding = useAuthStore((s) => s.setHasSeenOnboarding);

  const goTo = (index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goTo(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      goTo(currentIndex - 1);
    }
  };

  const handleGetStarted = async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    setHasSeenOnboarding(true);
    router.replace('/(auth)/login');
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Navigation */}
      <View style={styles.nav}>
        <TouchableOpacity
          style={[styles.backBtn, currentIndex === 0 && styles.hidden]}
          onPress={handleBack}
          hitSlop={12}
        >
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        {isLast ? (
          <TouchableOpacity style={styles.getStartedBtn} onPress={handleGetStarted} activeOpacity={0.85}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skip} onPress={handleGetStarted}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: 120,
    gap: theme.spacing.lg,
  },
  icon: {
    fontSize: 88,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  body: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: theme.spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  backBtn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  hidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  backBtnText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  nextBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.full,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  getStartedBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginLeft: theme.spacing.md,
  },
  getStartedText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  skip: {
    alignItems: 'center',
    paddingBottom: theme.spacing.lg,
  },
  skipText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
