export interface ChatUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'PA' | 'ADMIN';
}

export interface ChatMessage {
  id: number;
  user: ChatUser;
  message: string;
  created_at: string;
  is_edited: boolean;
}

export interface ChatPaginationResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ChatMessage[];
}

export interface WebSocketMessage {
  type: string;
  message?: ChatMessage;
  user?: ChatUser;
  timestamp?: string;
  error?: string;
}