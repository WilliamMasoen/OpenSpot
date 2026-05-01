import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { theme } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  error: {
    fontSize: 12,
    color: theme.colors.error,
    fontWeight: '500',
  },
});
