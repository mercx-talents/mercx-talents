const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, getUnreadCount } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/conversations', getConversations);
router.get('/unread/count', getUnreadCount);
router.get('/:userId', getMessages);
router.post('/', sendMessage);

module.exports = router;
