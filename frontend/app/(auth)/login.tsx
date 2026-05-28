import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/constants/theme';

const UNVERIFIED_MSG = 'Please verify your email before logging in.';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resentEmail, setResentEmail] = useState(false);
  const { login, resendVerification, loading, error, clearError } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    clearError();
    setResentEmail(false);
    await login({ email: email.trim().toLowerCase(), password });
  };

  const handleResend = async () => {
    const ok = await resendVerification(email.trim().toLowerCase());
    if (ok) setResentEmail(true);
  };

  const showResend = error === UNVERIFIED_MSG && email.trim().length > 0 && !resentEmail;

  return (
    <ScreenWrapper withKeyboard scrollable>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>OpenSpot</Text>
          <Text style={styles.tagline}>Find parking in seconds.</Text>
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
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            textContentType="password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {resentEmail ? (
            <Text style={styles.success}>Verification email sent — check your inbox.</Text>
          ) : null}
          {showResend ? (
            <TouchableOpacity style={styles.linkRow} onPress={handleResend} disabled={loading}>
              <Text style={styles.link}>Resend verification email</Text>
            </TouchableOpacity>
          ) : null}

          <Button label="Sign In" onPress={handleLogin} loading={loading} />

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.link}>Forgot your password?</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign up</Text>
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
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  form: {
    gap: theme.spacing.md,
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
  success: {
    fontSize: 13,
    color: theme.colors.success,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: '#F0FDF4',
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  linkRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  link: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
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
