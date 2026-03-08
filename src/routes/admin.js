const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Talent = require('../models/Talent');
const { Order } = require('../models/index');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [users, talents, orders, revenue] = await Promise.all([
      User.countDocuments(),
      Talent.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$platformFee' } } }])
    ]);
    res.json({ success: true, data: { users, talents, orders, revenue: revenue[0]?.total || 0 } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Manage users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const [users, total] = await Promise.all([
      User.find(filter).limit(Number(limit)).skip((page - 1) * limit).sort({ createdAt: -1 }),
      User.countDocuments(filter)
    ]);
    res.json({ success: true, data: users, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Ban/unban user
router.put('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned: req.body.ban }, { new: true });
    res.json({ success: true, message: `User ${req.body.ban ? 'banned' : 'unbanned'}`, data: user });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Feature/unfeature talent
router.put('/talents/:id/feature', async (req, res) => {
  try {
    const talent = await Talent.findByIdAndUpdate(req.params.id, { featured: req.body.featured }, { new: true });
    res.json({ success: true, message: `Talent ${req.body.featured ? 'featured' : 'unfeatured'}`, data: talent });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// All orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().populate('client', 'name').populate('freelancer', 'name').sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: orders });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
