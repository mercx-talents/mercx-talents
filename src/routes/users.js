const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { Order } = require('../models/index');
const { protect } = require('../middleware/auth');

router.get('/dashboard/stats', protect, async (req, res) => {
  try {
    const [completed, active, earnings] = await Promise.all([
      Order.countDocuments({ freelancer: req.user.id, status: 'completed' }),
      Order.countDocuments({ freelancer: req.user.id, status: 'in_progress' }),
      User.findById(req.user.id).select('wallet rating completedOrders')
    ]);
    res.json({ success: true, data: { completedOrders: completed, activeOrders: active, wallet: earnings.wallet, rating: earnings.rating } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/profile', protect, async (req, res) => {
  try {
    const allowed = ['name', 'bio', 'tagline', 'location', 'skills', 'languages', 'education', 'experience', 'socialLinks'];
    const updates = {};
    allowed.forEach(field => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json({ success: true, message: 'Profile updated! ✅', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken -resetPasswordToken');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
