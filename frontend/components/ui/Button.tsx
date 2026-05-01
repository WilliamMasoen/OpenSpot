import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  fullWidth = true,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : theme.colors.primary} size="small" />
      ) : (
        <Text style={[styles.label, !isPrimary && styles.labelSecondary]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.2,
  },
  labelSecondary: {
    color: theme.colors.primary,
  },
});
