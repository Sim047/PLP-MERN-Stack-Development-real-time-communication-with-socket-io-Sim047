
---

# 💬 Rooms Chat — Real-Time Chat Application

A modern **real-time chat platform** featuring rooms, direct messaging, reactions, typing indicators, online status, image uploads, and a clean, responsive UI.

Built with:

* ⚛️ **React + Vite**
* 🟦 **TypeScript**
* 🧠 **Node.js + Express**
* ⚡ **Socket.IO (real-time)**
* 🗄️ **MongoDB + Mongoose**
* 🔐 **JWT Authentication**
* 🚀 Deployable on **Render** + **Vercel**

---

# 🌟 Features

### 🔌 Real-Time Messaging

* Live chat powered by **Socket.IO**
* Typing indicators
* Delivered & Read receipts
* Online/offline presence tracking
* Auto-reconnect & room subscriptions

### 💬 Rooms + Direct Messages

* Public rooms (General, Tech, Random)
* Private 1-to-1 conversations
* Message search-ready structure

### 🖼️ Media Support

* Image uploads (Multer + Sharp)
* Avatars with live update
* Attachments appear inside chat bubbles

### 😀 Extra Goodies

* Emoji reactions (❤️ 🔥 😂 👍 etc.)
* Clean light/dark dark-themed UI
* Mobile-friendly responsive layout
* Error handling + loading states

---

# 🖼️ Screenshots

### 🔑 Login Page

<img src="./Screenshots/Login.png" alt="Login Page" width="600"/>

---

### 📝 Register Page

<img src="./Screenshots/Register.png" alt="Register Page" width="600"/>

---

### 💬 Chat Room

<img src="./Screenshots/Chats.png" alt="Chat Room" width="600"/>

---

### 📱 Mobile View

<img src="./screenshots/Mobile.png" alt="Mobile Chat UI" width="400"/>

---

# ⚙️ Installation — Local Development

## 🧩 Backend (Server)

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The backend starts at:

```
http://localhost:5000
```

### Required `.env` values

```
PORT=5000
MONGO_URI=your_mongo_connection_string
JWT_SECRET=supersecret
FRONTEND_URL=http://localhost:5173
UPLOAD_DIR=uploads
```

---

## 🖥️ Frontend (Client)

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at:

```
http://localhost:5173
```

Environment variable:

```
VITE_API_URL=http://localhost:5000
```

---

# 🧪 API Overview

### 🔐 Authentication

* `POST /api/auth/register`
* `POST /api/auth/login`

### 👤 Users

* `POST /api/users/avatar`
* `GET /api/users/me`

### 💬 Messaging

* `GET /api/messages/:room`
* `DELETE /api/messages/:id`
* `POST /api/files/upload`

### ⚡ Socket.IO Events

* `join_room`
* `send_message`
* `message_edited`
* `delete_message`
* `typing`
* `presence_update`
* `react`
* `delivered`
* `read`

---

# 🚀 Deployment Guide

## 🌐 Backend → Render.com

### 1️⃣ Create new Web Service

* Environment: **Node**
* Root folder: `/backend`

### 2️⃣ Set build & start commands:

```
Build Command: npm install
Start Command: npm start
```

### 3️⃣ Add Environment Variables

Match your `.env.example`

### 4️⃣ Persistent Uploads

Add a **Render Disk**:

* Name: `chat_uploads`
* Mount: `/backend/uploads`

### 5️⃣ CORS Settings

Ensure:

```
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

---

## 🎨 Frontend → Vercel

### 1️⃣ Import your GitHub repo

Select the **frontend** folder.

### 2️⃣ Add env variable

```
VITE_API_URL=https://your-render-backend.onrender.com
```

### 3️⃣ Build settings:

* **Framework:** Vite
* **Build Command:** `npm run build`
* **Output Directory:** `dist`

### 4️⃣ Optional vercel.json

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```
MY DEPLOYED APP LINK - https://plp-mern-stack-development-real-tim.vercel.app/
