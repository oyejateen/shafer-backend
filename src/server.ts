import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import express from 'express';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

interface FileMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
}

interface Room {
  sender: string;
  metadata: FileMetadata;
  recipients: string[];
}

const app = express();
const server = createServer(app);
const activeRooms = new Map<string, Room>();

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

io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-room', ({ roomId, metadata }: { roomId: string; metadata: FileMetadata }) => {
    try {
      activeRooms.set(roomId, {
        sender: socket.id,
        metadata,
        recipients: []
      });
      socket.join(roomId);
      console.log(`Room ${roomId} created by ${socket.id}`);
      socket.emit('room-created', { roomId });
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('room-error', 'Failed to create room');
    }
  });

  socket.on('join-room', (roomId: string) => {
    try {
      const room = activeRooms.get(roomId);
      if (!room) {
        socket.emit('room-error', 'Room not found or expired');
        return;
      }

      socket.join(roomId);
      socket.emit('ready-to-receive', { metadata: room.metadata });
      room.recipients.push(socket.id);
      
      io.to(room.sender).emit('recipient-joined', {
        recipientId: socket.id,
        roomId
      });

      console.log(`Client ${socket.id} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('room-error', 'Failed to join room');
    }
  });

  socket.on('file-chunk', ({ chunk, roomId, chunkIndex, totalChunks }) => {
    try {
      const room = activeRooms.get(roomId);
      if (room?.sender === socket.id) {
        socket.to(roomId).emit('receive-chunk', { chunk, chunkIndex, totalChunks });
      }
    } catch (error) {
      console.error('Error sending chunk:', error);
    }
  });

  socket.on('transfer-complete', (roomId: string) => {
    try {
      const room = activeRooms.get(roomId);
      if (room?.sender === socket.id) {
        socket.to(roomId).emit('transfer-complete');
        activeRooms.delete(roomId);
      }
    } catch (error) {
      console.error('Error completing transfer:', error);
    }
  });

  socket.on('disconnect', () => {
    try {
      Array.from(activeRooms.entries())
        .filter(([_, room]) => room.sender === socket.id)
        .forEach(([roomId]) => {
          io.to(roomId).emit('transfer-cancelled', 'Sender disconnected');
          activeRooms.delete(roomId);
        });
      console.log('Client disconnected:', socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});

// Keep-alive ping
setInterval(() => {
  https.get(`https://${process.env.PROJECT_DOMAIN}.glitch.me/`);
}, 280000); // Every 4.6 minutes 