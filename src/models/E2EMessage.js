const mongoose = require('mongoose');

const e2eMessageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Encrypted content — different keys for sender and receiver
  encryptedForSender: { type: String, required: true },   // AES encrypted with sender's key
  encryptedForReceiver: { type: String, required: true }, // AES encrypted with receiver's key

  // Encrypted AES keys — wrapped with each user's RSA public key
  senderKeyEncrypted: { type: String },     // AES key encrypted with sender's RSA public key
  receiverKeyEncrypted: { type: String },   // AES key encrypted with receiver's RSA public key

  // IV for AES decryption
  iv: { type: String, required: true },

  // Metadata (not encrypted)
  messageType: { type: String, enum: ['text', 'file', 'image', 'order', 'system'], default: 'text' },
  files: [{ url: String, name: String, mimeType: String, size: Number }],
  isRead: { type: Boolean, default: false },
  readAt: Date,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  editedAt: Date,
  reactions: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, emoji: String }]
}, { timestamps: true });

// ─── PUBLIC KEY STORE ─────────────────────────────────────────
// Stores each user's RSA public key for E2E encryption
const publicKeySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  publicKey: { type: String, required: true }, // RSA public key (PEM format)
  fingerprint: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  E2EMessage: mongoose.model('E2EMessage', e2eMessageSchema),
  PublicKey: mongoose.model('PublicKey', publicKeySchema)
};
