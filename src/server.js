const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

// Connect MongoDB \& seed admin
connectDB().then(async () => {
  const seedAdmin = require("./utils/seedAdmin");
  await seedAdmin();
});

const app = express();
const server = http.createServer(app);

// ─── Socket.io (Real-time Chat) ───────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', credentials: true }
});

// Store io instance for use in controllers
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`⚡ User connected: ${socket.id}`);

  // Join personal room
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  // Send message
  socket.on('sendMessage', (data) => {
    io.to(data.receiverId).emit('receiveMessage', data);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(data.receiverId).emit('typing', { senderId: data.senderId });
  });

  // Order notifications
  socket.on('orderUpdate', (data) => {
    io.to(data.userId).emit('orderNotification', data);
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' }
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── General Middleware ───────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────
// Serve static frontend files
app.use(express.static(require('path').join(__dirname, '../public')));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/talents',       require('./routes/talents'));
app.use('/api/jobs',          require('./routes/jobs'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/reviews',       require('./routes/reviews'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/escrow',        require('./routes/escrow'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/upload',        require('./routes/upload'));
app.use('/api/wishlist',      require('./routes/wishlist'));
app.use('/api/notifications', require('./routes/notifications'));

// ─── Health Check ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Mercx Talents API v2.0 is LIVE!',
    version: '2.0.0',
    features: [
      '✅ Authentication (JWT + Refresh Tokens)',
      '✅ Real-time Chat (Socket.io)',
      '✅ Payments (Stripe + Paystack)',
      '✅ File Uploads (Cloudinary)',
      '✅ Email Notifications',
      '✅ Rate Limiting & Security',
      '✅ Admin Dashboard',
      '✅ Wishlist System',
      '✅ Notification System'
    ]
  });
});

// ─── 404 & Error Handler ──────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Mercx Talents v2.0 running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`⚡ Socket.io ready for real-time chat`);
});

module.exports = { app, server };
