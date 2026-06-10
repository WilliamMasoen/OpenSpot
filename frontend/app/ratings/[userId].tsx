import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ratingService } from '@/services/ratingService';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { StarRating } from '@/components/ui/StarRating';
import { Rating } from '@/types/user';
import { theme } from '@/constants/theme';

function RatingItem({ rating }: { rating: Rating }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <AvatarImage name={rating.reviewerName} imageUrl={rating.reviewerProfileImageUrl} size={36} />
        <View style={styles.itemMeta}>
          <Text style={styles.itemReviewer}>{rating.reviewerName || 'Anonymous'}</Text>
          <Text style={styles.itemDate}>
            {new Date(rating.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <StarRating value={rating.stars} size={14} />
      </View>
      {rating.comment ? (
        <Text style={styles.itemComment}>{rating.comment}</Text>
      ) : null}
    </View>
  );
}

export default function AllRatingsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ratingService.getUserRatings(userId)
      .then(setRatings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Reviews</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={ratings}
          keyExtractor={(r) => r.id}
          renderItem={({ item, index }) => (
            <View>
              <RatingItem rating={item} />
              {index < ratings.length - 1 && <View style={styles.divider} />}
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No reviews yet.</Text>
            </View>
          }
        />
      )}
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
  list: {
    paddingVertical: theme.spacing.sm,
  },
  item: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  itemMeta: {
    flex: 1,
    gap: 2,
  },
  itemReviewer: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  itemDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  itemComment: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    paddingLeft: 50,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
