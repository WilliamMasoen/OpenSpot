import { useState, useCallback, useEffect } from 'react';
import { chatService } from '@/services/chatService';
import { signalRService } from '@/services/signalRService';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { ChatMessage } from '@/types/chat';

export function useMessages(conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const decrementUnread = useChatStore((s) => s.decrementUnread);
  const userId = useAuthStore((s) => s.user?.userId);

  const load = useCallback(async () => {
    try {
      const data = await chatService.getMessages(conversationId);
      setMessages(data);
      const unread = data.filter((m) => !m.isRead && m.senderId !== userId).length;
      if (unread > 0) decrementUnread(unread);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId, decrementUnread]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return signalRService.onMessage((msg, convId) => {
      if (convId === conversationId) {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        chatService.markRead(conversationId).catch(() => {});
        decrementUnread(1);
      }
    });
  }, [conversationId, decrementUnread]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (sending || !body.trim()) return;
      setSending(true);
      setSendError(null);
      try {
        const msg = await chatService.sendMessage(conversationId, body.trim());
        setMessages((prev) => [...prev, msg]);
      } catch (e: unknown) {
        setSendError(e instanceof Error ? e.message : 'Failed to send message.');
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending]
  );

  return { messages, loading, error, sending, sendError, sendMessage };
}
