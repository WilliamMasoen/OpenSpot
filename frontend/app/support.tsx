import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

const SUPPORT_EMAIL = 'support@openspot.com';

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'How do I list my parking spot?',
    answer: 'Tap the + button in the centre of the tab bar. Fill in your spot\'s address, price, and availability dates. You can also add photos to help renters find your spot.',
  },
  {
    question: 'How do I contact a spot owner?',
    answer: 'Open any listing and tap "Message Owner". This starts a conversation directly in the app. You\'ll get a notification when they reply.',
  },
  {
    question: 'How do I edit or remove my listing?',
    answer: 'Go to Profile → My Spots. From there you can edit any listing\'s details or delete it entirely. You can also mark a spot as rented to hide it from search without deleting it.',
  },
  {
    question: 'Can I save listings to look at later?',
    answer: 'Yes — tap the heart icon on any listing tile or listing detail page to save it. Find all your saved spots under Profile → My Favourites.',
  },
  {
    question: 'How does the nearest spots feature work?',
    answer: 'On the home screen, tap the "Nearest" chip. The app will ask for your location and then sort listings by distance from where you are.',
  },
  {
    question: 'Is my personal information secure?',
    answer: 'Yes. Passwords are hashed and never stored in plain text. Authentication uses short-lived tokens stored only in your device\'s secure keychain. We never share your information with third parties.',
  },
  {
    question: 'What if a spot isn\'t available when I arrive?',
    answer: 'Message the owner directly through the app to confirm availability before heading over. If you have an issue, contact us at support@openspot.com and we\'ll help resolve it.',
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={styles.faqRow}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.faqQuestion}>{question}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function SupportScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Support</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* FAQ */}
        <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
        <View style={styles.card}>
          {FAQ.map((item, i) => (
            <View key={i}>
              <FaqItem question={item.question} answer={item.answer} />
              {i < FAQ.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Contact */}
        <Text style={styles.sectionLabel}>Still need help?</Text>
        <View style={styles.card}>
          <View style={styles.contactBody}>
            <Text style={styles.contactText}>
              Our support team is here to help. Send us an email and we'll get back to you as soon as possible.
            </Text>
            <TouchableOpacity
              style={styles.emailButton}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={18} color="#fff" />
              <Text style={styles.emailButtonText}>Email Support</Text>
            </TouchableOpacity>
            <Text style={styles.emailAddress}>{SUPPORT_EMAIL}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 15,
    gap: theme.spacing.md,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
    lineHeight: 21,
  },
  faqAnswer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  faqAnswerText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 21,
  },
  contactBody: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  contactText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 13,
    borderRadius: theme.radius.full,
  },
  emailButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  emailAddress: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
});
