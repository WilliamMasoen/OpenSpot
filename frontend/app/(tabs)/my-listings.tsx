import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { useMyListings } from '@/hooks/useListings';
import { Listing } from '@/types/listing';
import { theme } from '@/constants/theme';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

function MyListingRow({ listing, onDelete }: { listing: Listing; onDelete: () => void }) {
  const hasImage = listing.imageUrls?.length > 0;

  const confirmDelete = () => {
    Alert.alert(
      'Delete listing',
      `Are you sure you want to delete "${listing.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={() => router.push(`/listing/${listing.id}`)}>
      {hasImage ? (
        <Image source={{ uri: listing.imageUrls[0] }} style={styles.rowImage} resizeMode="cover" />
      ) : (
        <View style={styles.rowImagePlaceholder}>
          <Text style={styles.rowImagePlaceholderText}>🅿️</Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{listing.title}</Text>
        <Text style={styles.rowAddress} numberOfLines={1}>{listing.address}</Text>
        <Text style={styles.rowDates}>{formatDate(listing.startDate)} – {formatDate(listing.endDate)}</Text>
        <View style={styles.rowFooter}>
          <Text style={styles.rowPrice}>${listing.price}/mo</Text>
          <View style={[styles.badge, !listing.isAvailable && styles.badgeTaken]}>
            <Text style={[styles.badgeText, !listing.isAvailable && styles.badgeTextTaken]}>
              {listing.isAvailable ? 'Available' : 'Taken'}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} hitSlop={8}>
        <Text style={styles.deleteIcon}>🗑</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No listings yet</Text>
      <Text style={styles.emptyBody}>Tap "Post Spot" to list your first parking spot.</Text>
    </View>
  );
}

export default function MyListingsScreen() {
  const { listings, loading, error, refetch, deleteListing } = useMyListings();

  if (loading && listings.length === 0) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <FlatList<Listing>
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MyListingRow
            listing={item}
            onDelete={() => deleteListing(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.heading}>My Spots</Text>
            <Text style={styles.count}>{listings.length} listing{listings.length !== 1 ? 's' : ''}</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: theme.spacing.md,
  },
  heading: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  count: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  separator: {
    height: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    ...theme.shadow.card,
  },
  rowImage: {
    width: 90,
    height: 90,
  },
  rowImagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowImagePlaceholderText: {
    fontSize: 28,
  },
  rowBody: {
    flex: 1,
    padding: theme.spacing.sm,
    gap: 3,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  rowAddress: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  rowDates: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rowPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  deleteButton: {
    padding: theme.spacing.md,
  },
  deleteIcon: {
    fontSize: 18,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: '#DCFCE7',
  },
  badgeTaken: {
    backgroundColor: '#F3F4F6',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16A34A',
  },
  badgeTextTaken: {
    color: theme.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: {
    ...theme.typography.subheading,
    color: theme.colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    margin: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.radius.sm,
  },
  errorBannerText: {
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
  },
});
