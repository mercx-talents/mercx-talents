const express = require('express');
const router = express.Router();
const { getAllTalents, getTalent, createTalent, updateTalent, deleteTalent, getMyTalents, getFeaturedTalents, getCategories } = require('../controllers/talentController');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/categories/all', getCategories);
router.get('/featured', getFeaturedTalents);
router.get('/my', protect, getMyTalents);
router.get('/', optionalAuth, getAllTalents);
router.get('/:id', optionalAuth, getTalent);
router.post('/', protect, createTalent);
router.put('/:id', protect, updateTalent);
router.delete('/:id', protect, deleteTalent);

module.exports = router;
