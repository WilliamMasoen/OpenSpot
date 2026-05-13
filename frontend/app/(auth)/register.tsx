import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/constants/theme';

export default function RegisterScreen() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { register, loading, error, clearError } = useAuth();

  const set = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = 'First name is required.';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
    if (!form.email.trim()) errors.email = 'Email is required.';
    if (form.password.length < 6) errors.password = 'Password must be at least 6 characters.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    clearError();
    await register({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      phoneNumber: form.phoneNumber.trim() || undefined,
    });
  };

  return (
    <ScreenWrapper withKeyboard scrollable>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join OpenSpot today.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Input
                label="First name"
                value={form.firstName}
                onChangeText={set('firstName')}
                placeholder="Jane"
                error={fieldErrors.firstName}
                textContentType="givenName"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.nameField}>
              <Input
                label="Last name"
                value={form.lastName}
                onChangeText={set('lastName')}
                placeholder="Doe"
                error={fieldErrors.lastName}
                textContentType="familyName"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Input
            label="Email"
            value={form.email}
            onChangeText={set('email')}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            error={fieldErrors.email}
          />
          <Input
            label="Password"
            value={form.password}
            onChangeText={set('password')}
            placeholder="At least 6 characters"
            secureTextEntry
            textContentType="none"
            autoComplete="off"
            error={fieldErrors.password}
          />
          <Input
            label="Phone number (optional)"
            value={form.phoneNumber}
            onChangeText={set('phoneNumber')}
            placeholder="+1 416 000 0000"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Create Account" onPress={handleRegister} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
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
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  form: {
    gap: theme.spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  nameField: {
    flex: 1,
  },
  error: {
    fontSize: 13,
    color: theme.colors.error,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  footerLink: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
