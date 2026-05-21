import { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { Button } from '@/components/ui/Button';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { useCreateListing } from '@/hooks/useListings';
import { theme } from '@/constants/theme';
import { markListingsStale } from '@/utils/refreshFlags';

const MAX_IMAGES = 5;

const EMPTY_FORM = {
  title: '',
  description: '',
  address: '',
  price: '',
  startDate: '',
  endDate: '',
};

export default function PostScreen() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<string[]>([]);
  const { createListing, loading, error, clearError } = useCreateListing();

  const set = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'address') setCoords(null);
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    clearError();
  };

  const handleAddressSelect = (address: string, lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, address }));
    setCoords({ lat, lng });
    if (fieldErrors.address) setFieldErrors((prev) => ({ ...prev, address: '' }));
    clearError();
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((u) => u !== uri));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Title is required.';
    if (!form.address.trim()) errors.address = 'Address is required.';
    const price = parseInt(form.price, 10);
    if (!form.price || isNaN(price) || price <= 0) errors.price = 'Enter a valid monthly price.';
    if (!form.startDate) errors.startDate = 'Select a start date.';
    if (!form.endDate) errors.endDate = 'Select an end date.';
    if (form.startDate && form.endDate && form.endDate <= form.startDate)
      errors.endDate = 'End date must be after start date.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const hasFormData = Object.values(form).some((v) => v.trim() !== '') || images.length > 0;

  const handleClose = () => {
    if (!hasFormData) {
      router.back();
      return;
    }
    Alert.alert('Discard listing?', 'All your changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => router.back(),
      },
    ]);
  };

  const handlePost = async () => {
    if (!validate()) return;
    clearError();

    const listing = await createListing(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        price: parseInt(form.price, 10),
        startDate: form.startDate,
        endDate: form.endDate,
        latitude: coords?.lat,
        longitude: coords?.lng,
      },
      images
    );

    if (listing) {
      markListingsStale();
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.title}>Post a spot</Text>
              <View style={{ width: 32 }} />
            </View>
            <Text style={styles.subtitle}>Fill in the details for your parking spot.</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Title"
              value={form.title}
              onChangeText={set('title')}
              placeholder="e.g. Underground spot, Level B2"
              error={fieldErrors.title}
              autoCapitalize="sentences"
            />
            <AddressAutocomplete
              label="Address"
              value={form.address}
              onChangeText={set('address')}
              onSelectAddress={handleAddressSelect}
              error={fieldErrors.address}
            />
            <Input
              label="Description (optional)"
              value={form.description}
              onChangeText={set('description')}
              placeholder="Any details renters should know…"
              multiline
              numberOfLines={3}
              style={styles.textarea}
              autoCapitalize="sentences"
            />
            <Input
              label="Monthly price ($)"
              value={form.price}
              onChangeText={set('price')}
              placeholder="e.g. 150"
              keyboardType="number-pad"
              error={fieldErrors.price}
            />

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <DatePickerField
                  label="Available from"
                  value={form.startDate}
                  onChange={set('startDate')}
                  error={fieldErrors.startDate}
                  minimumDate={new Date()}
                />
              </View>
              <View style={styles.dateField}>
                <DatePickerField
                  label="Available until"
                  value={form.endDate}
                  onChange={set('endDate')}
                  error={fieldErrors.endDate}
                  minimumDate={form.startDate ? new Date(`${form.startDate}T00:00:00`) : new Date()}
                />
              </View>
            </View>

            <View style={styles.photosSection}>
              <Text style={styles.photosLabel}>Photos ({images.length}/{MAX_IMAGES})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                {images.map((uri) => (
                  <TouchableOpacity key={uri} onPress={() => removeImage(uri)} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <View style={styles.photoRemove}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {images.length < MAX_IMAGES && (
                  <TouchableOpacity style={styles.photoAdd} onPress={pickImages}>
                    <Text style={styles.photoAddIcon}>+</Text>
                    <Text style={styles.photoAddLabel}>Add</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label={loading ? 'Posting…' : 'Post Spot'} onPress={handlePost} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  header: {
    gap: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  form: {
    gap: theme.spacing.md,
    zIndex: 1,
  },
  textarea: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  photosSection: {
    gap: theme.spacing.xs,
  },
  photosLabel: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  photosScroll: {
    marginTop: 4,
  },
  photoWrap: {
    position: 'relative',
    marginRight: theme.spacing.sm,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  photoAdd: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddIcon: {
    fontSize: 22,
    color: theme.colors.textMuted,
  },
  photoAddLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  error: {
    fontSize: 13,
    color: theme.colors.error,
    fontWeight: '500',
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
});
