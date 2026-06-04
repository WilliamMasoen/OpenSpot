import { useCallback, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { ListingCard } from '@/components/ui/ListingCard';
import { useListings, useFavoritesMap } from '@/hooks/useListings';
import { theme } from '@/constants/theme';
import { Listing } from '@/types/listing';
import { consumeListingsStale } from '@/utils/refreshFlags';

const SORT_OPTIONS = [
  { label: 'Nearest', value: 'nearest' },
  { label: 'Newest', value: undefined as string | undefined },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
];

const PRICE_OPTIONS = [
  { label: 'Any price', value: undefined as number | undefined },
  { label: '< $100', value: 100 },
  { label: '< $200', value: 200 },
  { label: '< $300', value: 300 },
];

function FilterBar({
  sortBy,
  maxPrice,
  onFilterChange,
}: {
  sortBy: string | undefined;
  maxPrice: number | undefined;
  onFilterChange: (sortBy: string | undefined, maxPrice: number | undefined) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterBar}
      keyboardShouldPersistTaps="handled"
    >
      {SORT_OPTIONS.map((opt) => {
        const active = sortBy === opt.value;
        return (
          <TouchableOpacity
            key={opt.label}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onFilterChange(opt.value, maxPrice)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
      <View style={styles.chipDivider} />
      {PRICE_OPTIONS.map((opt) => {
        const active = maxPrice === opt.value;
        return (
          <TouchableOpacity
            key={opt.label}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onFilterChange(sortBy, opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function LoadMoreFooter({ loadingMore }: { loadingMore: boolean }) {
  if (!loadingMore) return null;
  return (
    <View style={styles.footer}>
      <ActivityIndicator color={theme.colors.primary} size="small" />
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🅿️</Text>
      <Text style={styles.emptyTitle}>No spots found</Text>
      <Text style={styles.emptyBody}>Try adjusting your filters or check back later.</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Something went wrong</Text>
      <Text style={styles.emptyBody}>{message}</Text>
      <Text style={styles.retryLink} onPress={onRetry}>Try again</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { listings, totalCount, loading, loadingMore, error, refetch, loadMore, updateListing, sortBy, maxPrice, setFilters, userLat, setLocation } = useListings();
  const { getFavorited, toggle } = useFavoritesMap(listings, updateListing);
  const locationRequested = useRef(false);

  useFocusEffect(useCallback(() => { if (consumeListingsStale()) refetch(); }, [refetch]));

  useEffect(() => {
    async function detectLocation() {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(pos.coords.latitude, pos.coords.longitude);
        if (!locationRequested.current) {
          setFilters('nearest', maxPrice);
          locationRequested.current = true;
        }
      }
    }
    detectLocation();
  }, []);

  const handleFilterChange = useCallback(async (newSortBy: string | undefined, newMaxPrice: number | undefined) => {
    if (newSortBy === 'nearest' && userLat == null) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(pos.coords.latitude, pos.coords.longitude);
      } else {
        return;
      }
    }
    setFilters(newSortBy, newMaxPrice);
  }, [userLat, setLocation, setFilters, maxPrice]);

  if (loading && listings.length === 0) {
    return (
      <ScreenWrapper edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  if (error && listings.length === 0) {
    return (
      <ScreenWrapper edges={['top']}>
        <ErrorState message={error} onRetry={refetch} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={['top']}>
      <FlatList<Listing>
        data={listings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            variant="tile"
            isFavorited={getFavorited(item.id)}
            onFavoritePress={() => toggle(item.id)}
            onPress={() => router.push(`/listing/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.listHeader}>
              <Text style={styles.heading}>Available Spots</Text>
              <Text style={styles.count}>{totalCount} listing{totalCount !== 1 ? 's' : ''}</Text>
            </View>
            <FilterBar sortBy={sortBy} maxPrice={maxPrice} onFilterChange={handleFilterChange} />
            {sortBy === 'nearest' && userLat != null && (
              <View style={styles.locationBanner}>
                <Text style={styles.locationBannerText}>Showing spots nearest to you</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={<LoadMoreFooter loadingMore={loadingMore} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
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
    paddingBottom: theme.spacing.xxl,
  },
  row: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: theme.spacing.sm,
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text,
  },
  chipTextActive: {
    color: '#fff',
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  retryLink: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  locationBannerText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
});
