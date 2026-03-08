const express = require('express');
const router = express.Router();
const { Job } = require('../models/index');
const { protect } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const filter = { status: 'open' };
    if (category) filter.category = category;
    const [jobs, total] = await Promise.all([
      Job.find(filter).populate('client', 'name avatar').sort({ createdAt: -1 }).limit(Number(limit)).skip((page - 1) * limit),
      Job.countDocuments(filter)
    ]);
    res.json({ success: true, data: jobs, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/', protect, async (req, res) => {
  try {
    const job = await Job.create({ ...req.body, client: req.user.id });
    res.status(201).json({ success: true, message: 'Job posted! 🎉', data: job });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).populate('client', 'name avatar');
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, data: job });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/:id/apply', protect, async (req, res) => {
  try {
    const { proposal, bidAmount } = req.body;
    const job = await Job.findByIdAndUpdate(req.params.id, { $push: { proposals: { freelancer: req.user.id, proposal, bidAmount } } }, { new: true });
    res.json({ success: true, message: 'Application submitted! 🚀' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
