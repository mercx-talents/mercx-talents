// orders.js
const express = require('express');
const router = express.Router();
const { getMyOrders, getOrder, createOrder, deliverOrder, requestRevision, completeOrder, cancelOrder } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getMyOrders);
router.post('/', createOrder);
router.get('/:id', getOrder);
router.post('/:id/deliver', deliverOrder);
router.post('/:id/revision', requestRevision);
router.post('/:id/complete', completeOrder);
router.post('/:id/cancel', cancelOrder);

module.exports = router;
