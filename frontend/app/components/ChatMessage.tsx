'use client';

import { ChatMessage as ChatMessageType } from '@/lib/chat-types';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwnMessage: boolean;
}

export default function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      const distance = formatDistanceToNow(date, { addSuffix: true });
      if (distance.includes('less than a minute') || distance.includes('seconds')) {
        return 'just now';
      }
      return distance;
    }
    
    if (isYesterday(date)) {
      return `Yesterday ${format(date, 'h:mm a')}`;
    }
    
    return format(date, 'MMM d, h:mm a');
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800';
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {message.user.first_name} {message.user.last_name}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeColor(message.user.role)}`}>
            {message.user.role}
          </span>
        </div>
        
        <div className={`rounded-lg px-4 py-2 ${
          isOwnMessage 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 text-gray-900'
        }`}>
          <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
        </div>
        
        <span className="text-xs text-gray-500 mt-1">
          {formatTimestamp(message.created_at)}
        </span>
      </div>
    </div>
  );
}