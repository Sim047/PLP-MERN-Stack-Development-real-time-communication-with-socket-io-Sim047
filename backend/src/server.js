import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import messageRoutes from './routes/messages.js';
import fileRoutes from './routes/files.js';

import Message from './models/Message.js';

// path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== FRONTEND / CORS cleaning =====
let FRONTEND = (process.env.FRONTEND_URL || '*').trim();
FRONTEND = FRONTEND.replace(/\/$/, ''); // remove trailing slash if present
console.log('🔵 FRONTEND for CORS:', FRONTEND);

// create express + server
const app = express();
const server = http.createServer(app);

// cors for express
app.use(cors({
  origin: FRONTEND,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS']
}));

app.use(express.json({ limit: '20mb' }));

// static uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', UPLOAD_DIR)));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);

// ===== Socket.IO with same origin =====
const io = new Server(server, {
  cors: { origin: FRONTEND, methods: ['GET','POST'] }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('[io] connected', socket.id);
  const clientUser = socket.handshake.auth?.user;
  if (clientUser && (clientUser._id || clientUser.id)) {
    const uid = clientUser._id || clientUser.id;
    onlineUsers.set(uid, socket.id);
    io.emit('presence_update', { userId: uid, status: 'online' });
  }

  socket.on('join_room', (room) => socket.join(room));

  socket.on('send_message', async ({ room, message }) => {
    try {
      const saved = await Message.create({
        sender: message.sender._id || message.sender.id || message.sender,
        text: message.text || '',
        room,
        fileUrl: message.fileUrl || '',
        replyTo: message.replyTo || null,
        createdAt: message.createdAt ? new Date(message.createdAt) : new Date()
      });
      const populated = await Message.findById(saved._id)
        .populate('sender','username avatar')
        .populate('replyTo')
        .populate('readBy','username');
      io.to(room).emit('receive_message', populated);
    } catch (err) {
      console.error('[io] send_message error', err);
      socket.emit('error_message', { message: 'failed to save' });
    }
  });

  socket.on('react', async ({ room, messageId, userId, emoji }) => {
    try {
      if (userId && (userId.id || userId._id)) userId = userId.id || userId._id;
      if (!userId) return;
      const msg = await Message.findById(messageId);
      if (!msg) return;
      const exists = msg.reactions.find(r => String(r.userId) === String(userId));
      if (exists && exists.emoji === emoji) {
        msg.reactions = msg.reactions.filter(r => String(r.userId) !== String(userId));
      } else {
        msg.reactions = msg.reactions.filter(r => String(r.userId) !== String(userId));
        msg.reactions.push({ userId, emoji });
      }
      await msg.save();
      const populated = await Message.findById(messageId)
        .populate('sender','username avatar')
        .populate('replyTo')
        .populate('readBy','username');
      io.to(room).emit('reaction_update', populated);
    } catch (err) {
      console.error('[io] react error', err);
    }
  });

  socket.on('typing', ({ room, userId, typing }) => socket.to(room).emit('typing', { userId, typing }));

  socket.on('delivered', async ({ room, messageId, userId }) => {
    try {
      if (userId && (userId.id || userId._id)) userId = userId.id || userId._id;
      const msg = await Message.findById(messageId);
      if (!msg) return;
      if (!msg.readBy.map(String).includes(String(userId))) {
        msg.readBy.push(userId);
        await msg.save();
      }
      io.to(room).emit('delivered', { messageId, userId });
    } catch (err) { console.error('[io] delivered err', err); }
  });

  socket.on('read', async ({ room, messageId, userId }) => {
    try {
      if (userId && (userId.id || userId._id)) userId = userId.id || userId._id;
      const msg = await Message.findById(messageId);
      if (!msg) return;
      if (!msg.readBy.map(String).includes(String(userId))) {
        msg.readBy.push(userId);
        await msg.save();
      }
      io.to(room).emit('read', { messageId, userId });
    } catch (err) { console.error('[io] read err', err); }
  });

  socket.on('disconnect', () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        io.emit('presence_update', { userId: uid, status: 'offline' });
        break;
      }
    }
  });
});

// ===== DB connect / start server =====
const PORT = process.env.PORT || 5000;

const rawUri = process.env.MONGO_URI || '';
const uri = typeof rawUri === 'string' ? rawUri.trim() : rawUri;

console.log('==== debug MONGO_URI (json) ====');
console.log(JSON.stringify(rawUri));
console.log('trimmed length:', uri.length);

if (!uri) {
  console.error('❌ MONGO_URI empty. Set env var MONGO_URI');
  process.exit(1);
}
if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
  console.error('❌ MONGO URI invalid - must start with mongodb:// or mongodb+srv://');
  console.error('value:', JSON.stringify(uri));
  process.exit(1);
}

mongoose.connect(uri, { autoIndex: true })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(PORT, () => console.log('🚀 Server running on', PORT));
  })
  .catch(err => {
    console.error('❌ mongo connect err', err && err.message ? err.message : err);
    process.exit(1);
  });
