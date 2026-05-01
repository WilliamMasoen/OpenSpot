import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { forgotPassword, loading, error } = useAuth();

  const handleSend = async () => {
    if (!email.trim()) return;
    const success = await forgotPassword(email.trim().toLowerCase());
    if (success) setSent(true);
  };

  if (sent) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✉️</Text>
            <Text style={styles.successTitle}>Check your inbox</Text>
            <Text style={styles.successBody}>
              If an account exists for {email}, you'll receive a password reset link shortly.
            </Text>
          </View>
          <Button label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper withKeyboard scrollable>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a reset link.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Send Reset Link" onPress={handleSend} loading={loading} disabled={!email.trim()} />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  header: {
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  form: {
    gap: theme.spacing.md,
  },
  error: {
    fontSize: 13,
    color: theme.colors.error,
    fontWeight: '500',
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  successBox: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxl,
  },
  successIcon: {
    fontSize: 48,
  },
  successTitle: {
    ...theme.typography.subheading,
    color: theme.colors.text,
  },
  successBody: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
  },
});
