const { Order } = require('../models/index');
const { Notification } = require('../models/index');
const Talent = require('../models/Talent');
const User = require('../models/User');
const { sendEmail, orderEmail } = require('../utils/email');

exports.getMyOrders = async (req, res) => {
  try {
    const { status, role } = req.query;
    const filter = role === 'client' ? { client: req.user.id } : { freelancer: req.user.id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('talent', 'title gallery')
      .populate('client', 'name avatar')
      .populate('freelancer', 'name avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('talent').populate('client', 'name avatar email').populate('freelancer', 'name avatar email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { talentId, package: pkg, requirements } = req.body;
    const talent = await Talent.findById(talentId).populate('user');
    if (!talent) return res.status(404).json({ success: false, message: 'Talent not found' });
    if (talent.user._id.toString() === req.user.id)
      return res.status(400).json({ success: false, message: 'You cannot order your own service' });

    const selectedPkg = talent.pricing[pkg];
    if (!selectedPkg?.price) return res.status(400).json({ success: false, message: 'Invalid package' });

    const order = await Order.create({
      talent: talentId, client: req.user.id,
      freelancer: talent.user._id, package: pkg,
      requirements, price: selectedPkg.price,
      deliveryDays: selectedPkg.deliveryDays
    });

    // Notify freelancer
    await Notification.create({
      user: talent.user._id, title: 'New Order! 💼',
      message: `You have a new order for "${talent.title}"`,
      type: 'order', link: `/orders/${order._id}`
    });

    try {
      await sendEmail({ to: talent.user.email, subject: 'New Order Received!', html: orderEmail('placed', { title: talent.title, price: selectedPkg.price }) });
    } catch {}

    res.status(201).json({ success: true, message: 'Order placed! 🎉', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deliverOrder = async (req, res) => {
  try {
    const { message, files } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, freelancer: req.user.id },
      { status: 'delivered', delivery: { message, files: files || [], deliveredAt: new Date() } },
      { new: true }
    ).populate('talent', 'title');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    await Notification.create({ user: order.client, title: 'Order Delivered! 📦', message: `Your order has been delivered. Please review it.`, type: 'order', link: `/orders/${order._id}` });
    res.json({ success: true, message: 'Work delivered! ✅', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.requestRevision = async (req, res) => {
  try {
    const { message } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, client: req.user.id, status: 'delivered' },
      { status: 'revision', $push: { revisions: { message } } },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, message: 'Revision requested', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, client: req.user.id, status: 'delivered' },
      { status: 'completed', completedAt: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Add earnings to freelancer wallet
    await User.findByIdAndUpdate(order.freelancer, {
      $inc: { 'wallet.balance': order.freelancerEarning, 'wallet.total_earned': order.freelancerEarning, completedOrders: 1 }
    });
    await Talent.findByIdAndUpdate(order.talent, { $inc: { 'orders.completed': 1 } });

    await Notification.create({ user: order.freelancer, title: 'Order Completed! ✅', message: `$${order.freelancerEarning} has been added to your wallet`, type: 'payment', link: `/orders/${order._id}` });
    res.json({ success: true, message: 'Order completed! 🎉', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, $or: [{ client: req.user.id }, { freelancer: req.user.id }], status: { $in: ['pending', 'in_progress'] } },
      { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found or cannot be cancelled' });
    res.json({ success: true, message: 'Order cancelled', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
