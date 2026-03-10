const express   = require('express');
const http      = require('http');
const { Server }= require('socket.io');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

// ─── Connect DB & seed admin ─────────────────────────────────
connectDB().then(async () => {
  const seedAdmin = require('./utils/seedAdmin');
  await seedAdmin();
});

const app    = express();
const server = http.createServer(app);

// ─── Security ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(mongoSanitize());

const limiter = rateLimit({ windowMs: 15*60*1000, max: 200,
  message: { success:false, message:'Too many requests, slow down.' } });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 15,
  message: { success:false, message:'Too many auth attempts. Try again in 15 minutes.' } });

app.use('/api/', limiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── General Middleware ──────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ─── API Routes ──────────────────────────────────────────────
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

// ─── API Health Check ────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Mercx Talents API v3.0 LIVE',
    version: '3.0.0',
    features: [
      '✅ JWT Auth + Refresh Tokens',
      '✅ Escrow Payment System',
      '✅ E2E Encrypted Chat',
      '✅ Stripe + Paystack Payments',
      '✅ Real-time Socket.io',
      '✅ Admin Dashboard',
      '✅ Dispute Resolution',
      '✅ Wallet System',
      '✅ File Uploads (Cloudinary)',
      '✅ Email Notifications'
    ]
  });
});

// ─── HTML Page Routes ─────────────────────────────────────────
app.get('/login',    (req, res) => res.sendFile(path.join(__dirname, '../public/pages/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '../public/pages/register.html')));
app.get('/dashboard',(req, res) => res.sendFile(path.join(__dirname, '../public/pages/dashboard.html')));
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, '../public/pages/admin.html')));

// ─── Socket.io ───────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', credentials: true }
});
app.set('io', io);

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(userId);
    onlineUsers.set(userId, socket.id);
    io.emit('userOnline', { userId });
  });
  socket.on('sendMessage', (data) => {
    io.to(data.receiverId).emit('receiveMessage', data);
  });
  socket.on('typing', (data) => {
    socket.to(data.receiverId).emit('typing', { senderId: data.senderId });
  });
  socket.on('stopTyping', (data) => {
    socket.to(data.receiverId).emit('stopTyping', { senderId: data.senderId });
  });
  socket.on('orderUpdate', (data) => {
    io.to(data.userId).emit('orderNotification', data);
  });
  socket.on('disconnect', () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) { onlineUsers.delete(uid); io.emit('userOffline', { userId: uid }); break; }
    }
  });
});

// ─── 404 & Error Handler ─────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ success:false, message:'API route not found' });
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Mercx Talents v3.0 — Port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`⚡ Socket.io ready`);
});

module.exports = { app, server };
