import { useRef, useState, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMessages } from '@/hooks/useMessages';
import { useAuthStore } from '@/store/authStore';
import { theme } from '@/constants/theme';
import { ChatMessage } from '@/types/chat';

function formatMsgTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function OtherAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <View style={styles.otherAvatar}>
      <Text style={styles.otherAvatarText}>{initials}</Text>
    </View>
  );
}

function MessageBubble({
  msg,
  isMe,
  otherName,
}: {
  msg: ChatMessage;
  isMe: boolean;
  otherName: string;
}) {
  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      {!isMe && <OtherAvatar name={otherName} />}
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.body}</Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {formatMsgTime(msg.sentAt)}
        </Text>
      </View>
    </View>
  );
}

function ListingHeader({
  listingId,
  imageUrl,
  title,
}: {
  listingId: string;
  imageUrl: string;
  title: string;
}) {
  return (
    <TouchableOpacity
      style={styles.listingHeader}
      activeOpacity={0.8}
      onPress={() => router.push(`/listing/${listingId}` as `${string}`)}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.listingImage} resizeMode="cover" />
      ) : (
        <View style={styles.listingImagePlaceholder}>
          <Text style={styles.listingImageEmoji}>🅿️</Text>
        </View>
      )}
      <View style={styles.listingInfo}>
        <Text style={styles.listingLabel}>Listing</Text>
        <Text style={styles.listingTitle} numberOfLines={1}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function ConversationScreen() {
  const { id, title, subtitle, listingId, listingImageUrl } = useLocalSearchParams<{
    id: string;
    title?: string;
    subtitle?: string;
    listingId?: string;
    listingImageUrl?: string;
  }>();
  const { messages, loading, error, sending, sendMessage } = useMessages(id);
  const userId = useAuthStore((s) => s.user?.userId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    await sendMessage(text);
  };

  const otherName = title ?? 'User';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
        </View>
      </View>

      {/* Listing card */}
      {listingId && subtitle ? (
        <ListingHeader
          listingId={listingId}
          imageUrl={listingImageUrl ?? ''}
          title={subtitle}
        />
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList<ChatMessage>
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                msg={item}
                isMe={item.senderId === userId}
                otherName={otherName}
              />
            )}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Say hello!</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor={theme.colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  backBtn: {
    padding: 4,
  },
  headerTitles: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  listingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listingImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
  },
  listingImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingImageEmoji: {
    fontSize: 18,
  },
  listingInfo: {
    flex: 1,
  },
  listingLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  messageList: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  bubbleRowMe: {
    justifyContent: 'flex-end',
  },
  otherAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  otherAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  bubble: {
    maxWidth: '72%',
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 2,
  },
  bubbleMe: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 4,
    ...theme.shadow.card,
  },
  bubbleText: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 21,
  },
  bubbleTextMe: {
    color: '#fff',
  },
  bubbleTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
    alignSelf: 'flex-end',
  },
  bubbleTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
