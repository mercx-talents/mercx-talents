const express = require('express');
const router = express.Router();
const { registerPublicKey, getPublicKey, sendMessage, getMessages, getConversations, deleteMessage, reactToMessage, getUnreadCount } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Key management
router.post('/keys/register', registerPublicKey);
router.get('/keys/:userId', getPublicKey);

// Messages
router.get('/conversations', getConversations);
router.get('/unread', getUnreadCount);
router.get('/messages/:userId', getMessages);
router.post('/messages', sendMessage);
router.delete('/messages/:id', deleteMessage);
router.post('/messages/:id/react', reactToMessage);

module.exports = router;
