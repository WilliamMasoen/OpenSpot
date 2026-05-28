import { ReactNode } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

interface ScreenWrapperProps {
  children: ReactNode;
  scrollable?: boolean;
  withKeyboard?: boolean;
  padded?: boolean;
  edges?: Edge[];
}

export function ScreenWrapper({
  children,
  scrollable = false,
  withKeyboard = false,
  padded = true,
  edges,
}: ScreenWrapperProps) {
  const content = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={padded && styles.padded}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : children;

  const wrapped = withKeyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {content}
    </KeyboardAvoidingView>
  ) : content;

  return (
    <SafeAreaView style={styles.container} edges={edges}>
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  padded: {
    padding: theme.spacing.md,
  },
});
