const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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