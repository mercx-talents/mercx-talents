const { E2EMessage, PublicKey } = require('../models/E2EMessage');
const crypto = require('crypto');

const getConversationId = (id1, id2) => [id1.toString(), id2.toString()].sort().join('_');

// ─── REGISTER PUBLIC KEY ──────────────────────────────────────
// POST /api/chat/keys/register
// Client generates RSA key pair, sends public key to server
exports.registerPublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) return res.status(400).json({ success: false, message: 'Public key required' });

    // Create fingerprint for verification
    const fingerprint = crypto.createHash('sha256').update(publicKey).digest('hex').substring(0, 16);

    await PublicKey.findOneAndUpdate(
      { user: req.user.id },
      { publicKey, fingerprint },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Public key registered ✅', fingerprint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET USER'S PUBLIC KEY ────────────────────────────────────
// GET /api/chat/keys/:userId
exports.getPublicKey = async (req, res) => {
  try {
    const keyRecord = await PublicKey.findOne({ user: req.params.userId });
    if (!keyRecord) return res.status(404).json({ success: false, message: 'User has no encryption key. They need to open the chat first.' });
    res.json({ success: true, publicKey: keyRecord.publicKey, fingerprint: keyRecord.fingerprint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── SEND ENCRYPTED MESSAGE ───────────────────────────────────
// POST /api/chat/messages
// Client encrypts message before sending — server CANNOT read content
exports.sendMessage = async (req, res) => {
  try {
    const {
      receiverId,
      encryptedForSender,
      encryptedForReceiver,
      senderKeyEncrypted,
      receiverKeyEncrypted,
      iv,
      messageType,
      files
    } = req.body;

    if (!receiverId || !encryptedForReceiver || !iv) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const conversationId = getConversationId(req.user.id, receiverId);

    const message = await E2EMessage.create({
      conversationId,
      sender: req.user.id,
      receiver: receiverId,
      encryptedForSender: encryptedForSender || encryptedForReceiver,
      encryptedForReceiver,
      senderKeyEncrypted,
      receiverKeyEncrypted,
      iv,
      messageType: messageType || 'text',
      files: files || []
    });

    await message.populate('sender', 'name avatar');

    // Emit via socket.io — receiver gets their encrypted version
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId).emit('e2e:message', {
        ...message.toObject(),
        // Only send receiver's encrypted content to receiver
        encryptedContent: encryptedForReceiver,
        encryptedKey: receiverKeyEncrypted
      });
    }

    res.status(201).json({
      success: true,
      data: {
        _id: message._id,
        conversationId,
        sender: message.sender,
        messageType: message.messageType,
        isRead: message.isRead,
        createdAt: message.createdAt,
        // Return sender's version
        encryptedContent: encryptedForSender,
        encryptedKey: senderKeyEncrypted,
        iv
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET MESSAGES ─────────────────────────────────────────────
// GET /api/chat/messages/:userId
exports.getMessages = async (req, res) => {
  try {
    const conversationId = getConversationId(req.user.id, req.params.userId);
    const { page = 1, limit = 50 } = req.query;

    const messages = await E2EMessage.find({ conversationId, isDeleted: false })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * limit);

    // Return correct encrypted version for the requesting user
    const userId = req.user.id;
    const formattedMessages = messages.reverse().map(msg => ({
      _id: msg._id,
      conversationId: msg.conversationId,
      sender: msg.sender,
      receiver: msg.receiver,
      // If I am the sender → use my encrypted version, else use receiver version
      encryptedContent: msg.sender._id.toString() === userId ? msg.encryptedForSender : msg.encryptedForReceiver,
      encryptedKey: msg.sender._id.toString() === userId ? msg.senderKeyEncrypted : msg.receiverKeyEncrypted,
      iv: msg.iv,
      messageType: msg.messageType,
      files: msg.files,
      isRead: msg.isRead,
      reactions: msg.reactions,
      createdAt: msg.createdAt,
      editedAt: msg.editedAt
    }));

    // Mark messages as read
    await E2EMessage.updateMany(
      { conversationId, receiver: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, data: formattedMessages, hasMore: messages.length === Number(limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET CONVERSATIONS ────────────────────────────────────────
// GET /api/chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await E2EMessage.aggregate([
      { $match: { $or: [{ sender: userId }, { receiver: userId }], isDeleted: false } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$conversationId', lastMessage: { $first: '$$ROOT' }, unread: { $sum: { $cond: [{ $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$isRead', false] }] }, 1, 0] } } } },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    await E2EMessage.populate(conversations, [
      { path: 'lastMessage.sender', select: 'name avatar lastActive' },
      { path: 'lastMessage.receiver', select: 'name avatar lastActive' }
    ]);

    // Format — don't expose encrypted content in list
    const formatted = conversations.map(conv => ({
      conversationId: conv._id,
      unread: conv.unread,
      lastMessageAt: conv.lastMessage.createdAt,
      lastMessageType: conv.lastMessage.messageType,
      otherUser: conv.lastMessage.sender._id.toString() === userId.toString()
        ? conv.lastMessage.receiver
        : conv.lastMessage.sender
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE MESSAGE ───────────────────────────────────────────
// DELETE /api/chat/messages/:id
exports.deleteMessage = async (req, res) => {
  try {
    const message = await E2EMessage.findOneAndUpdate(
      { _id: req.params.id, sender: req.user.id },
      { isDeleted: true, deletedAt: new Date(), encryptedForSender: '', encryptedForReceiver: '' },
      { new: true }
    );
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    const io = req.app.get('io');
    if (io) io.to(message.receiver.toString()).emit('e2e:messageDeleted', { messageId: req.params.id });

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── REACT TO MESSAGE ─────────────────────────────────────────
// POST /api/chat/messages/:id/react
exports.reactToMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await E2EMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    const existingReaction = message.reactions.find(r => r.user.toString() === req.user.id);
    if (existingReaction) {
      existingReaction.emoji = emoji;
    } else {
      message.reactions.push({ user: req.user.id, emoji });
    }
    await message.save();

    const io = req.app.get('io');
    if (io) io.to(message.conversationId).emit('e2e:reaction', { messageId: req.params.id, reactions: message.reactions });

    res.json({ success: true, reactions: message.reactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UNREAD COUNT ─────────────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await E2EMessage.countDocuments({ receiver: req.user.id, isRead: false, isDeleted: false });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
