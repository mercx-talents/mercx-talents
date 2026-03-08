const express = require('express');
const router = express.Router();
const { createStripeIntent, stripeWebhook, initializePaystack, verifyPaystack, requestWithdrawal, getWallet } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
router.post('/stripe/create-intent', protect, createStripeIntent);
router.post('/paystack/initialize', protect, initializePaystack);
router.get('/paystack/verify/:reference', protect, verifyPaystack);
router.post('/withdraw', protect, requestWithdrawal);
router.get('/wallet', protect, getWallet);

module.exports = router;
