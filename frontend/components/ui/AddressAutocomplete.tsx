import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { theme } from '@/constants/theme';

interface Suggestion {
  address: string;
  lat: number;
  lng: number;
}

interface PhotonProperties {
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  locality?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: PhotonProperties;
}

interface PhotonResponse {
  features: PhotonFeature[];
}

const FALLBACK_COORDS = { lat: 43.6532, lng: -79.3832 }; // downtown Toronto

function formatAddress(p: PhotonProperties): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const city = p.city ?? p.locality ?? '';
  const region = p.state ?? '';
  const parts = [street, city, region].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : (p.name ?? '');
}

interface AddressAutocompleteProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (address: string, lat: number, lng: number) => void;
  error?: string;
}

export function AddressAutocomplete({
  label, value, onChangeText, onSelectAddress, error,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  const getCoords = useCallback(async () => {
    if (locationRef.current) return locationRef.current;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        locationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        return locationRef.current;
      }
    } catch {}
    return FALLBACK_COORDS;
  }, []);

  const fetchSuggestions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const coords = await getCoords();
        // Photon supports prefix/fuzzy matching and ranks by proximity to lat/lon
        const url =
          `https://photon.komoot.io/api/` +
          `?q=${encodeURIComponent(text)}` +
          `&lat=${coords.lat}&lon=${coords.lng}` +
          `&limit=6&lang=en`;

        const res = await fetch(url);
        const data: PhotonResponse = await res.json();

        const results = data.features
          .map((f) => ({
            address: formatAddress(f.properties),
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          }))
          .filter((s) => s.address.length > 0);

        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setFetching(false);
      }
    }, 500);
  }, [getCoords]);

  const handleChangeText = (text: string) => {
    onChangeText(text);
    fetchSuggestions(text);
  };

  const handleSelect = (s: Suggestion) => {
    onChangeText(s.address);
    onSelectAddress(s.address, s.lat, s.lng);
    setSuggestions([]);
  };

  return (
    // Always elevated — static style prevents keyboard dismiss on re-render
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder="e.g. 123 Bay St, Toronto, ON"
          placeholderTextColor={theme.colors.textMuted}
          textContentType="none"
          autoComplete="off"
          autoCapitalize="words"
        />
        {fetching && (
          <ActivityIndicator size="small" color={theme.colors.primary} style={styles.spinner} />
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.suggestion, i < suggestions.length - 1 && styles.suggestionDivider]}
              onPress={() => handleSelect(s)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText} numberOfLines={2}>
                {s.address}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
    elevation: 100,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  field: {
    height: 50,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
  },
  spinner: {
    marginLeft: theme.spacing.sm,
  },
  error: {
    fontSize: 12,
    color: theme.colors.error,
    fontWeight: '500',
    marginTop: theme.spacing.xs,
  },
  dropdown: {
    marginTop: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  suggestion: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 13,
  },
  suggestionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
});
