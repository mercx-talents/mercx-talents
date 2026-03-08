const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ['freelancer', 'client', 'admin'], default: 'freelancer' },
  avatar: { type: String, default: '' },
  bio: { type: String, maxlength: 500 },
  tagline: { type: String, maxlength: 100 },
  location: { country: String, city: String },
  skills: [String],
  languages: [{ language: String, proficiency: { type: String, enum: ['basic', 'conversational', 'fluent', 'native'] } }],
  education: [{ school: String, degree: String, year: Number }],
  experience: [{ title: String, company: String, from: Date, to: Date, description: String }],
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  wallet: {
    balance: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    total_earned: { type: Number, default: 0 }
  },
  rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
  completedOrders: { type: Number, default: 0 },
  socialLinks: { linkedin: String, github: String, portfolio: String, twitter: String },
  notifications_enabled: { type: Boolean, default: true },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerifyToken: String,
  refreshToken: String,
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(pwd) {
  return await bcrypt.compare(pwd, this.password);
};

userSchema.methods.getResetToken = function() {
  const token = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  return token;
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
