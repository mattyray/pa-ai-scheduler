import { ChatPaginationResponse } from './chat-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8006';

export async function fetchMessages(page: number = 1, token: string): Promise<ChatPaginationResponse> {
  const response = await fetch(`${API_URL}/api/chat/messages/?page=${page}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }

  return response.json();
}

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private token: string;
  private onMessageCallback?: (data: any) => void;
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onErrorCallback?: (error: any) => void;

  constructor(token: string) {
    this.token = token;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${WS_URL}/ws/chat/?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Chat WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessageCallback) {
          this.onMessageCallback(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Chat WebSocket error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    };

    this.ws.onclose = () => {
      console.log('Chat WebSocket disconnected');
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
      this.attemptReconnect();
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  sendMessage(message: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'chat.message',
        message: message,
      }));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  onMessage(callback: (data: any) => void) {
    this.onMessageCallback = callback;
  }

  onConnect(callback: () => void) {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback: () => void) {
    this.onDisconnectCallback = callback;
  }

  onError(callback: (error: any) => void) {
    this.onErrorCallback = callback;
  }

  disconnect() {
    if (this.ws) {
      this.maxReconnectAttempts = 0;
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}