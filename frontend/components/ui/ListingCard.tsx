import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Listing } from '@/types/listing';
import { theme } from '@/constants/theme';

interface ListingCardProps {
  listing: Listing;
  onPress?: () => void;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

export function ListingCard({ listing, onPress }: ListingCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
        <View style={[styles.badge, !listing.isAvailable && styles.badgeTaken]}>
          <Text style={[styles.badgeText, !listing.isAvailable && styles.badgeTextTaken]}>
            {listing.isAvailable ? 'Available' : 'Taken'}
          </Text>
        </View>
      </View>

      <Text style={styles.address} numberOfLines={1}>{listing.address}</Text>

      {listing.description ? (
        <Text style={styles.description} numberOfLines={2}>{listing.description}</Text>
      ) : null}

      <View style={styles.bottomRow}>
        <Text style={styles.price}>${listing.price}<Text style={styles.priceUnit}>/mo</Text></Text>
        <Text style={styles.dates}>
          {formatDate(listing.startDate)} – {formatDate(listing.endDate)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadow.card,
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: '#DCFCE7',
  },
  badgeTaken: {
    backgroundColor: '#F3F4F6',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  badgeTextTaken: {
    color: theme.colors.textMuted,
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
    marginTop: 2,
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
});
