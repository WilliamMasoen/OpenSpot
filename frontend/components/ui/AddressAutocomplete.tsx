import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { theme } from '@/constants/theme';

interface Suggestion {
  shortAddress: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  province?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address: NominatimAddress;
}

function formatShortAddress(r: NominatimResult): string {
  const a = r.address;
  const street = [a.house_number, a.road ?? a.pedestrian].filter(Boolean).join(' ');
  const city = a.city ?? a.town ?? a.village ?? '';
  const region = a.province ?? a.state ?? '';
  return [street, city, region].filter(Boolean).join(', ') || r.display_name;
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
  const [dropdownTop, setDropdownTop] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1&countrycodes=ca`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'OpenSpot/1.0 (openspot-app)' },
        });
        const data: NominatimResult[] = await res.json();
        setSuggestions(data.map((r) => ({
          shortAddress: formatShortAddress(r),
          displayName: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        })));
      } catch {
        setSuggestions([]);
      } finally {
        setFetching(false);
      }
    }, 400);
  }, []);

  const handleChangeText = (text: string) => {
    onChangeText(text);
    fetchSuggestions(text);
  };

  const handleSelect = (s: Suggestion) => {
    const address = s.shortAddress;
    onChangeText(address);
    onSelectAddress(address, s.lat, s.lng);
    setSuggestions([]);
  };

  return (
    <View style={[styles.container, suggestions.length > 0 && styles.elevated]}>
      <View onLayout={(e) => setDropdownTop(e.nativeEvent.layout.height + 4)}>
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
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {suggestions.length > 0 && dropdownTop > 0 && (
        <View style={[styles.dropdown, { top: dropdownTop }]}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.suggestion, i < suggestions.length - 1 && styles.suggestionDivider]}
              onPress={() => handleSelect(s)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText} numberOfLines={2}>
                {s.shortAddress}
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
    gap: theme.spacing.xs,
  },
  elevated: {
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
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    zIndex: 200,
    elevation: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
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
