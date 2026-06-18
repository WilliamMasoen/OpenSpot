import { useEffect } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { navigate } from '@/utils/navigate';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useConversations } from '@/hooks/useConversations';
import { signalRService } from '@/services/signalRService';
import { useChatStore } from '@/store/chatStore';
import { theme } from '@/constants/theme';
import { Conversation } from '@/types/chat';

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ListingThumb({ uri }: { uri: string | null }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />;
  }
  return (
    <View style={styles.thumbPlaceholder}>
      <Text style={styles.thumbEmoji}>🅿️</Text>
    </View>
  );
}

function ConversationRow({ item, onPress }: { item: Conversation; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <ListingThumb uri={item.listingImageUrl} />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{item.otherUserName}</Text>
          {item.lastMessage && (
            <Text style={styles.rowTime}>{formatTime(item.lastMessage.sentAt)}</Text>
          )}
        </View>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{item.listingTitle}</Text>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.rowPreview, item.unreadCount > 0 && styles.rowPreviewUnread]}
            numberOfLines={1}
          >
            {item.lastMessage?.body ?? 'No messages yet'}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const { conversations, loading, error, refetch } = useConversations();
  const incrementUnread = useChatStore((s) => s.incrementUnread);

  useEffect(() => {
    return signalRService.onMessage((_, convId) => {
      const isKnown = conversations.some((c) => c.id === convId);
      if (isKnown) incrementUnread();
      refetch();
    });
  }, [conversations, incrementUnread, refetch]);

  if (loading && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList<Conversation>
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            onPress={() =>
              navigate({
                pathname: `/conversation/${item.id}` as `${string}`,
                params: {
                  title: item.otherUserName,
                  subtitle: item.listingTitle,
                  listingId: item.listingId,
                  listingImageUrl: item.listingImageUrl ?? '',
                  otherUserId: item.otherUserId,
                  otherUserProfileImageUrl: item.otherUserProfileImageUrl ?? '',
                },
              })
            }
          />
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.heading}>Messages</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyBody}>
              Tap "Message Owner" on any listing to start a conversation.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={theme.colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : styles.listContent}
      />
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  heading: {
    ...theme.typography.heading,
    color: theme.colors.text,
  },
  emptyContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    ...theme.typography.subheading,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    flexShrink: 0,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbEmoji: {
    fontSize: 22,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  rowTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
  },
  rowSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowPreview: {
    fontSize: 14,
    color: theme.colors.textMuted,
    flex: 1,
  },
  rowPreviewUnread: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: theme.spacing.sm,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 80,
  },
  errorBanner: {
    margin: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.radius.sm,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
  },
});
