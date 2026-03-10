const User = require('../models/User');

const seedAdmin = async () => {
  try {
    const email    = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name     = process.env.ADMIN_NAME || 'Admin';

    if (!email || !password) {
      console.warn('⚠️  ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — skipping admin seed.');
      return;
    }

    const existing = await User.findOne({ email });

    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save({ validateBeforeSave: false });
        console.log('✅ Admin role updated for:', email);
      } else {
        console.log('✅ Admin already exists:', email);
      }
      return;
    }

    await User.create({
      name,
      email,
      password,          // hashed by User model pre-save hook
      role: 'admin',
      isVerified: true,
      isActive: true
    });

    console.log('✅ Admin account created:', email);
  } catch (error) {
    console.error('❌ Admin seed error:', error.message);
  }
};

module.exports = seedAdmin;
