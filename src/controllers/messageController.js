const { Message } = require('../models/index');

const getConversationId = (id1, id2) => [id1, id2].sort().join('_');

// GET /api/messages/conversations
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await Message.aggregate([
      { $match: { $or: [{ sender: req.user._id }, { receiver: req.user._id }] } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$conversationId', lastMessage: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$lastMessage' } },
      { $sort: { createdAt: -1 } }
    ]);

    await Message.populate(conversations, [
      { path: 'sender', select: 'name avatar lastActive' },
      { path: 'receiver', select: 'name avatar lastActive' }
    ]);

    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/messages/:userId
exports.getMessages = async (req, res) => {
  try {
    const conversationId = getConversationId(req.user.id, req.params.userId);
    const messages = await Message.find({ conversationId })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 });

    // Mark as read
    await Message.updateMany(
      { conversationId, receiver: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/messages
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, files } = req.body;
    const conversationId = getConversationId(req.user.id, receiverId);

    const message = await Message.create({
      conversationId, sender: req.user.id,
      receiver: receiverId, content, files
    });

    await message.populate('sender', 'name avatar');

    // Emit via socket.io
    const io = req.app.get('io');
    if (io) io.to(receiverId).emit('receiveMessage', message);

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/messages/unread/count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiver: req.user.id, isRead: false });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
