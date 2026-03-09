const express = require('express');
const router = express.Router();
const { fundWithStripe, fundWithPaystack, confirmFunding, releaseFunds, refundClient, raiseDispute, resolveDispute, getEscrow } = require('../controllers/escrowController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/:orderId', getEscrow);
router.post('/:orderId/fund/stripe', fundWithStripe);
router.post('/:orderId/fund/paystack', fundWithPaystack);
router.post('/:orderId/confirm', confirmFunding);
router.post('/:orderId/release', releaseFunds);
router.post('/:orderId/refund', authorize('admin'), refundClient);
router.post('/:orderId/dispute', raiseDispute);
router.post('/:orderId/resolve', authorize('admin'), resolveDispute);

module.exports = router;
