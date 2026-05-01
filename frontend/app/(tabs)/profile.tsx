import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/constants/theme';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  if (!user) return null;

  const isAdmin = user.roles.includes('Admin');

  return (
    <ScreenWrapper scrollable padded={false}>
      <View style={styles.container}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.email.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.emailDisplay}>{user.email}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <InfoRow label="Email" value={user.email} />
            <View style={styles.divider} />
            <InfoRow label="User ID" value={user.userId.slice(0, 8) + '…'} />
            <View style={styles.divider} />
            <InfoRow label="Role" value={user.roles.join(', ')} />
          </View>
        </View>

        <View style={styles.section}>
          <Button
            label="Sign Out"
            onPress={handleLogout}
            variant="secondary"
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  avatarSection: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  emailDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  adminBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: theme.radius.full,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    ...theme.shadow.card,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
});
