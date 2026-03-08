// ============================================================
// AUTH ROUTES - src/routes/auth.js
// ============================================================
const express = require('express');
const router = express.Router();
const { register, login, getMe, logout, forgotPassword, resetPassword, changePassword, refreshToken } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/change-password', protect, changePassword);

module.exports = router;
