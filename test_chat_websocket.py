import asyncio
import websockets
import json

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzYzMzI5ODQzLCJpYXQiOjE3NjMzMjYyNDMsImp0aSI6ImU1YzMwNWVhZDI4MDQ2MDY4NzQ0NmRmNjBlYTlmNTQ5IiwidXNlcl9pZCI6MX0.Srfe7M-2i6kFYP1FxHIbm0PZARLznuL4VUG8SnvFfgQ"

async def test_chat():
    uri = f"ws://localhost:8006/ws/chat/?token={TOKEN}"
    
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            response = await websocket.recv()
            print(f"\nConnection message: {response}")
            
            user_joined = await websocket.recv()
            print(f"\nUser joined broadcast: {user_joined}")
            
            print("\nSending test message...")
            await websocket.send(json.dumps({
                "type": "chat.message",
                "message": "Hello from WebSocket test!"
            }))
            
            response = await websocket.recv()
            print(f"\nMessage broadcast: {response}")
            
            print("\nTesting rate limit (sending 2 messages quickly)...")
            await websocket.send(json.dumps({
                "type": "chat.message",
                "message": "First rapid message"
            }))
            
            await websocket.send(json.dumps({
                "type": "chat.message",
                "message": "Second rapid message (should be rate limited)"
            }))
            
            response1 = await websocket.recv()
            print(f"\nFirst rapid message: {response1}")
            
            response2 = await websocket.recv()
            print(f"\nSecond rapid message: {response2}")
            
            print("\n✅ WebSocket test complete!")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_chat())