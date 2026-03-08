const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

exports.sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
};

exports.welcomeEmail = (name) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h1 style="color:#6366f1">Welcome to Mercx Talents! 🎉</h1>
  <p>Hi ${name}, your account is ready.</p>
  <p>Start browsing top talents or create your freelancer profile today!</p>
  <a href="${process.env.CLIENT_URL}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">Get Started</a>
</div>`;

exports.orderEmail = (type, data) => {
  const messages = {
    placed: `<h2>New Order Received! 💼</h2><p>You have a new order for <strong>${data.title}</strong>. Budget: $${data.price}</p>`,
    delivered: `<h2>Order Delivered! 📦</h2><p>Your order <strong>${data.title}</strong> has been delivered. Please review it.</p>`,
    completed: `<h2>Order Completed! ✅</h2><p>Order <strong>${data.title}</strong> is complete. Earnings added to your wallet.</p>`,
    cancelled: `<h2>Order Cancelled ❌</h2><p>Order <strong>${data.title}</strong> has been cancelled.</p>`
  };
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h1 style="color:#6366f1">Mercx Talents</h1>${messages[type]}<a href="${process.env.CLIENT_URL}/orders" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">View Order</a></div>`;
};

exports.resetPasswordEmail = (resetUrl) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h1 style="color:#6366f1">Password Reset</h1>
  <p>Click below to reset your password. Link expires in 10 minutes.</p>
  <a href="${resetUrl}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">Reset Password</a>
</div>`;
