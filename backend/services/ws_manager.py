from fastapi import WebSocket
from typing import Dict, List
import json

class ConnectionManager:
    def __init__(self):
        # Maps video_id -> List of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, video_id: str):
        await websocket.accept()
        if video_id not in self.active_connections:
            self.active_connections[video_id] = []
        self.active_connections[video_id].append(websocket)
        print(f"WS client connected for video {video_id}. Active connections: {len(self.active_connections[video_id])}")

    def disconnect(self, websocket: WebSocket, video_id: str):
        if video_id in self.active_connections:
            if websocket in self.active_connections[video_id]:
                self.active_connections[video_id].remove(websocket)
            if not self.active_connections[video_id]:
                del self.active_connections[video_id]
        print(f"WS client disconnected for video {video_id}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

    async def broadcast_status(self, video_id: str, message: dict):
        if video_id in self.active_connections:
            inactive_connections = []
            for websocket in self.active_connections[video_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    print(f"Failed to send WS message: {e}")
                    inactive_connections.append(websocket)
            
            # Clean up closed connections
            for conn in inactive_connections:
                self.disconnect(conn, video_id)

ws_manager = ConnectionManager()
