import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, ActivityIndicator,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listingService } from '@/services/listingService';
import { chatService } from '@/services/chatService';
import { useAuthStore } from '@/store/authStore';
import { Listing } from '@/types/listing';
import { theme } from '@/constants/theme';
import { markListingsStale } from '@/utils/refreshFlags';

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function load() {
      try {
        const data = await listingService.getById(id);
        setListing(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load listing.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Listing not found.'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isOwner = user?.userId === listing.ownerId;

  const handleFavoritePress = async () => {
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    const prev = listing.isFavorited;
    setListing((l) => l ? { ...l, isFavorited: !l.isFavorited } : l); // optimistic
    try {
      const result = await listingService.toggleFavorite(listing.id);
      setListing((l) => l ? { ...l, isFavorited: result.isFavorited } : l);
      markListingsStale();
    } catch {
      setListing((l) => l ? { ...l, isFavorited: prev } : l);
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image gallery */}
        {listing.imageUrls.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
          >
            {listing.imageUrls.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.galleryPlaceholder}>
            <Text style={styles.galleryPlaceholderText}>🅿️</Text>
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{listing.title}</Text>
            <View style={styles.titleActions}>
              <View style={[styles.badge, !listing.isAvailable && styles.badgeTaken]}>
                <Text style={[styles.badgeText, !listing.isAvailable && styles.badgeTextTaken]}>
                  {listing.isAvailable ? 'Available' : 'Taken'}
                </Text>
              </View>
              {!isOwner && (
                <TouchableOpacity
                  style={styles.heartBtn}
                  onPress={handleFavoritePress}
                  disabled={favoriteLoading}
                  hitSlop={8}
                >
                  <Ionicons
                    name={listing.isFavorited ? 'heart' : 'heart-outline'}
                    size={24}
                    color={listing.isFavorited ? '#EF4444' : theme.colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.price}>
            ${listing.price}<Text style={styles.priceUnit}>/month</Text>
          </Text>

          <Text style={styles.address}>{listing.address}</Text>

          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this spot</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailCard}>
              <DetailRow label="Available from" value={formatDate(listing.startDate)} />
              <View style={styles.divider} />
              <DetailRow label="Available until" value={formatDate(listing.endDate)} />
            </View>
          </View>

          {/* CTA */}
          {!isOwner && (
            <TouchableOpacity
              style={[styles.ctaButton, (!listing.isAvailable || messageLoading) && styles.ctaButtonDisabled]}
              disabled={!listing.isAvailable || messageLoading}
              onPress={async () => {
                if (messageLoading) return;
                setMessageLoading(true);
                try {
                  const conv = await chatService.getOrCreateConversation(listing.id);
                  router.push({
                    pathname: `/conversation/${conv.id}` as `${string}`,
                    params: {
                      title: conv.otherUserName,
                      subtitle: listing.title,
                      listingId: listing.id,
                      listingImageUrl: listing.imageUrls[0] ?? '',
                    },
                  });
                } catch {
                  // silently ignore — user can retry
                } finally {
                  setMessageLoading(false);
                }
              }}
            >
              {messageLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {listing.isAvailable ? 'Message Owner' : 'No longer available'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {isOwner && (
            <View style={styles.ownerNote}>
              <Text style={styles.ownerNoteText}>This is your listing. Manage it in My Spots.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
  gallery: {
    height: 260,
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: 260,
  },
  galleryPlaceholder: {
    height: 220,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPlaceholderText: {
    fontSize: 64,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 4,
  },
  heartBtn: {
    padding: 2,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.text,
    flex: 1,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 4,
  },
  priceUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: theme.colors.textMuted,
  },
  address: {
    fontSize: 15,
    color: theme.colors.textMuted,
    fontWeight: '500',
    marginTop: 4,
  },
  section: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  description: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
  },
  detailCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    ...theme.shadow.card,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  detailValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  ctaButton: {
    marginTop: theme.spacing.lg,
    height: 52,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: '#DCFCE7',
    marginTop: 6,
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
  ownerNote: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
  },
  ownerNoteText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
});
