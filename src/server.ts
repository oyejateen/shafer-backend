import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket',
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Your existing socket server code from project/utils/socketServer.ts
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  // ... rest of your socket logic
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
}); 