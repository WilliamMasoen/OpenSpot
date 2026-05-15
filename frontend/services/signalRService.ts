import * as signalR from '@microsoft/signalr';
import Constants from 'expo-constants';
import { useAuthStore } from '@/store/authStore';
import { ChatMessage } from '@/types/chat';

function getBaseUrl(): string {
  if (!__DEV__) return 'https://api.openspot.app';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:5137` : 'http://localhost:5137';
}

type MessageHandler = (message: ChatMessage, conversationId: string) => void;

let connection: signalR.HubConnection | null = null;
const handlers = new Set<MessageHandler>();

export const signalRService = {
  connect: async () => {
    if (connection?.state === signalR.HubConnectionState.Connected) return;

    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${getBaseUrl()}/hubs/chat`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
      })
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveMessage', (message: ChatMessage, conversationId: string) => {
      handlers.forEach((h) => h(message, conversationId));
    });

    await connection.start();
  },

  disconnect: async () => {
    await connection?.stop();
    connection = null;
  },

  onMessage: (handler: MessageHandler): (() => void) => {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
};
