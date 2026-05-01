import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateListing } from '@/hooks/useListings';
import { theme } from '@/constants/theme';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default function PostScreen() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    address: '',
    price: '',
    startDate: '',
    endDate: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { createListing, loading, error, clearError } = useCreateListing();

  const set = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    clearError();
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Title is required.';
    if (!form.address.trim()) errors.address = 'Address is required.';
    const price = parseInt(form.price, 10);
    if (!form.price || isNaN(price) || price <= 0) errors.price = 'Enter a valid monthly price.';
    if (!DATE_REGEX.test(form.startDate)) errors.startDate = 'Use format YYYY-MM-DD.';
    if (!DATE_REGEX.test(form.endDate)) errors.endDate = 'Use format YYYY-MM-DD.';
    if (DATE_REGEX.test(form.startDate) && DATE_REGEX.test(form.endDate)) {
      if (form.endDate <= form.startDate) errors.endDate = 'End date must be after start date.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePost = async () => {
    if (!validate()) return;
    clearError();

    const listing = await createListing({
      title: form.title.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      price: parseInt(form.price, 10),
      startDate: form.startDate,
      endDate: form.endDate,
    });

    if (listing) {
      Alert.alert('Posted!', `"${listing.title}" is now live.`, [
        { text: 'View listings', onPress: () => router.replace('/(tabs)') },
        { text: 'Post another', onPress: () => setForm({ title: '', description: '', address: '', price: '', startDate: '', endDate: '' }) },
      ]);
    }
  };

  return (
    <ScreenWrapper withKeyboard scrollable>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Post a spot</Text>
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
          <Input
            label="Address"
            value={form.address}
            onChangeText={set('address')}
            placeholder="e.g. 123 Bay St, Toronto, ON"
            error={fieldErrors.address}
            autoCapitalize="words"
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
              <Input
                label="Available from"
                value={form.startDate}
                onChangeText={set('startDate')}
                placeholder="YYYY-MM-DD"
                error={fieldErrors.startDate}
              />
            </View>
            <View style={styles.dateField}>
              <Input
                label="Available until"
                value={form.endDate}
                onChangeText={set('endDate')}
                placeholder="YYYY-MM-DD"
                error={fieldErrors.endDate}
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Post Spot" onPress={handlePost} loading={loading} />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  header: {
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  form: {
    gap: theme.spacing.md,
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
  error: {
    fontSize: 13,
    color: theme.colors.error,
    fontWeight: '500',
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
});
