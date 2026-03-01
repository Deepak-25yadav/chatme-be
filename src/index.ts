import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/database';
import socketHandler from './socket/socketHandler';
import messageRoutes from './routes/messageRoutes';
import authRoutes from './routes/authRoutes';
import fileRoutes from './routes/fileRoutes';
import musicRoutes from './routes/musicRoutes';
import activityRoutes from './routes/activityRoutes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { sanitizeInput } from './middleware/validation.middleware';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sanitize input
app.use(sanitizeInput);

// Serve uploaded files statically
app.use('/api/files', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', fileRoutes);
app.use('/api', messageRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/activity', activityRoutes);

// 404 handler
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize socket handler
socketHandler(io);

const PORT = process.env.PORT || 3000;

// Connect to database and start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // ── Render free-tier keep-alive self-ping ──────────────────────────────
    // Render shuts down the server after 15 min of inactivity (free tier).
    // We ping our own /health endpoint every 10 min to keep it warm 24/7.
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        const url = `${SELF_URL}/health`;
        // Use the built-in https/http module — no extra packages needed
        const lib = url.startsWith('https') ? require('https') : require('http');
        lib.get(url, (res: any) => {
          console.log(`[KeepAlive] Self-ping → ${url} | status: ${res.statusCode}`);
        }).on('error', (err: any) => {
          console.warn('[KeepAlive] Self-ping failed:', err.message);
        });
      }, PING_INTERVAL);

      console.log(`[KeepAlive] Self-ping started — every 10min → ${SELF_URL}/health`);
    }
    // ── End keep-alive ─────────────────────────────────────────────────────
  });
});

export { io };

