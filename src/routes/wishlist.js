const express = require('express');
const router = express.Router();
const { Wishlist } = require('../models/index');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ user: req.user.id }).populate({ path: 'talent', populate: { path: 'user', select: 'name avatar' } });
    res.json({ success: true, data: wishlist });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/:talentId', async (req, res) => {
  try {
    const exists = await Wishlist.findOne({ user: req.user.id, talent: req.params.talentId });
    if (exists) {
      await exists.deleteOne();
      return res.json({ success: true, message: 'Removed from wishlist', saved: false });
    }
    await Wishlist.create({ user: req.user.id, talent: req.params.talentId });
    res.json({ success: true, message: 'Added to wishlist! ❤️', saved: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
