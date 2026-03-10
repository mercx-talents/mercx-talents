require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function seedAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  const email = 'sadikumar877@gmail.com';
  const existing = await User.findOne({ email });
  const hash = await bcrypt.hash('Mercury001', 12);
  if (existing) {
    existing.role = 'admin'; existing.isVerified = true; existing.password = hash;
    await existing.save(); console.log('✅ Admin updated!');
  } else {
    await User.create({ name: 'Sadi Kumar', email, username: 'sadikumar', password: hash, role: 'admin', isVerified: true, country: 'NG' });
    console.log('✅ Admin created!');
  }
  console.log('🔑 Login: sadikumar877@gmail.com / Mercury001');
  await mongoose.disconnect(); process.exit(0);
}
seedAdmin().catch(e => { console.error(e); process.exit(1); });
