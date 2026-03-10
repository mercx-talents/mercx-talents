const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Talent = require('../models/Talent');
const Escrow = require('../models/Escrow');
const { Order, Notification } = require('../models/index');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

// ── Stats ────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [totalUsers, newUsersToday, totalOrders, newOrdersToday,
           activeListings, totalListings, openDisputes, revenueAgg] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Talent.countDocuments({ isActive: true }),
      Talent.countDocuments(),
      Escrow.countDocuments({ status: 'disputed' }),
      Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$platformFee' } } }])
    ]);
    res.json({ success: true, data: {
      totalUsers, newUsersToday, totalOrders, newOrdersToday,
      activeListings, totalListings, openDisputes,
      platformRevenue: revenueAgg[0]?.total || 0
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Users ────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { limit = 50, role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const users = await User.find(filter).limit(Number(limit)).sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true, banReason: req.body.reason }, { new: true });
    await Notification.create({ user: req.params.id, title: '🚫 Account Suspended', message: req.body.reason || 'Your account has been suspended. Contact support.', type: 'system' });
    res.json({ success: true, message: 'User banned', data: user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/users/:id/unban', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned: false, banReason: null }, { new: true });
    await Notification.create({ user: req.params.id, title: '✅ Account Restored', message: 'Your account has been reinstated. Welcome back!', type: 'system' });
    res.json({ success: true, message: 'User unbanned', data: user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/users/:id/role', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true });
    res.json({ success: true, message: `Role updated to ${req.body.role}`, data: user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Talents ──────────────────────────────────────────────────────
router.get('/talents', async (req, res) => {
  try {
    const talents = await Talent.find().populate('user', 'name avatar').limit(100).sort({ createdAt: -1 });
    res.json({ success: true, data: talents });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/talents/:id/feature', async (req, res) => {
  try {
    const talent = await Talent.findByIdAndUpdate(req.params.id, { featured: true }, { new: true });
    res.json({ success: true, message: 'Listing featured ⭐', data: talent });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/talents/:id', async (req, res) => {
  try {
    await Talent.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Listing removed' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Orders ───────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('client', 'name email')
      .populate('freelancer', 'name email')
      .populate('talent', 'title')
      .populate('escrow')
      .sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: orders });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Disputes ─────────────────────────────────────────────────────
router.get('/disputes', async (req, res) => {
  try {
    const orders = await Order.find({ status: { $in: ['disputed', 'completed'] } })
      .populate('client', 'name')
      .populate('freelancer', 'name')
      .populate('talent', 'title')
      .populate({ path: 'escrow', populate: { path: 'dispute.raisedBy', select: 'name' } })
      .sort({ updatedAt: -1 }).limit(50);
    res.json({ success: true, data: orders });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Broadcast ────────────────────────────────────────────────────
router.post('/broadcast', async (req, res) => {
  try {
    const { title, message, target } = req.body;
    const filter = target && target !== 'all' ? { role: target } : {};
    const users = await User.find(filter, '_id');
    const notifs = users.map(u => ({ user: u._id, title, message, type: 'system' }));
    await Notification.insertMany(notifs);
    res.json({ success: true, message: `Broadcast sent to ${users.length} users 📢` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
