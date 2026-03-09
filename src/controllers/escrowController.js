const Escrow = require('../models/Escrow');
const { Order, Notification } = require('../models/index');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const https = require('https');

// ─── CREATE ESCROW (when order is placed) ────────────────────
// Called automatically when order is created
exports.createEscrow = async (orderId, clientId, freelancerId, amount) => {
  const feePercent = process.env.PLATFORM_FEE_PERCENT || 10;
  const platformFee = (amount * feePercent) / 100;
  const freelancerEarning = amount - platformFee;

  const escrow = await Escrow.create({
    order: orderId, client: clientId,
    freelancer: freelancerId, amount,
    platformFee, freelancerEarning,
    timeline: [{ action: 'Escrow created — awaiting payment', note: `$${amount} to be held` }]
  });
  return escrow;
};

// ─── FUND ESCROW via Stripe ───────────────────────────────────
// POST /api/escrow/:orderId/fund/stripe
exports.fundWithStripe = async (req, res) => {
  try {
    const escrow = await Escrow.findOne({ order: req.params.orderId });
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });
    if (escrow.status !== 'pending') return res.status(400).json({ success: false, message: 'Escrow already funded' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(escrow.amount * 100),
      currency: 'usd',
      capture_method: 'manual', // Don't capture yet — hold funds
      metadata: { escrowId: escrow._id.toString(), orderId: req.params.orderId }
    });

    res.json({ success: true, clientSecret: paymentIntent.client_secret, escrowId: escrow._id, amount: escrow.amount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── FUND ESCROW via Paystack ─────────────────────────────────
// POST /api/escrow/:orderId/fund/paystack
exports.fundWithPaystack = async (req, res) => {
  try {
    const escrow = await Escrow.findOne({ order: req.params.orderId });
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });

    const params = JSON.stringify({
      email: req.user.email,
      amount: Math.round(escrow.amount * 100),
      reference: `escrow_${escrow._id}_${Date.now()}`,
      callback_url: `${process.env.CLIENT_URL}/escrow/verify`,
      metadata: { escrowId: escrow._id.toString(), orderId: req.params.orderId }
    });

    const options = {
      hostname: 'api.paystack.co', port: 443,
      path: '/transaction/initialize', method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', chunk => data += chunk);
      paystackRes.on('end', () => {
        const result = JSON.parse(data);
        res.json({ success: true, authorizationUrl: result.data.authorization_url, reference: result.data.reference });
      });
    });

    paystackReq.write(params);
    paystackReq.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CONFIRM PAYMENT & MARK ESCROW FUNDED ────────────────────
// POST /api/escrow/:orderId/confirm
exports.confirmFunding = async (req, res) => {
  try {
    const { paymentId, paymentMethod } = req.body;
    const escrow = await Escrow.findOne({ order: req.params.orderId });
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });

    escrow.status = 'funded';
    escrow.paymentId = paymentId;
    escrow.paymentMethod = paymentMethod;
    escrow.fundedAt = new Date();
    escrow.timeline.push({ action: 'Escrow funded', performedBy: req.user.id, note: `$${escrow.amount} secured via ${paymentMethod}` });
    await escrow.save();

    // Activate the order
    await Order.findByIdAndUpdate(req.params.orderId, { status: 'in_progress', isPaid: true });

    // Notify freelancer
    await Notification.create({
      user: escrow.freelancer, title: '💰 Payment Secured!',
      message: `$${escrow.freelancerEarning} is held in escrow for your order. Start working!`,
      type: 'payment'
    });

    res.json({ success: true, message: `$${escrow.amount} secured in escrow! Order is now active. 🔒`, data: escrow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── RELEASE FUNDS TO FREELANCER ─────────────────────────────
// POST /api/escrow/:orderId/release
exports.releaseFunds = async (req, res) => {
  try {
    const escrow = await Escrow.findOne({ order: req.params.orderId, client: req.user.id });
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });
    if (escrow.status !== 'funded') return res.status(400).json({ success: false, message: 'Escrow is not in funded state' });

    // Transfer earnings to freelancer wallet
    await User.findByIdAndUpdate(escrow.freelancer, {
      $inc: {
        'wallet.balance': escrow.freelancerEarning,
        'wallet.total_earned': escrow.freelancerEarning
      }
    });

    escrow.status = 'released';
    escrow.releasedAt = new Date();
    escrow.timeline.push({ action: 'Funds released to freelancer', performedBy: req.user.id, note: `$${escrow.freelancerEarning} added to freelancer wallet` });
    await escrow.save();

    // Complete the order
    await Order.findByIdAndUpdate(req.params.orderId, { status: 'completed', completedAt: new Date() });

    // Notify freelancer
    await Notification.create({
      user: escrow.freelancer, title: '🎉 Payment Released!',
      message: `$${escrow.freelancerEarning} has been added to your wallet!`,
      type: 'payment'
    });

    res.json({ success: true, message: `$${escrow.freelancerEarning} released to freelancer! 🎉`, data: escrow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── REFUND CLIENT ────────────────────────────────────────────
// POST /api/escrow/:orderId/refund
exports.refundClient = async (req, res) => {
  try {
    const escrow = await Escrow.findOne({ order: req.params.orderId });
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });
    if (!['funded', 'disputed'].includes(escrow.status)) return res.status(400).json({ success: false, message: 'Cannot refund this escrow' });

    // Add funds back to client wallet
    await User.findByIdAndUpdate(escrow.client, {
      $inc: { 'wallet.balance': escrow.amount }
    });

    escrow.status = 'refunded';
    escrow.refundedAt = new Date();
    escrow.timeline.push({ action: 'Refund issued to client', performedBy: req.user.id, note: `$${escrow.amount} returned to client wallet` });
    await escrow.save();

    await Order.findByIdAndUpdate(req.params.orderId, { status: 'cancelled', cancelledAt: new Date() });

    await Notification.create({
      user: escrow.client, title: '💸 Refund Processed',
      message: `$${escrow.amount} has been refunded to your wallet.`,
      type: 'payment'
    });

    res.json({ success: true, message: `$${escrow.amount} refunded to client! 💸`, data: escrow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── RAISE DISPUTE ────────────────────────────────────────────
// POST /api/escrow/:orderId/dispute
exports.raiseDispute = async (req, res) => {
  try {
    const { reason, evidence } = req.body;
    const escrow = await Escrow.findOne({ order: req.params.orderId });
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });
    if (escrow.status !== 'funded') return res.status(400).json({ success: false, message: 'Can only dispute funded escrows' });

    escrow.status = 'disputed';
    escrow.dispute = { raisedBy: req.user.id, reason, evidence: evidence || [], raisedAt: new Date() };
    escrow.timeline.push({ action: 'Dispute raised', performedBy: req.user.id, note: reason });
    await escrow.save();

    await Order.findByIdAndUpdate(req.params.orderId, { status: 'disputed' });

    // Notify admin and other party
    const otherParty = req.user.id === escrow.client.toString() ? escrow.freelancer : escrow.client;
    await Notification.create({
      user: otherParty, title: '⚠️ Dispute Raised',
      message: `A dispute has been raised for your order. Admin will review within 24 hours.`,
      type: 'order'
    });

    res.json({ success: true, message: 'Dispute raised. Admin will review within 24 hours. ⚠️', data: escrow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── RESOLVE DISPUTE (Admin only) ────────────────────────────
// POST /api/escrow/:orderId/resolve
exports.resolveDispute = async (req, res) => {
  try {
    const { winner, resolution } = req.body; // winner: 'client', 'freelancer', 'split'
    const escrow = await Escrow.findOne({ order: req.params.orderId });
    if (!escrow || escrow.status !== 'disputed') return res.status(404).json({ success: false, message: 'Disputed escrow not found' });

    if (winner === 'freelancer') {
      await User.findByIdAndUpdate(escrow.freelancer, { $inc: { 'wallet.balance': escrow.freelancerEarning, 'wallet.total_earned': escrow.freelancerEarning } });
    } else if (winner === 'client') {
      await User.findByIdAndUpdate(escrow.client, { $inc: { 'wallet.balance': escrow.amount } });
    } else if (winner === 'split') {
      const half = escrow.amount / 2;
      await User.findByIdAndUpdate(escrow.freelancer, { $inc: { 'wallet.balance': half } });
      await User.findByIdAndUpdate(escrow.client, { $inc: { 'wallet.balance': half } });
    }

    escrow.status = 'resolved';
    escrow.dispute.resolvedBy = req.user.id;
    escrow.dispute.resolution = resolution;
    escrow.dispute.resolvedAt = new Date();
    escrow.dispute.winner = winner;
    escrow.timeline.push({ action: `Dispute resolved — winner: ${winner}`, performedBy: req.user.id, note: resolution });
    await escrow.save();

    // Notify both parties
    for (const userId of [escrow.client, escrow.freelancer]) {
      await Notification.create({ user: userId, title: '✅ Dispute Resolved', message: `Your dispute has been resolved. Winner: ${winner}`, type: 'payment' });
    }

    res.json({ success: true, message: `Dispute resolved. Winner: ${winner} ✅`, data: escrow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ESCROW STATUS ────────────────────────────────────────
// GET /api/escrow/:orderId
exports.getEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findOne({ order: req.params.orderId })
      .populate('client', 'name avatar')
      .populate('freelancer', 'name avatar')
      .populate('timeline.performedBy', 'name');
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });
    res.json({ success: true, data: escrow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
