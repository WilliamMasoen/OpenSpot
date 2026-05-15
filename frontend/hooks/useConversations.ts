import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { chatService } from '@/services/chatService';
import { useChatStore } from '@/store/chatStore';
import { Conversation } from '@/types/chat';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setUnreadCount = useChatStore((s) => s.setUnreadCount);

  const refetch = useCallback(async () => {
    try {
      const data = await chatService.getConversations();
      setConversations(data);
      setUnreadCount(data.reduce((sum, c) => sum + c.unreadCount, 0));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [setUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { conversations, loading, error, refetch };
}
