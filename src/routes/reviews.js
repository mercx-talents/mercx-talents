const express = require('express');
const router = express.Router();
const { Review } = require('../models/index');
const Talent = require('../models/Talent');
const { protect } = require('../middleware/auth');

router.post('/', protect, async (req, res) => {
  try {
    const { orderId, talentId, freelancerId, rating, comment, categories } = req.body;
    const review = await Review.create({ order: orderId, talent: talentId, reviewer: req.user.id, freelancer: freelancerId, rating, comment, categories });
    const reviews = await Review.find({ talent: talentId });
    const avg = (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1);
    await Talent.findByIdAndUpdate(talentId, { 'rating.average': avg, 'rating.count': reviews.length });
    res.status(201).json({ success: true, message: 'Review submitted! 🌟', data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/talent/:talentId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const reviews = await Review.find({ talent: req.params.talentId })
      .populate('reviewer', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(Number(limit)).skip((page - 1) * limit);
    const total = await Review.countDocuments({ talent: req.params.talentId });
    const avg = reviews.length ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1) : 0;
    res.json({ success: true, data: reviews, averageRating: avg, totalReviews: total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/reply', protect, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { reply: { message: req.body.message, repliedAt: new Date() } }, { new: true });
    res.json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
