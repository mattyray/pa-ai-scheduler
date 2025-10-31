#!/usr/bin/env python
"""
Test WebSocket connection to schedule updates.
Usage: python test_websocket.py <jwt_token> <period_id>
"""
import asyncio
import websockets
import json
import sys


async def test_websocket(token, period_id):
    """Test WebSocket connection"""
    uri = f"ws://localhost:8006/ws/schedule/{period_id}/?token={token}"
    
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected!")
            
            # Wait for connection confirmation
            response = await websocket.recv()
            print(f"📨 Received: {response}")
            
            # Send ping every 30 seconds and listen for events
            while True:
                try:
                    # Send ping
                    await websocket.send(json.dumps({
                        'type': 'ping',
                        'timestamp': asyncio.get_event_loop().time()
                    }))
                    
                    # Wait for message with timeout
                    message = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                    data = json.loads(message)
                    
                    # Pretty print received data
                    event_type = data.get('type')
                    if event_type == 'pong':
                        print(f"🏓 Pong received")
                    else:
                        print(f"\n🔔 Event: {event_type}")
                        print(f"📋 Data: {json.dumps(data, indent=2)}")
                    
                except asyncio.TimeoutError:
                    print("⏰ No message received in 30 seconds, sending ping...")
                    continue
                    
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ Connection failed: {e}")
        print("Make sure:")
        print("1. Your JWT token is valid")
        print("2. The schedule period exists")
        print("3. Django Channels is running (daphne or runserver)")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_websocket.py <jwt_token> <period_id>")
        print("\nExample:")
        print("python test_websocket.py eyJ0eXAiOiJKV1QiLCJhbG... 1")
        sys.exit(1)
    
    token = sys.argv[1]
    period_id = sys.argv[2]
    
    asyncio.run(test_websocket(token, period_id))