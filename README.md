# ChatMe Backend

Backend server for the ChatMe application built with Node.js, TypeScript, Express, Socket.io, and MongoDB.

## Features

- Real-time messaging with Socket.io
- Message status tracking (sent, delivered, seen)
- Online/offline status
- Typing indicators
- Message operations (edit, delete, reply)
- MongoDB for data persistence

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```
PORT=3000
DB_URL=mongodb+srv://Deepak-Yadav:Deepak2000@cluster0.gg9lco5.mongodb.net/chatme?appName=Cluster0
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Run the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/history/:userId1/:userId2` - Get chat history between two users
- `GET /api/user/:userId` - Get user information
- `POST /api/user` - Create or update user
- `GET /api/users` - Get all users

## Socket.io Events

### Client to Server:
- `join` - Join with user info
- `send-message` - Send a message
- `message-seen` - Mark messages as seen
- `typing` - Typing indicator
- `edit-message` - Edit a message
- `delete-message` - Delete a message
- `get-online-status` - Get user online status

### Server to Client:
- `receive-message` - Receive a new message
- `message-sent` - Message sent confirmation
- `message-status-update` - Message status update (delivered/seen)
- `messages-seen` - Messages marked as seen
- `typing` - Typing indicator from other user
- `message-edited` - Message edited notification
- `message-deleted` - Message deleted notification
- `user-online` - User came online
- `user-offline` - User went offline
- `online-status` - Online status response

