const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

exports.protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

        let account = null;
        let isAdmin = decoded.isAdmin || decoded.role === 'admin';

        if (isAdmin) {
            account = await Admin.findById(decoded.id).select('-password');
        }

        if (!account) {
            account = await User.findById(decoded.id).select('-password');
            if (account) isAdmin = false;
        }

        if (!account) {
            return res.status(401).json({ message: 'Account not found' });
        }

        req.user = account;
        req.isAdmin = isAdmin;
        req.user.role = isAdmin ? 'admin' : 'customer';
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token invalid or expired' });
    }
};

exports.authenticate = exports.protect;

exports.adminOnly = (req, res, next) => {
    if (req.isAdmin || (req.user && req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admins only.' });
    }
};

exports.authorizeAdmin = exports.adminOnly;