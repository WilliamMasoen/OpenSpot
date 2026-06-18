import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, ActivityIndicator,
  TouchableOpacity, Dimensions, Modal, FlatList, Animated, Easing, Pressable,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { listingService } from '@/services/listingService';
import { chatService } from '@/services/chatService';
import { userService } from '@/services/userService';
import { useAuthStore } from '@/store/authStore';
import { Listing } from '@/types/listing';
import { ConversationBuyer } from '@/types/user';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { StarRating } from '@/components/ui/StarRating';
import { theme } from '@/constants/theme';
import { markListingsStale } from '@/utils/refreshFlags';

const SAFETY_TOAST_KEY = 'safetyToastDate';

function SafetyToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>
        Safety first — always meet in a public place and verify the spot before transferring any payment.
      </Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={8} style={styles.toastClose}>
        <Ionicons name="close" size={16} color="#92400E" />
      </TouchableOpacity>
    </View>
  );
}

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

const SHEET_TRANSLATE = 400;

function BuyerPickerModal({
  visible,
  buyers,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  buyers: ConversationBuyer[];
  onSelect: (buyer: ConversationBuyer) => void;
  onCancel: () => void;
}) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(SHEET_TRANSLATE)).current;

  useEffect(() => {
    if (visible) {
      backdropAnim.setValue(0);
      sheetAnim.setValue(SHEET_TRANSLATE);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(sheetAnim,   { toValue: 0, duration: 300, easing: Easing.out(Easing.poly(4)), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(sheetAnim,   { toValue: SHEET_TRANSLATE, duration: 240, easing: Easing.in(Easing.poly(4)), useNativeDriver: true }),
    ]).start(() => cb());
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <View style={styles.modalOuter}>
        <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onCancel)} />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: sheetAnim }], alignSelf: 'stretch' }}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Who rented this spot?</Text>
              <TouchableOpacity onPress={() => dismiss(onCancel)} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Select the buyer from conversations about this listing.</Text>

            {buyers.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No conversations yet — can't mark as rented.</Text>
              </View>
            ) : (
              <ScrollView style={styles.buyerList} bounces={false}>
                {buyers.map((item, index) => (
                  <View key={item.id}>
                    <TouchableOpacity style={styles.buyerRow} onPress={() => dismiss(() => onSelect(item))} activeOpacity={0.7}>
                      <AvatarImage name={item.name} imageUrl={item.profileImageUrl} size={40} />
                      <Text style={styles.buyerName}>{item.name}</Text>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                    {index < buyers.length - 1 && <View style={styles.buyerDivider} />}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showBuyerPicker, setShowBuyerPicker] = useState(false);
  const [buyers, setBuyers] = useState<ConversationBuyer[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const hasLoaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!hasLoaded.current) setLoading(true);
        try {
          const data = await listingService.getById(id);
          setListing(data);
          hasLoaded.current = true;
        } catch (e: unknown) {
          if (!hasLoaded.current) setError(e instanceof Error ? e.message : 'Failed to load listing.');
        } finally {
          setLoading(false);
        }
      }
      load();
    }, [id])
  );

  useEffect(() => {
    SecureStore.getItemAsync(SAFETY_TOAST_KEY).then((stored) => {
      const today = new Date().toISOString().split('T')[0];
      setShowToast(stored !== today);
    });
  }, []);

  const handleDismissToast = async () => {
    setShowToast(false);
    await SecureStore.setItemAsync(SAFETY_TOAST_KEY, new Date().toISOString().split('T')[0]);
  };

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
    setListing((l) => l ? { ...l, isFavorited: !l.isFavorited } : l);
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

  const handleMarkAsRented = async () => {
    if (availabilityLoading || buyersLoading) return;
    setBuyersLoading(true);
    try {
      const data = await userService.getConversationBuyers(listing.id);
      setBuyers(data);
      setShowBuyerPicker(true);
    } catch {
      setBuyers([]);
      setShowBuyerPicker(true);
    } finally {
      setBuyersLoading(false);
    }
  };

  const handleBuyerSelected = async (buyer: ConversationBuyer) => {
    setShowBuyerPicker(false);
    setAvailabilityLoading(true);
    try {
      await userService.createSale(listing.id, buyer.id);
      setListing((l) => l ? { ...l, isAvailable: false } : l);
      markListingsStale();
    } catch {
      // silently ignore — listing stays available
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleMarkAsAvailable = async () => {
    if (availabilityLoading) return;
    setAvailabilityLoading(true);
    setListing((l) => l ? { ...l, isAvailable: true } : l);
    try {
      await listingService.setAvailability(listing.id, true);
      markListingsStale();
    } catch {
      setListing((l) => l ? { ...l, isAvailable: false } : l);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BuyerPickerModal
        visible={showBuyerPicker}
        buyers={buyers}
        onSelect={handleBuyerSelected}
        onCancel={() => setShowBuyerPicker(false)}
      />

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
              <View style={[styles.badge, !listing.isAvailable && styles.badgeRented]}>
                <Text style={[styles.badgeText, !listing.isAvailable && styles.badgeTextRented]}>
                  {listing.isAvailable ? 'Available' : 'Rented'}
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

          {/* Owner info */}
          {!isOwner && listing.ownerName ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Owner</Text>
              <TouchableOpacity
                style={styles.ownerCard}
                onPress={() => router.push(`/user/${listing.ownerId}` as `${string}`)}
                activeOpacity={0.8}
              >
                <AvatarImage name={listing.ownerName} imageUrl={listing.ownerProfileImageUrl} size={48} />
                <View style={styles.ownerInfo}>
                  <Text style={styles.ownerName}>{listing.ownerName}</Text>
                  {listing.ownerTotalRatings > 0 ? (
                    <View style={styles.ownerRatingRow}>
                      <StarRating value={Math.round(listing.ownerAverageRating ?? 0)} size={13} />
                      <Text style={styles.ownerRatingText}>
                        {(listing.ownerAverageRating ?? 0).toFixed(1)} ({listing.ownerTotalRatings})
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.ownerNoRating}>No reviews yet</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : null}

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
                      otherUserId: conv.otherUserId,
                      otherUserProfileImageUrl: listing.ownerProfileImageUrl ?? '',
                    },
                  });
                } catch {
                  // silently ignore
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

          {!isOwner && listing.isAvailable && showToast && (
            <SafetyToast onDismiss={handleDismissToast} />
          )}

          {isOwner && (
            <View style={styles.ownerActions}>
              <View style={styles.ownerActionsRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => router.push(`/edit-listing/${listing.id}` as `${string}`)}
                >
                  <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.editButtonText}>Edit Listing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mySpotsButton}
                  onPress={() => router.push('/my-listings')}
                >
                  <Text style={styles.mySpotsButtonText}>My Spots</Text>
                </TouchableOpacity>
              </View>

              {listing.isAvailable ? (
                <TouchableOpacity
                  style={[styles.availabilityButton, styles.availabilityButtonRent]}
                  onPress={handleMarkAsRented}
                  disabled={availabilityLoading || buyersLoading}
                >
                  {availabilityLoading || buyersLoading ? (
                    <ActivityIndicator size="small" color="#D97706" />
                  ) : (
                    <Text style={[styles.availabilityButtonText, styles.availabilityTextRent]}>
                      Mark as Rented
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.availabilityButton, styles.availabilityButtonAvail]}
                  onPress={handleMarkAsAvailable}
                  disabled={availabilityLoading}
                >
                  {availabilityLoading ? (
                    <ActivityIndicator size="small" color="#16A34A" />
                  ) : (
                    <Text style={[styles.availabilityButtonText, styles.availabilityTextAvail]}>
                      Mark as Available
                    </Text>
                  )}
                </TouchableOpacity>
              )}
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
  ownerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadow.card,
  },
  ownerInfo: {
    flex: 1,
    gap: 4,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  ownerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerRatingText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  ownerNoRating: {
    fontSize: 13,
    color: theme.colors.textMuted,
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
  badgeRented: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  badgeTextRented: {
    color: '#D97706',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
  },
  toastClose: {
    marginTop: 1,
  },
  ownerActions: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  ownerActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  mySpotsButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
  },
  mySpotsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  availabilityButton: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityButtonRent: {
    backgroundColor: '#FEF3C7',
  },
  availabilityButtonAvail: {
    backgroundColor: '#DCFCE7',
  },
  availabilityButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  availabilityTextRent: {
    color: '#D97706',
  },
  availabilityTextAvail: {
    color: '#16A34A',
  },
  // Buyer picker modal
  modalOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 2,
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  modalEmpty: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  buyerList: {
    maxHeight: 320,
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  buyerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
  },
  buyerDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 72,
  },
});
