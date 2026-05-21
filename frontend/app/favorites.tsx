import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ListingCard } from '@/components/ui/ListingCard';
import { useMyFavorites } from '@/hooks/useListings';
import { theme } from '@/constants/theme';
import { Listing } from '@/types/listing';

export default function FavoritesScreen() {
  const { listings, loading, error, refetch, removeFavorite } = useMyFavorites();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Favourites</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading && listings.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : (
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
            listings.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.count}>{listings.length} spot{listings.length !== 1 ? 's' : ''}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>No favourites yet</Text>
              <Text style={styles.emptyBody}>Tap the heart on any listing to save it here.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={theme.colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  list: {
    flexGrow: 1,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  listHeader: {
    marginBottom: theme.spacing.sm,
  },
  count: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  row: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
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
