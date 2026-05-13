import { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { ListingCard } from '@/components/ui/ListingCard';
import { useListings } from '@/hooks/useListings';
import { theme } from '@/constants/theme';
import { Listing } from '@/types/listing';
import { consumeListingsStale } from '@/utils/refreshFlags';

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🅿️</Text>
      <Text style={styles.emptyTitle}>No spots yet</Text>
      <Text style={styles.emptyBody}>Be the first to post a parking spot in your building.</Text>
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
  const { listings, loading, error, refetch } = useListings();

  useFocusEffect(useCallback(() => { if (consumeListingsStale()) refetch(); }, [refetch]));

  if (loading && listings.length === 0) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  if (error && listings.length === 0) {
    return (
      <ScreenWrapper>
        <ErrorState message={error} onRetry={refetch} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <FlatList<Listing>
        data={listings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            variant="tile"
            onPress={() => router.push(`/listing/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.heading}>Available Spots</Text>
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
  row: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
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
});
