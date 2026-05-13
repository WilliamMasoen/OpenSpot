import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ListingCard } from '@/components/ui/ListingCard';
import { useMyFavorites } from '@/hooks/useListings';
import { theme } from '@/constants/theme';
import { Listing } from '@/types/listing';

export default function FavoritesScreen() {
  const { listings, loading, error, refetch, removeFavorite } = useMyFavorites();

  if (loading && listings.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList<Listing>
        data={listings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            variant="tile"
            isFavorited
            onFavoritePress={() => removeFavorite(item.id)}
            onPress={() => router.push(`/listing/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.heading}>My Favourites</Text>
            <Text style={styles.count}>{listings.length} spot{listings.length !== 1 ? 's' : ''}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="heart-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>No favourites yet</Text>
            <Text style={styles.emptyBody}>
              Tap the heart on any listing to save it here.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={theme.colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
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
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
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
  emptyTitle: {
    ...theme.typography.subheading,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  errorBanner: {
    margin: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.radius.sm,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
  },
});
