const express = require('express');
const router = express.Router();
const { Notification } = require('../models/index');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20);
    const unread = await Notification.countDocuments({ user: req.user.id, isRead: false });
    res.json({ success: true, data: notifications, unread });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
