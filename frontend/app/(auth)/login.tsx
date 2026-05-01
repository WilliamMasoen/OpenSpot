import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, clearError } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    clearError();
    await login({ email: email.trim().toLowerCase(), password });
  };

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
