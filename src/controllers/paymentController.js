const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const https = require('https');
const { Order } = require('../models/index');
const User = require('../models/User');

// ─── STRIPE PAYMENT ───────────────────────────────────────────
// POST /api/payments/stripe/create-intent
exports.createStripeIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId).populate('talent', 'title');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.price * 100), // Convert to cents
      currency: process.env.STRIPE_CURRENCY || 'usd',
      metadata: { orderId: orderId.toString(), userId: req.user.id }
    });

    res.json({ success: true, clientSecret: paymentIntent.client_secret, amount: order.price });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments/stripe/webhook
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ success: false, message: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const { orderId } = event.data.object.metadata;
    await Order.findByIdAndUpdate(orderId, { isPaid: true, status: 'in_progress', paymentMethod: 'stripe', paymentId: event.data.object.id });
  }

  res.json({ received: true });
};

// ─── PAYSTACK PAYMENT ─────────────────────────────────────────
// POST /api/payments/paystack/initialize
exports.initializePaystack = async (req, res) => {
  try {
    const { orderId, email } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const params = JSON.stringify({
      email,
      amount: Math.round(order.price * 100), // kobo
      reference: `mercx_${orderId}_${Date.now()}`,
      callback_url: `${process.env.CLIENT_URL}/payment/verify`,
      metadata: { orderId, userId: req.user.id }
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443, path: '/transaction/initialize', method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', (chunk) => data += chunk);
      paystackRes.on('end', () => {
        const result = JSON.parse(data);
        res.json({ success: true, authorizationUrl: result.data.authorization_url, reference: result.data.reference });
      });
    });

    paystackReq.on('error', (e) => res.status(500).json({ success: false, message: e.message }));
    paystackReq.write(params);
    paystackReq.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/paystack/verify/:reference
exports.verifyPaystack = async (req, res) => {
  try {
    const options = {
      hostname: 'api.paystack.co',
      port: 443, path: `/transaction/verify/${req.params.reference}`, method: 'GET',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    };

    https.get(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', (chunk) => data += chunk);
      paystackRes.on('end', async () => {
        const result = JSON.parse(data);
        if (result.data.status === 'success') {
          const orderId = result.data.metadata.orderId;
          await Order.findByIdAndUpdate(orderId, { isPaid: true, status: 'in_progress', paymentMethod: 'paystack', paymentId: result.data.reference });
          res.json({ success: true, message: 'Payment verified! Order is now active.' });
        } else {
          res.status(400).json({ success: false, message: 'Payment not successful' });
        }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── WITHDRAWAL ───────────────────────────────────────────────
// POST /api/payments/withdraw
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, method, accountDetails } = req.body;
    const user = await User.findById(req.user.id);
    const minWithdrawal = process.env.MIN_WITHDRAWAL || 50;

    if (amount < minWithdrawal) return res.status(400).json({ success: false, message: `Minimum withdrawal is $${minWithdrawal}` });
    if (user.wallet.balance < amount) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });

    user.wallet.balance -= amount;
    user.wallet.pending += amount;
    await user.save({ validateBeforeSave: false });

    // TODO: Process actual bank transfer via Paystack Transfer API

    res.json({ success: true, message: `Withdrawal of $${amount} requested! Processing in 1-3 business days.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/wallet
exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('wallet');
    res.json({ success: true, data: user.wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
