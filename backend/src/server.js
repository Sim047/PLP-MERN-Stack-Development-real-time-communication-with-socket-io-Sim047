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

// ---------------------------
// Path setup
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------
// CLEAN FRONTEND URL (IMPORTANT)
// ---------------------------
let FRONTEND = process.env.FRONTEND_URL || "*";
FRONTEND = FRONTEND.replace(/\/$/, ""); // remove trailing slash

console.log("🔵 Allowed CORS Origin:", FRONTEND);

// ---------------------------
// App + Socket setup
// ---------------------------
const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: FRONTEND,
    credentials: true,
  })
);

app.use(express.json({ limit: "25mb" }));

const io = new Server(server, {
  cors: {
    origin: FRONTEND,
    methods: ["GET", "POST"],
  },
});

// ---------------------------
// Static File Hosting
// ---------------------------
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express.static(path.join(__dirname, "..", UPLOAD_DIR)));

// ---------------------------
// API Routes
// ---------------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/files", fileRoutes);

// ---------------------------
// Socket.IO Logic
// ---------------------------
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  const clientUser = socket.handshake.auth?.user;

  if (clientUser && (clientUser._id || clientUser.id)) {
    const uid = clientUser._id || clientUser.id;
    onlineUsers.set(uid, socket.id);

    io.emit("presence_update", { userId: uid, status: "online" });
  }

  socket.on("join_room", (room) => socket.join(room));

  socket.on("send_message", async ({ room, message }) => {
    try {
      const saved = await Message.create({
        sender: message.sender._id || message.sender.id,
        text: message.text,
        room,
        fileUrl: message.fileUrl || "",
        replyTo: message.replyTo || null,
        createdAt: new Date(),
      });

      const populated = await Message.findById(saved._id)
        .populate("sender", "username avatar")
        .populate("replyTo")
        .populate("readBy", "username");

      io.to(room).emit("receive_message", populated);
    } catch (err) {
      console.error("❌ send_message error:", err);
    }
  });

  socket.on("react", async ({ room, messageId, userId, emoji }) => {
    try {
      userId = userId?.id || userId?._id || userId;

      const msg = await Message.findById(messageId);
      if (!msg) return;

      const exists = msg.reactions.find((r) => String(r.userId) === String(userId));

      if (exists && exists.emoji === emoji) {
        msg.reactions = msg.reactions.filter(
          (r) => String(r.userId) !== String(userId)
        );
      } else {
        msg.reactions = msg.reactions.filter(
          (r) => String(r.userId) !== String(userId)
        );
        msg.reactions.push({ userId, emoji });
      }

      await msg.save();

      const populated = await Message.findById(messageId)
        .populate("sender", "username avatar")
        .populate("replyTo")
        .populate("readBy", "username");

      io.to(room).emit("reaction_update", populated);
    } catch (err) {
      console.error("❌ react error:", err);
    }
  });

  socket.on("typing", ({ room, userId, typing }) =>
    socket.to(room).emit("typing", { userId, typing })
  );

  socket.on("delivered", async ({ room, messageId, userId }) => {
    try {
      userId = userId?.id || userId?._id || userId;

      const msg = await Message.findById(messageId);
      if (!msg) return;

      if (!msg.readBy.includes(userId)) {
        msg.readBy.push(userId);
        await msg.save();
      }

      io.to(room).emit("delivered", { messageId, userId });
    } catch (err) {
      console.error("❌ delivered error:", err);
    }
  });

  socket.on("read", async ({ room, messageId, userId }) => {
    try {
      userId = userId?.id || userId?._id || userId;

      const msg = await Message.findById(messageId);
      if (!msg) return;

      if (!msg.readBy.includes(userId)) {
        msg.readBy.push(userId);
        await msg.save();
      }

      io.to(room).emit("read", { messageId, userId });
    } catch (err) {
      console.error("❌ read error:", err);
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

// ---------------------------
// Database connect
// ---------------------------
const MONGO = process.env.MONGO_URI;

console.log("🔵 Connecting to Mongo:", MONGO);

mongoose
  .connect(MONGO)
  .then(() => {
    console.log("✅ MongoDB connected!");
    server.listen(process.env.PORT || 5000, () =>
      console.log("🚀 Server online on port", process.env.PORT || 5000)
    );
  })
  .catch((err) => {
    console.error("❌ Mongo connection failed:", err.message);
    process.exit(1);
  });
