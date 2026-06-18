import { useState, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { navigate } from '@/utils/navigate';
import * as Location from 'expo-location';
import { ListingCard } from '@/components/ui/ListingCard';
import { useSearch } from '@/hooks/useSearch';
import { useFavoritesMap } from '@/hooks/useListings';
import { theme } from '@/constants/theme';
import { Listing } from '@/types/listing';

const DEFAULT_RADIUS_KM = 5;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [nearMe, setNearMe] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { results, loading, error, hasSearched, search, clear, updateListing } = useSearch();
  const { getFavorited, toggle } = useFavoritesMap(results, updateListing);

  const requestLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location required', 'Please allow location access in Settings to use near-me search.');
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  };

  const handleNearMeToggle = async () => {
    if (nearMe) {
      setNearMe(false);
      setUserCoords(null);
      if (!query.trim()) { clear(); return; }
      search({ q: query.trim() });
    } else {
      const coords = await requestLocation();
      if (!coords) return;
      setNearMe(true);
      setUserCoords(coords);
      search({ q: query.trim() || undefined, lat: coords.lat, lng: coords.lng, radius: DEFAULT_RADIUS_KM });
    }
  };

  const handleSearch = () => {
    Keyboard.dismiss();
    if (!query.trim() && !nearMe) return;
    search({
      q: query.trim() || undefined,
      lat: userCoords?.lat,
      lng: userCoords?.lng,
      radius: nearMe ? DEFAULT_RADIUS_KM : undefined,
    });
  };

  const handleClear = () => {
    setQuery('');
    setNearMe(false);
    setUserCoords(null);
    clear();
    inputRef.current?.focus();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Search</Text>
          <Text style={styles.subtitle}>Find parking spots by location.</Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Address, neighbourhood…"
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.8}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Near me toggle */}
        <TouchableOpacity
          style={[styles.nearMeBtn, nearMe && styles.nearMeBtnActive]}
          onPress={handleNearMeToggle}
          activeOpacity={0.8}
        >
          <Ionicons
            name={nearMe ? 'location' : 'location-outline'}
            size={16}
            color={nearMe ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.nearMeText, nearMe && styles.nearMeTextActive]}>
            {nearMe ? `Within ${DEFAULT_RADIUS_KM} km` : 'Near me'}
          </Text>
        </TouchableOpacity>

        {/* Results */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : hasSearched ? (
          <FlatList<Listing>
            data={results}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <ListingCard
                listing={item}
                variant="tile"
                isFavorited={getFavorited(item.id)}
                onFavoritePress={() => toggle(item.id)}
                onPress={() => navigate(`/listing/${item.id}`)}
              />
            )}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              results.length > 0 ? (
                <Text style={styles.resultCount}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="search-outline" size={40} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>No spots found</Text>
                <Text style={styles.emptyBody}>Try a different address or expand your search area.</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.centered}>
            <Ionicons name="map-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>Search for a spot</Text>
            <Text style={styles.emptyBody}>
              Enter an address above or tap "Near me" to find spots around you.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  searchRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 50,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
  },
  searchButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  nearMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
  },
  nearMeBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  nearMeText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  nearMeTextActive: {
    color: theme.colors.primary,
  },
  list: {
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  row: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  resultCount: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '500',
    marginBottom: theme.spacing.md,
  },
  centered: {
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
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
  },
});
