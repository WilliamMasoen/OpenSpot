import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '@/services/userService';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { StarRating } from '@/components/ui/StarRating';
import { ListingCard } from '@/components/ui/ListingCard';
import { UserProfile, Rating } from '@/types/user';
import { theme } from '@/constants/theme';

function RatingCard({ rating }: { rating: Rating }) {
  return (
    <View style={styles.ratingCard}>
      <View style={styles.ratingHeader}>
        <AvatarImage name={rating.reviewerName} imageUrl={rating.reviewerProfileImageUrl} size={34} />
        <View style={styles.ratingMeta}>
          <Text style={styles.ratingReviewer}>{rating.reviewerName || 'Anonymous'}</Text>
          <Text style={styles.ratingDate}>
            {new Date(rating.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <StarRating value={rating.stars} size={14} />
      </View>
      {rating.comment ? (
        <Text style={styles.ratingComment}>{rating.comment}</Text>
      ) : null}
    </View>
  );
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    userService.getProfile(id)
      .then(setProfile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'User not found.'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'User';
  const memberYear = new Date(profile.memberSince).getFullYear();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <AvatarImage name={fullName} imageUrl={profile.profileImageUrl} size={80} />
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.memberSince}>Member since {memberYear}</Text>

          {profile.totalRatings > 0 && (
            <View style={styles.ratingRow}>
              <StarRating value={Math.round(profile.averageRating ?? 0)} size={18} />
              <Text style={styles.ratingText}>
                {(profile.averageRating ?? 0).toFixed(1)} ({profile.totalRatings} {profile.totalRatings === 1 ? 'review' : 'reviews'})
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.listingCount}</Text>
              <Text style={styles.statLabel}>{profile.listingCount === 1 ? 'Listing' : 'Listings'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.totalRatings}</Text>
              <Text style={styles.statLabel}>{profile.totalRatings === 1 ? 'Review' : 'Reviews'}</Text>
            </View>
          </View>
        </View>

        {/* Listings */}
        {profile.listings.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Listings</Text>
            {profile.listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onPress={() => router.push(`/listing/${listing.id}` as `${string}`)}
              />
            ))}
          </>
        )}

        {/* Recent ratings */}
        {profile.recentRatings.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recent Reviews</Text>
            <View style={styles.ratingsCard}>
              {profile.recentRatings.map((r, i) => (
                <View key={r.id}>
                  <RatingCard rating={r} />
                  {i < profile.recentRatings.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>

            {profile.totalRatings > 3 && (
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={() => router.push(`/ratings/${id}` as `${string}`)}
              >
                <Text style={styles.seeAllText}>See all {profile.totalRatings} reviews</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </>
        )}

        {profile.listings.length === 0 && profile.recentRatings.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No listings or reviews yet.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  errorText: {
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  backLink: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
  },
  hero: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadow.card,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  memberSince: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.lg,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  ratingsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  ratingCard: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ratingMeta: {
    flex: 1,
    gap: 2,
  },
  ratingReviewer: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  ratingDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  ratingComment: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    paddingLeft: 46,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: theme.spacing.md,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
