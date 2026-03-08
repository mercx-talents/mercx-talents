const express = require('express');
const router = express.Router();
const { uploadAvatar, uploadPortfolio, uploadDelivery } = require('../config/cloudinary');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

router.post('/avatar', protect, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    await User.findByIdAndUpdate(req.user.id, { avatar: req.file.path });
    res.json({ success: true, message: 'Avatar updated!', url: req.file.path });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/portfolio', protect, uploadPortfolio.array('files', 5), (req, res) => {
  try {
    const urls = req.files.map(f => ({ url: f.path, publicId: f.filename }));
    res.json({ success: true, files: urls });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/delivery', protect, uploadDelivery.array('files', 10), (req, res) => {
  try {
    const urls = req.files.map(f => ({ url: f.path, name: f.originalname }));
    res.json({ success: true, files: urls });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
