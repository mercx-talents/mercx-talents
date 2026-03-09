const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  platformFee: { type: Number, required: true },
  freelancerEarning: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: {
    type: String,
    enum: [
      'pending',       // Waiting for client payment
      'funded',        // Client paid — funds held in escrow
      'released',      // Funds released to freelancer
      'refunded',      // Funds returned to client
      'disputed',      // Under dispute review
      'resolved'       // Dispute resolved
    ],
    default: 'pending'
  },
  paymentMethod: { type: String, enum: ['stripe', 'paystack', 'wallet'] },
  paymentId: String,
  fundedAt: Date,
  releasedAt: Date,
  refundedAt: Date,
  dispute: {
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    evidence: [String],
    raisedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolution: String,
    resolvedAt: Date,
    winner: { type: String, enum: ['client', 'freelancer', 'split'] }
  },
  timeline: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Escrow', escrowSchema);
