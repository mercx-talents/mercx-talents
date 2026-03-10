/**
 * MERCX ADMIN SEEDER
 * Run once: node src/utils/createAdmin.js
 * Creates admin account: sadikumar877@gmail.com / Mercury001
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');
};

const createAdmin = async () => {
  try {
    await connectDB();

    // Inline User model to avoid import issues
    const userSchema = new mongoose.Schema({
      name: String, email: { type: String, unique: true },
      password: String, role: String,
      isVerified: Boolean, isActive: Boolean, isBanned: Boolean,
      wallet: { balance: Number, pending: Number, total_earned: Number },
      rating: { average: Number, count: Number }
    }, { timestamps: true });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Check if admin already exists
    const existing = await User.findOne({ email: 'sadikumar877@gmail.com' });
    if (existing) {
      console.log('⚠️  Admin already exists!');
      console.log('📧 Email: sadikumar877@gmail.com');
      console.log('🔑 Password: Mercury001');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Mercury001', salt);

    // Create admin
    const admin = await User.create({
      name: 'Mercx Admin',
      email: 'sadikumar877@gmail.com',
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      isActive: true,
      isBanned: false,
      wallet: { balance: 0, pending: 0, total_earned: 0 },
      rating: { average: 0, count: 0 }
    });

    console.log('');
    console.log('🎉 ========================================');
    console.log('   MERCX ADMIN CREATED SUCCESSFULLY!');
    console.log('   ========================================');
    console.log(`   📧 Email   : sadikumar877@gmail.com`);
    console.log(`   🔑 Password: Mercury001`);
    console.log(`   👤 Role    : admin`);
    console.log(`   🆔 ID      : ${admin._id}`);
    console.log('   ========================================');
    console.log('');
    console.log('   Login at: /pages/admin-login.html');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createAdmin();
