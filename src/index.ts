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
  });
});

export { io };

