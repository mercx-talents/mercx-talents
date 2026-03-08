const mongoose = require('mongoose');

// ─── ORDER MODEL ──────────────────────────────────────────────
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  talent: { type: mongoose.Schema.Types.ObjectId, ref: 'Talent', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  package: { type: String, enum: ['basic', 'standard', 'premium'], required: true },
  requirements: { type: String, required: true },
  price: { type: Number, required: true },
  platformFee: { type: Number, default: 0 },
  freelancerEarning: { type: Number, default: 0 },
  deliveryDays: { type: Number, required: true },
  dueDate: Date,
  status: { type: String, enum: ['pending', 'in_progress', 'delivered', 'revision', 'completed', 'cancelled', 'disputed'], default: 'pending' },
  delivery: { message: String, files: [String], deliveredAt: Date },
  revisions: [{ message: String, requestedAt: { type: Date, default: Date.now } }],
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  isPaid: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['stripe', 'paystack', 'wallet'] },
  paymentId: String,
  isReviewed: { type: Boolean, default: false }
}, { timestamps: true });

orderSchema.pre('save', function(next) {
  if (!this.orderNumber) this.orderNumber = 'MX' + Date.now();
  if (this.price) {
    const fee = (this.price * (process.env.PLATFORM_FEE_PERCENT || 10)) / 100;
    this.platformFee = fee;
    this.freelancerEarning = this.price - fee;
  }
  if (this.deliveryDays && this.isNew) {
    const due = new Date();
    due.setDate(due.getDate() + this.deliveryDays);
    this.dueDate = due;
  }
  next();
});

// ─── REVIEW MODEL ─────────────────────────────────────────────
const reviewSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  talent: { type: mongoose.Schema.Types.ObjectId, ref: 'Talent', required: true },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 1000 },
  categories: {
    communication: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    delivery: { type: Number, min: 1, max: 5 },
    value: { type: Number, min: 1, max: 5 }
  },
  reply: { message: String, repliedAt: Date },
  helpful: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// ─── MESSAGE MODEL ────────────────────────────────────────────
const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, maxlength: 2000 },
  files: [{ url: String, name: String, type: String }],
  isRead: { type: Boolean, default: false },
  readAt: Date,
  messageType: { type: String, enum: ['text', 'file', 'order', 'system'], default: 'text' }
}, { timestamps: true });

// ─── NOTIFICATION MODEL ───────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['order', 'message', 'review', 'payment', 'system', 'promotion'], default: 'system' },
  link: String,
  isRead: { type: Boolean, default: false },
  data: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// ─── WISHLIST MODEL ───────────────────────────────────────────
const wishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  talent: { type: mongoose.Schema.Types.ObjectId, ref: 'Talent', required: true }
}, { timestamps: true });

wishlistSchema.index({ user: 1, talent: 1 }, { unique: true });

// ─── JOB MODEL ────────────────────────────────────────────────
const jobSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 3000 },
  category: { type: String, required: true },
  skills: [String],
  budget: { min: { type: Number, required: true }, max: Number, type: { type: String, enum: ['fixed', 'hourly'], default: 'fixed' } },
  deadline: Date,
  status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
  proposals: [{ freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, proposal: String, bidAmount: Number, submittedAt: { type: Date, default: Date.now } }],
  views: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = {
  Order: mongoose.model('Order', orderSchema),
  Review: mongoose.model('Review', reviewSchema),
  Message: mongoose.model('Message', messageSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  Wishlist: mongoose.model('Wishlist', wishlistSchema),
  Job: mongoose.model('Job', jobSchema)
};
