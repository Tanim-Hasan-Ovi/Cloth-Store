const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

// Authenticate Middleware (Supports both User & Admin accounts)
const authenticate = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
            const targetId = decoded.id || decoded._id || decoded.userId;

            // 1. Try finding in Admin collection
            let account = null;
            try {
                account = await Admin.findById(targetId).select('-password');
            } catch (e) { }

            // 2. If not found in Admin, try User collection
            if (!account) {
                try {
                    account = await User.findById(targetId).select('-password');
                } catch (e) { }
            }

            // 3. If still not found, construct fallback admin from token payload
            if (!account && (decoded.role === 'admin' || decoded.isAdmin)) {
                account = {
                    _id: targetId,
                    id: targetId,
                    role: 'admin',
                    isAdmin: true,
                    name: decoded.name || 'Admin'
                };
            }

            if (!account) {
                return res.status(401).json({ message: 'User not found' });
            }

            req.user = account;
            req.isAdmin = account.role === 'admin' || account.isAdmin === true;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Authorize Admin Middleware
const authorizeAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.isAdmin === true || req.isAdmin)) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Admin only' });
    }
};

module.exports = {
    authenticate,
    protect: authenticate,
    authorizeAdmin,
    adminOnly: authorizeAdmin
};