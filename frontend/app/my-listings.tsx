import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMyListings } from '@/hooks/useListings';
import { Listing } from '@/types/listing';
import { theme } from '@/constants/theme';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

function MyListingRow({ listing, onDelete, onToggleAvailability }: { listing: Listing; onDelete: () => void; onToggleAvailability: () => void; }) {
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
          <TouchableOpacity
            style={[styles.badge, !listing.isAvailable && styles.badgeRented]}
            onPress={(e) => { e.stopPropagation?.(); onToggleAvailability(); }}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Text style={[styles.badgeText, !listing.isAvailable && styles.badgeTextRented]}>
              {listing.isAvailable ? 'Available' : 'Rented'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.rowActions}>
        <TouchableOpacity onPress={() => router.push(`/edit-listing/${listing.id}` as `${string}`)} hitSlop={8}>
          <Ionicons name="pencil-outline" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function MyListingsScreen() {
  const { listings, loading, error, refetch, deleteListing, toggleAvailability } = useMyListings();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Spots</Text>
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
          renderItem={({ item }) => (
            <MyListingRow
              listing={item}
              onDelete={() => deleteListing(item.id)}
              onToggleAvailability={() => toggleAvailability(item.id, item.isAvailable)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            listings.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.count}>{listings.length} listing{listings.length !== 1 ? 's' : ''}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyBody}>Tap the + button to list your first parking spot.</Text>
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
          <Text style={styles.errorBannerText}>{error}</Text>
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
  separator: { height: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    ...theme.shadow.card,
  },
  rowImage: { width: 90, height: 90 },
  rowImagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowImagePlaceholderText: { fontSize: 28 },
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
  rowActions: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: '#DCFCE7',
  },
  badgeRented: { backgroundColor: '#FEF3C7' },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16A34A',
  },
  badgeTextRented: { color: '#D97706' },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xxl,
  },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.sm },
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
