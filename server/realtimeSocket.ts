import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { authStore } from './authStore';
import { userService } from './services/userService';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  userName: string;
  userRole: string;
  currentRoom?: string;
}

export function setupRealtimeWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, ClientConnection>();

  server.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/ws') {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  console.log('[WEBSOCKET] Realtime WebSocket & WebRTC signaling server initialized on /ws');

  wss.on('connection', (ws: WebSocket, _req) => {
    // Initial client entry: unauthenticated until valid token provided
    clients.set(ws, {
      ws,
      userId: 'usr-unauthenticated',
      userName: 'Unauthenticated Socket',
      userRole: 'VIEWER',
    });

    ws.on('message', async (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        const client = clients.get(ws);
        if (!client) return;

        switch (msg.type) {
          // --- User Authentication / Handshake via Session Token ---
          case 'auth': {
            const token = msg.token || msg.sessionToken;
            let authenticatedUser: any = null;
            if (token) {
              const svc = await userService.validateSession(token);
              authenticatedUser = svc?.user || (await authStore.getUserByTokenAsync(token));
            }

            if (authenticatedUser) {
              client.userId = authenticatedUser.id;
              client.userName = authenticatedUser.name;
              client.userRole = authenticatedUser.role;
              ws.send(JSON.stringify({
                type: 'authenticated',
                userId: client.userId,
                role: client.userRole,
                timestamp: new Date().toISOString(),
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'auth_error',
                error: 'Invalid or missing session token. Authentication required.',
                timestamp: new Date().toISOString(),
              }));
            }
            break;
          }

          // --- Chat Message Broadcast ---
          case 'chat_message': {
            if (client.userId === 'usr-unauthenticated') {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Unauthorized: Valid authentication required to send messages.',
              }));
              return;
            }
            // Broadcast new chat message to all connected clients
            const payload = msg.payload;
            wss.clients.forEach((c) => {
              if (c.readyState === WebSocket.OPEN) {
                c.send(JSON.stringify({
                  type: 'new_chat_message',
                  message: payload,
                }));
              }
            });
            break;
          }

          // --- Chat Reaction Broadcast ---
          case 'chat_reaction': {
            if (client.userId === 'usr-unauthenticated') {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Unauthorized: Valid authentication required to react.',
              }));
              return;
            }
            wss.clients.forEach((c) => {
              if (c.readyState === WebSocket.OPEN) {
                c.send(JSON.stringify({
                  type: 'message_reaction_updated',
                  messageId: msg.messageId,
                  emoji: msg.emoji,
                  userId: client.userId,
                  userName: client.userName,
                }));
              }
            });
            break;
          }

          // --- WebRTC Signaling for Voice / Video Calls & Meetings ---
          case 'webrtc_join_room': {
            if (client.userId === 'usr-unauthenticated') {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Unauthorized: Valid authentication required to join meeting.',
              }));
              return;
            }
            const { roomId, mediaState } = msg;
            client.currentRoom = roomId;
            console.log(`[WebRTC] Peer ${client.userName} (${client.userId}) joined room: ${roomId}`);

            // Notify all other clients in the same meeting room
            wss.clients.forEach((otherWs) => {
              const otherClient = clients.get(otherWs);
              if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN && otherClient?.currentRoom === roomId) {
                otherWs.send(JSON.stringify({
                  type: 'webrtc_peer_joined',
                  peerId: client.userId,
                  peerName: client.userName,
                  peerRole: client.userRole,
                  mediaState: mediaState || { audio: true, video: true, screen: false },
                }));
              }
            });
            break;
          }

          case 'webrtc_offer': {
            const { targetUserId, offer, roomId } = msg;
            wss.clients.forEach((targetWs) => {
              const targetClient = clients.get(targetWs);
              if (targetClient?.userId === targetUserId && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                  type: 'webrtc_offer',
                  senderId: client.userId,
                  senderName: client.userName,
                  offer,
                  roomId,
                }));
              }
            });
            break;
          }

          case 'webrtc_answer': {
            const { targetUserId, answer, roomId } = msg;
            wss.clients.forEach((targetWs) => {
              const targetClient = clients.get(targetWs);
              if (targetClient?.userId === targetUserId && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                  type: 'webrtc_answer',
                  senderId: client.userId,
                  answer,
                  roomId,
                }));
              }
            });
            break;
          }

          case 'webrtc_ice_candidate': {
            const { targetUserId, candidate, roomId } = msg;
            wss.clients.forEach((targetWs) => {
              const targetClient = clients.get(targetWs);
              if (targetClient?.userId === targetUserId && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                  type: 'webrtc_ice_candidate',
                  senderId: client.userId,
                  candidate,
                  roomId,
                }));
              }
            });
            break;
          }

          case 'webrtc_media_toggle': {
            const { roomId, isMuted, isVideoOff, isScreenSharing } = msg;
            wss.clients.forEach((otherWs) => {
              const otherClient = clients.get(otherWs);
              if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN && otherClient?.currentRoom === roomId) {
                otherWs.send(JSON.stringify({
                  type: 'webrtc_peer_media_toggle',
                  peerId: client.userId,
                  isMuted,
                  isVideoOff,
                  isScreenSharing,
                }));
              }
            });
            break;
          }

          case 'webrtc_leave_room': {
            const { roomId } = msg;
            client.currentRoom = undefined;
            wss.clients.forEach((otherWs) => {
              const otherClient = clients.get(otherWs);
              if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN && otherClient?.currentRoom === roomId) {
                otherWs.send(JSON.stringify({
                  type: 'webrtc_peer_left',
                  peerId: client.userId,
                  peerName: client.userName,
                }));
              }
            });
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[WEBSOCKET] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client?.currentRoom) {
        wss.clients.forEach((otherWs) => {
          const otherClient = clients.get(otherWs);
          if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN && otherClient?.currentRoom === client.currentRoom) {
            otherWs.send(JSON.stringify({
              type: 'webrtc_peer_left',
              peerId: client.userId,
              peerName: client.userName,
            }));
          }
        });
      }
      clients.delete(ws);
    });
  });

  return wss;
}
