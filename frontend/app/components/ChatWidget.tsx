'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ChatMessage as ChatMessageType } from '@/lib/chat-types';
import { fetchMessages, ChatWebSocket } from '@/lib/chat-api';
import ChatMessage from './ChatMessage';

export default function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<ChatWebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldScrollRef = useRef(true);

  const getAccessToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUA0PVqzn77BdGAg+ldnyz3otBSl+zPLaizsIGGS57OihUhELTKXh8bllHAU2jtT0yoA0Bx1rvu7km1EODFCM5O+zZhwGN5DU88yANQcdbsDu5JtRDgxPiuPvs2YcBjeP0/TLgDYHHm7A7eSbUQ4MT4zk77NmHAY3j9P0y4A2Bx5uwO7km1EODE+L5O+zZhwGN4/S9MuANgcdbsDu5JtRDgxPjOTvs2YcBjeP0/TLgDYHHW7A7uSbUQ4LT4zk77NmHAY3j9P0y4A2Bx1uwO7km1EODFCM5O+zZhwGOJDT9MuANgcdbsDu5JtRDgxPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4MT4vk7rNmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY4kNP0y4A2Bx5uwO7jm1EOC0+M5O+zZhwGOJDT9MuANgcebsDu45tRDgtPjOTvs2YcBjiQ0/TLgDYHHm7A7uObUQ4LT4zk77NmHAY=');
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const lastSeen = localStorage.getItem('chat_last_seen_timestamp');
    if (lastSeen) {
      const lastSeenDate = new Date(lastSeen);
      const unread = messages.filter(
        m => new Date(m.created_at) > lastSeenDate && m.user.id !== user.id
      ).length;
      setUnreadCount(unread);
    }
  }, [messages, user]);

  useEffect(() => {
    if (isOpen && messagesEndRef.current && shouldScrollRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const accessToken = getAccessToken();
    if (!isOpen || !accessToken) return;

    loadMessages(1);
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [isOpen]);

  const loadMessages = async (page: number) => {
    const accessToken = getAccessToken();
    if (!accessToken) return;

    setIsLoading(true);
    try {
      const data = await fetchMessages(page, accessToken);
      
      if (page === 1) {
        setMessages(data.results.reverse());
        shouldScrollRef.current = true;
      } else {
        setMessages(prev => [...data.results.reverse(), ...prev]);
        shouldScrollRef.current = false;
      }
      
      setHasMore(!!data.next);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectWebSocket = () => {
    const accessToken = getAccessToken();
    if (!accessToken || wsRef.current?.isConnected()) return;

    const ws = new ChatWebSocket(accessToken);
    
    ws.onConnect(() => {
      setIsConnected(true);
      setIsReconnecting(false);
    });

    ws.onDisconnect(() => {
      setIsConnected(false);
      setIsReconnecting(true);
    });

    ws.onMessage((data) => {
      if (data.type === 'message.new') {
        setMessages(prev => [...prev, data.message]);
        shouldScrollRef.current = true;
        
        if (!isOpen && data.message.user.id !== user?.id) {
          setUnreadCount(prev => prev + 1);
          playNotificationSound();
        }
      }
    });

    ws.connect();
    wsRef.current = ws;
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const handleSendMessage = () => {
    const trimmed = messageText.trim();
    if (!trimmed || !wsRef.current?.isConnected()) return;

    wsRef.current.sendMessage(trimmed);
    setMessageText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      setUnreadCount(0);
      localStorage.setItem('chat_last_seen_timestamp', new Date().toISOString());
    }
    setIsOpen(!isOpen);
  };

  const handleLoadMore = () => {
    loadMessages(currentPage + 1);
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="bg-white rounded-lg shadow-2xl flex flex-col w-[400px] h-[600px] max-h-[80vh] md:w-[400px] md:h-[600px]">
          <div className="bg-blue-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Team Chat</h3>
              {isReconnecting && (
                <span className="text-xs bg-yellow-500 px-2 py-1 rounded">Reconnecting...</span>
              )}
              {isConnected && (
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              )}
            </div>
            <button
              onClick={handleToggle}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 bg-gray-50"
          >
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="w-full mb-4 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                {isLoading ? 'Loading...' : 'Load more messages'}
              </button>
            )}

            {messages.length === 0 && !isLoading && (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No messages yet. Start the conversation!
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwnMessage={message.user.id === user.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t bg-white p-4 rounded-b-lg">
            <div className="flex gap-2">
              <div className="flex-1">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value.slice(0, 1000))}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  disabled={!isConnected}
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {messageText.length}/1000
                </div>
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || !isConnected}
                className="self-start px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleToggle}
          className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors relative"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}