import json
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from apps.users.models import User
from .models import ChatMessage


class GeneralChatConsumer(AsyncWebsocketConsumer):
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.last_message_time = 0
    
    async def connect(self):
        self.room_group_name = 'general_chat'
        
        user = await self.get_user_from_token()
        
        if user is None or user.is_anonymous:
            await self.close(code=4001)
            return
        
        self.scope['user'] = user
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        await self.send(text_data=json.dumps({
            'type': 'connection.established',
            'message': 'Connected to general chat',
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role
            }
        }))
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name
                }
            }
        )
    
    async def disconnect(self, close_code):
        if hasattr(self, 'scope') and 'user' in self.scope:
            user = self.scope['user']
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_left',
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name
                    }
                }
            )
        
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
            
            elif message_type == 'chat.message':
                current_time = time.time()
                if current_time - self.last_message_time < 1.0:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': 'Rate limit exceeded. Please wait before sending another message.'
                    }))
                    return
                
                self.last_message_time = current_time
                
                message_text = data.get('message', '').strip()
                if message_text:
                    if len(message_text) > 1000:
                        await self.send(text_data=json.dumps({
                            'type': 'error',
                            'message': 'Message exceeds 1000 character limit.'
                        }))
                        return
                    
                    chat_message = await self.save_message(message_text)
                    
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'message_new',
                            'message': {
                                'id': chat_message.id,
                                'user': {
                                    'id': chat_message.user.id,
                                    'email': chat_message.user.email,
                                    'first_name': chat_message.user.first_name,
                                    'last_name': chat_message.user.last_name,
                                    'role': chat_message.user.role
                                },
                                'message': chat_message.message,
                                'created_at': chat_message.created_at.isoformat(),
                                'is_edited': chat_message.is_edited
                            }
                        }
                    )
        
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    async def message_new(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message.new',
            'message': event['message']
        }))
    
    async def user_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user.joined',
            'user': event['user']
        }))
    
    async def user_left(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user.left',
            'user': event['user']
        }))
    
    @database_sync_to_async
    def get_user_from_token(self):
        try:
            query_string = self.scope.get('query_string', b'').decode()
            params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
            token = params.get('token')
            
            if not token:
                return None
            
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            return User.objects.get(id=user_id)
        
        except (InvalidToken, TokenError, User.DoesNotExist, ValueError):
            return None
    
    @database_sync_to_async
    def save_message(self, message_text):
        return ChatMessage.objects.create(
            user=self.scope['user'],
            message=message_text
        )