export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  sentAt: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImageUrl: string | null;
  otherUserId: string;
  otherUserName: string;
  otherUserProfileImageUrl: string | null;
  createdAt: string;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}
