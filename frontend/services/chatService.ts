import { apiClient } from './apiClient';
import { ChatMessage, Conversation } from '@/types/chat';

export const chatService = {
  getOrCreateConversation: (listingId: string) =>
    apiClient.post<Conversation>('/api/conversations', { listingId }),

  getConversations: () =>
    apiClient.get<Conversation[]>('/api/conversations'),

  getMessages: (conversationId: string) =>
    apiClient.get<ChatMessage[]>(`/api/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, body: string) =>
    apiClient.post<ChatMessage>(`/api/conversations/${conversationId}/messages`, { body }),

  markRead: (conversationId: string) =>
    apiClient.put<void>(`/api/conversations/${conversationId}/read`),
};
