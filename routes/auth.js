const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');

// Middlewares
const authMiddleware = require('../middleware/auth');
const authenticate = authMiddleware.authenticate || authMiddleware.protect;

// Authentication Routes
router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/google', authCtrl.googleAuth);
router.put('/profile', authenticate, authCtrl.updateProfile);

// Password Reset Routes
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/reset-password', authCtrl.resetPassword);

router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/verify-otp', authCtrl.verifyOtp);
router.post('/reset-password', authCtrl.resetPassword);

module.exports = router;