// src/socket.js
import { io } from 'socket.io-client';

// Force WebSocket transport to avoid polling issues.
const socket = io("http://localhost:4000", { transports: ["websocket"] });

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});
socket.on('reconnect_error', (err) => {
  console.error('Socket reconnect error:', err);
});
socket.on('reconnect_failed', () => {
  console.error('Socket failed to reconnect.');
});

export default socket;
