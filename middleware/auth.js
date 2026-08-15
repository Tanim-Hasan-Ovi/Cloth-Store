const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authenticate / Protect Middleware
const authenticate = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

            const user = await User.findById(decoded.id || decoded._id).select('-password');
            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            req.user = user;
            req.isAdmin = user.role === 'admin' || user.isAdmin === true;
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
    if (req.user && (req.user.role === 'admin' || req.user.isAdmin === true)) {
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