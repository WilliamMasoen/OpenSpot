import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Listing } from '@/types/listing';
import { theme } from '@/constants/theme';

interface ListingCardProps {
  listing: Listing;
  onPress?: () => void;
  variant?: 'full' | 'tile';
  isFavorited?: boolean;
  onFavoritePress?: () => void;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

function AvailableBadge({ isAvailable }: { isAvailable: boolean }) {
  return (
    <View style={[styles.badge, !isAvailable && styles.badgeTaken]}>
      <Text style={[styles.badgeText, !isAvailable && styles.badgeTextTaken]}>
        {isAvailable ? 'Available' : 'Taken'}
      </Text>
    </View>
  );
}

export function ListingCard({
  listing, onPress, variant = 'full', isFavorited, onFavoritePress,
}: ListingCardProps) {
  const hasImage = listing.imageUrls?.length > 0;

  if (variant === 'tile') {
    return (
      <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.75}>
        <View style={styles.tileImageContainer}>
          {hasImage ? (
            <Image source={{ uri: listing.imageUrls[0] }} style={styles.tileImage} resizeMode="cover" />
          ) : (
            <View style={styles.tileImagePlaceholder}>
              <Ionicons name="car-outline" size={28} color={theme.colors.primary} />
              <Text style={styles.tileImagePlaceholderText}>No photos yet</Text>
            </View>
          )}
          {onFavoritePress !== undefined && (
            <TouchableOpacity style={styles.heartButton} onPress={onFavoritePress} hitSlop={8}>
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={16}
                color={isFavorited ? '#EF4444' : '#fff'}
              />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.tileBody}>
          <Text style={styles.tileTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.tileAddress} numberOfLines={1}>{listing.address}</Text>
          <View style={styles.tileFooter}>
            <Text style={styles.tilePrice}>${listing.price}<Text style={styles.tilePriceUnit}>/mo</Text></Text>
            <AvailableBadge isAvailable={listing.isAvailable} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {hasImage ? (
        <Image source={{ uri: listing.imageUrls[0] }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Ionicons name="car-outline" size={36} color={theme.colors.primary} />
          <Text style={styles.cardImagePlaceholderText}>No photos yet</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
          <AvailableBadge isAvailable={listing.isAvailable} />
        </View>
        <Text style={styles.address} numberOfLines={1}>{listing.address}</Text>
        {listing.description ? (
          <Text style={styles.description} numberOfLines={2}>{listing.description}</Text>
        ) : null}
        <View style={styles.bottomRow}>
          <Text style={styles.price}>${listing.price}<Text style={styles.priceUnit}>/mo</Text></Text>
          <Text style={styles.dates}>{formatDate(listing.startDate)} – {formatDate(listing.endDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── Full card ──────────────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardBody: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.subheading,
    color: theme.colors.text,
    flex: 1,
  },
  address: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  priceUnit: {
    fontSize: 13,
    fontWeight: '400',
    color: theme.colors.textMuted,
  },
  dates: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  // ── Tile (grid) ────────────────────────────────────────────────
  tile: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  tileImageContainer: {
    position: 'relative',
  },
  tileImage: {
    width: '100%',
    height: 110,
  },
  tileImagePlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileImagePlaceholderText: {
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardImagePlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  heartButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: {
    padding: theme.spacing.sm,
    gap: 4,
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  tileAddress: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tilePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  tilePriceUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: theme.colors.textMuted,
  },

  // ── Shared badge ───────────────────────────────────────────────
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
});
