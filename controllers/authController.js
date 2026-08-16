const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const generateToken = (account, isAdmin) => {
    return jwt.sign(
        {
            id: account._id,
            role: isAdmin ? 'admin' : 'customer',
            isAdmin: isAdmin
        },
        process.env.JWT_SECRET || 'secret_key',
        { expiresIn: '7d' }
    );
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, address } = req.body;

        const existingUser = await User.findOne({ email });
        const existingAdmin = await Admin.findOne({ email });
        if (existingUser || existingAdmin) {
            return res.status(400).json({ message: 'Email is already registered' });
        }

        const user = await User.create({ name, email, password, address });
        const token = generateToken(user, false);

        res.status(201).json({
            token,
            isAdmin: false,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: 'customer'
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        let account = await Admin.findOne({ email });
        let isAdmin = true;

        if (!account) {
            account = await User.findOne({ email });
            isAdmin = false;
        }

        if (!account || !(await account.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(account, isAdmin);

        res.status(200).json({
            token,
            isAdmin: isAdmin,
            user: {
                id: account._id,
                name: account.name,
                email: account.email,
                role: isAdmin ? 'admin' : 'customer'
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ message: 'Google credential missing' });

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { email, name } = ticket.getPayload();

        let account = await Admin.findOne({ email });
        let isAdmin = true;

        if (!account) {
            account = await User.findOne({ email });
            isAdmin = false;
        }

        if (!account) {
            account = new User({
                name: name || 'Google User',
                email,
                password: Math.random().toString(36).slice(-10) + Date.now()
            });
            await account.save();
            isAdmin = false;
        }

        const token = generateToken(account, isAdmin);

        res.status(200).json({
            token,
            isAdmin: isAdmin,
            user: {
                id: account._id,
                name: account.name,
                email: account.email,
                role: isAdmin ? 'admin' : 'customer'
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Google Authentication failed: ' + error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const Model = req.isAdmin ? Admin : User;

        const updated = await Model.findByIdAndUpdate(
            req.user._id,
            { name, phone, address },
            { new: true }
        ).select('-password');

        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Request Reset Link
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'No user found with this email.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 mins expiry
        await user.save();

        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const resetUrl = `${protocol}://${host}/reset-password.html?token=${resetToken}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee;">
                <h2 style="letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">AVEN</h2>
                <h3 style="margin-top: 0; color: #333;">Password Reset Request</h3>
                <p style="color: #666; font-size: 14px; line-height: 1.5;">You requested to reset your password. Click the button below to proceed:</p>
                <div style="margin: 24px 0;">
                    <a href="${resetUrl}" style="background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; display: inline-block; font-weight: bold;">Reset Password</a>
                </div>
                <p style="color: #999; font-size: 12px;">This link will expire in 15 minutes. If you did not request this, please ignore this email.</p>
            </div>
        `;

        await sendEmail({ to: user.email, subject: 'Password Reset Request — AVEN', html });
        return res.status(200).json({ message: 'Reset link sent to your email.' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Update Password
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        return res.status(200).json({ message: 'Password reset successful. Please log in.' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};