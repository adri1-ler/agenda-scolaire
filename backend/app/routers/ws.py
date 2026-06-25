"""WebSocket endpoints — registered at app level with /ws prefix (no router prefix)."""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.utils.security import decode_token

router = APIRouter(tags=["websocket"])

# channel_id -> list of (user_id, websocket)
_msg_connections: dict[str, list[tuple[str, WebSocket]]] = {}
# user_id -> websocket
_notif_connections: dict[str, WebSocket] = {}


# ── Messaging ────────────────────────────────────────────────────────────────

@router.websocket("/ws/messaging/{channel_id}")
async def ws_messaging(websocket: WebSocket, channel_id: str, token: str = ""):
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return
    user_id = payload.get("sub", "")
    await websocket.accept()
    _msg_connections.setdefault(channel_id, []).append((user_id, websocket))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        _msg_connections[channel_id] = [
            (u, w) for u, w in _msg_connections.get(channel_id, []) if w != websocket
        ]


async def broadcast_message(channel_id: str, payload: dict):
    dead = []
    for uid, ws in _msg_connections.get(channel_id, []):
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            dead.append((uid, ws))
    for item in dead:
        _msg_connections[channel_id].remove(item)


# ── Notifications ─────────────────────────────────────────────────────────────

@router.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket, token: str = ""):
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return
    user_id = payload.get("sub", "")
    await websocket.accept()
    _notif_connections[user_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        _notif_connections.pop(user_id, None)


async def push_notification(user_id: str, payload: dict):
    ws = _notif_connections.get(user_id)
    if ws:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            _notif_connections.pop(user_id, None)
