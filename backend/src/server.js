import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import messageRoutes from "./routes/messages.js";
import fileRoutes from "./routes/files.js";
import Message from "./models/Message.js";

// ----------------------------
// Path setup
// ----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------
// FRONTEND_URL FIX
// Remove trailing slashes ALWAYS
// ----------------------------
let FRONTEND = (process.env.FRONTEND_URL || "*").trim();
FRONTEND = FRONTEND.replace(/\/+$/, ""); // remove trailing slash

console.log("🔵 FRONTEND_URL CLEANED =", FRONTEND);

// ----------------------------
// Express + Socket.io setup
// ----------------------------
const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: FRONTEND,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "20mb" }));

const io = new Server(server, {
  cors: {
    origin: FRONTEND,
    methods: ["GET", "POST"],
  },
});

// ----------------------------
// Static uploads
// ----------------------------
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express.static(path.join(__dirname, "..", UPLOAD_DIR)));

// ----------------------------
// API Routes
// ----------------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/files", fileRoutes);

// ----------------------------
// Socket.io logic
// ----------------------------
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  const clientUser = socket.handshake.auth?.user;

  if (clientUser && (clientUser._id || clientUser.id)) {
    const uid = clientUser._id || clientUser.id;
    onlineUsers.set(uid, socket.id);
    io.emit("presence_update", { userId: uid, status: "online" });
  }

  socket.on("join_room", (room) => {
    socket.join(room);
  });

  socket.on("send_message", async ({ room, message }) => {
    try {
      const saved = await Message.create({
        sender: message.sender._id || message.sender.id,
        text: message.text,
        room,
        fileUrl: message.fileUrl || "",
        replyTo: message.replyTo || null,
        createdAt: message.createdAt || new Date(),
      });

      const populated = await Message.findById(saved._id)
        .populate("sender", "username avatar")
        .populate("replyTo")
        .populate("readBy", "username");

      io.to(room).emit("receive_message", populated);
    } catch (err) {
      console.error("send_message error:", err);
    }
  });

  socket.on("react", async ({ room, messageId, userId, emoji }) => {
    try {
      const uid = userId._id || userId.id || userId;

      const msg = await Message.findById(messageId);
      if (!msg) return;

      const exists = msg.reactions.find(
        (r) => String(r.userId) === String(uid)
      );

      if (exists && exists.emoji === emoji) {
        msg.reactions = msg.reactions.filter(
          (r) => String(r.userId) !== String(uid)
        );
      } else {
        msg.reactions = msg.reactions.filter(
          (r) => String(r.userId) !== String(uid)
        );
        msg.reactions.push({ userId: uid, emoji });
      }

      await msg.save();

      const populated = await Message.findById(messageId)
        .populate("sender", "username avatar")
        .populate("replyTo")
        .populate("readBy", "username");

      io.to(room).emit("reaction_update", populated);
    } catch (err) {
      console.error("reaction error:", err);
    }
  });

  socket.on("typing", ({ room, userId, typing }) => {
    socket.to(room).emit("typing", { userId, typing });
  });

  socket.on("delivered", async ({ room, messageId, userId }) => {
    try {
      const uid = userId._id || userId.id || userId;

      const msg = await Message.findById(messageId);
      if (!msg) return;

      if (!msg.readBy.includes(uid)) {
        msg.readBy.push(uid);
        await msg.save();
      }

      io.to(room).emit("delivered", { messageId, userId: uid });
    } catch (err) {
      console.error("delivered error:", err);
    }
  });

  socket.on("read", async ({ room, messageId, userId }) => {
    try {
      const uid = userId._id || userId.id || userId;

      const msg = await Message.findById(messageId);
      if (!msg) return;

      if (!msg.readBy.includes(uid)) {
        msg.readBy.push(uid);
        await msg.save();
      }

      io.to(room).emit("read", { messageId, userId: uid });
    } catch (err) {
      console.error("read error:", err);
    }
  });

  socket.on("disconnect", () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        io.emit("presence_update", { userId: uid, status: "offline" });
        break;
      }
    }
  });
});

// ----------------------------
// Database & Server Start
// ----------------------------
const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  console.log("❌ Missing MONGO_URI");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, { autoIndex: true })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
