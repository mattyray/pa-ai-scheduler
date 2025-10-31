import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from apps.users.models import User


class ScheduleConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time schedule updates.
    
    URL: ws://localhost:8006/ws/schedule/<period_id>/
    
    Events broadcast to this consumer:
    - shift.requested (new shift request submitted)
    - shift.approved (shift approved)
    - shift.rejected (shift rejected)
    - shift.updated (shift edited)
    - shift.deleted (shift deleted)
    - coverage.alert (coverage status changed)
    - period.finalized (period finalized)
    """
    
    async def connect(self):
        """Handle WebSocket connection"""
        self.period_id = self.scope['url_route']['kwargs']['period_id']
        self.room_group_name = f'schedule_{self.period_id}'
        
        # Authenticate user via JWT token
        user = await self.get_user_from_token()
        
        if user is None or user.is_anonymous:
            # Reject connection if not authenticated
            await self.close(code=4001)
            return
        
        self.scope['user'] = user
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection.established',
            'message': f'Connected to schedule period {self.period_id}',
            'user': {
                'id': user.id,
                'email': user.email,
                'role': user.role
            }
        }))
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """
        Receive message from WebSocket (client -> server)
        Currently not used, but available for future bidirectional features
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            # Handle ping/pong for connection keep-alive
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
    
    # Event handlers (server -> client broadcasts)
    
    async def shift_requested(self, event):
        """Broadcast when a new shift is requested"""
        await self.send(text_data=json.dumps({
            'type': 'shift.requested',
            'shift': event['shift'],
            'message': event.get('message', 'New shift request submitted')
        }))
    
    async def shift_approved(self, event):
        """Broadcast when a shift is approved"""
        await self.send(text_data=json.dumps({
            'type': 'shift.approved',
            'shift': event['shift'],
            'message': event.get('message', 'Shift approved')
        }))
    
    async def shift_rejected(self, event):
        """Broadcast when a shift is rejected"""
        await self.send(text_data=json.dumps({
            'type': 'shift.rejected',
            'shift': event['shift'],
            'message': event.get('message', 'Shift rejected')
        }))
    
    async def shift_updated(self, event):
        """Broadcast when a shift is updated"""
        await self.send(text_data=json.dumps({
            'type': 'shift.updated',
            'shift': event['shift'],
            'changes': event.get('changes', {}),
            'message': event.get('message', 'Shift updated')
        }))
    
    async def shift_deleted(self, event):
        """Broadcast when a shift is deleted"""
        await self.send(text_data=json.dumps({
            'type': 'shift.deleted',
            'shift_id': event['shift_id'],
            'message': event.get('message', 'Shift deleted')
        }))
    
    async def coverage_alert(self, event):
        """Broadcast when coverage status changes"""
        await self.send(text_data=json.dumps({
            'type': 'coverage.alert',
            'date': event['date'],
            'coverage': event['coverage'],
            'message': event.get('message', 'Coverage updated')
        }))
    
    async def period_finalized(self, event):
        """Broadcast when period is finalized"""
        await self.send(text_data=json.dumps({
            'type': 'period.finalized',
            'period': event['period'],
            'message': event.get('message', 'Schedule period finalized')
        }))
    
    # Helper methods
    
    @database_sync_to_async
    def get_user_from_token(self):
        """
        Authenticate user from JWT token in query string.
        WebSocket URL: ws://localhost:8006/ws/schedule/1/?token=<jwt_token>
        """
        try:
            # Get token from query string
            query_string = self.scope.get('query_string', b'').decode()
            params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
            token = params.get('token')
            
            if not token:
                return AnonymousUser()
            
            # Validate token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            
            # Get user
            user = User.objects.get(id=user_id)
            return user
            
        except (InvalidToken, TokenError, User.DoesNotExist, KeyError, ValueError):
            return AnonymousUser()