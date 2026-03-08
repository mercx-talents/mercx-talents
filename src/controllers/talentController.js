const Talent = require('../models/Talent');
const slugify = require('slugify');

exports.getAllTalents = async (req, res) => {
  try {
    const { category, skill, minPrice, maxPrice, search, rating, sort, page = 1, limit = 12 } = req.query;
    const filters = { status: 'active', approved: true };

    if (category) filters.category = category;
    if (skill) filters.skills = { $in: [skill] };
    if (minPrice || maxPrice) {
      filters['pricing.basic.price'] = {};
      if (minPrice) filters['pricing.basic.price'].$gte = Number(minPrice);
      if (maxPrice) filters['pricing.basic.price'].$lte = Number(maxPrice);
    }
    if (rating) filters['rating.average'] = { $gte: Number(rating) };
    if (search) filters.$text = { $search: search };

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      rating: { 'rating.average': -1 },
      price_low: { 'pricing.basic.price': 1 },
      price_high: { 'pricing.basic.price': -1 },
      popular: { 'orders.completed': -1 }
    };

    const total = await Talent.countDocuments(filters);
    const talents = await Talent.find(filters)
      .populate('user', 'name avatar location rating isVerified lastActive')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort(sortOptions[sort] || { featured: -1, 'rating.average': -1 });

    res.json({ success: true, data: talents, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTalent = async (req, res) => {
  try {
    const talent = await Talent.findOne({ $or: [{ _id: req.params.id }, { slug: req.params.id }] })
      .populate('user', 'name avatar bio location rating isVerified completedOrders languages education experience socialLinks lastActive');
    if (!talent) return res.status(404).json({ success: false, message: 'Talent not found' });
    talent.views += 1;
    await talent.save({ validateBeforeSave: false });
    res.json({ success: true, data: talent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTalent = async (req, res) => {
  try {
    req.body.user = req.user.id;
    req.body.slug = slugify(req.body.title, { lower: true }) + '-' + Date.now();
    const talent = await Talent.create(req.body);
    res.status(201).json({ success: true, message: 'Talent profile created! 🎉', data: talent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTalent = async (req, res) => {
  try {
    const talent = await Talent.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body, { new: true, runValidators: true }
    );
    if (!talent) return res.status(404).json({ success: false, message: 'Talent not found or unauthorized' });
    res.json({ success: true, message: 'Talent updated!', data: talent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTalent = async (req, res) => {
  try {
    const talent = await Talent.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!talent) return res.status(404).json({ success: false, message: 'Talent not found or unauthorized' });
    res.json({ success: true, message: 'Talent deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyTalents = async (req, res) => {
  try {
    const talents = await Talent.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: talents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeaturedTalents = async (req, res) => {
  try {
    const talents = await Talent.find({ featured: true, status: 'active' })
      .populate('user', 'name avatar isVerified')
      .limit(8);
    res.json({ success: true, data: talents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCategories = (req, res) => {
  res.json({ success: true, data: [
    { id: 1, name: 'Web Development', icon: '💻', slug: 'web-development' },
    { id: 2, name: 'Mobile Apps', icon: '📱', slug: 'mobile-apps' },
    { id: 3, name: 'Graphic Design', icon: '🎨', slug: 'graphic-design' },
    { id: 4, name: 'Digital Marketing', icon: '📈', slug: 'digital-marketing' },
    { id: 5, name: 'Content Writing', icon: '✍️', slug: 'content-writing' },
    { id: 6, name: 'Video & Animation', icon: '🎬', slug: 'video-animation' },
    { id: 7, name: 'UI/UX Design', icon: '🖌️', slug: 'ui-ux-design' },
    { id: 8, name: 'Data & AI', icon: '🤖', slug: 'data-ai' },
    { id: 9, name: 'Music & Audio', icon: '🎵', slug: 'music-audio' },
    { id: 10, name: 'Translation', icon: '🌍', slug: 'translation' },
  ]});
};
