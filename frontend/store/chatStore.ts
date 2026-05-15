import { create } from 'zustand';

interface ChatStore {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: (by?: number) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () => set({ unreadCount: get().unreadCount + 1 }),
  decrementUnread: (by = 1) => set({ unreadCount: Math.max(0, get().unreadCount - by) }),
}));
