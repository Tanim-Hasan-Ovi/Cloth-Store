const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const authenticate = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
            const targetId = decoded.id || decoded._id || decoded.userId;

            let account = null;

            // 1. Check Admin model
            if (Admin) {
                try {
                    account = await Admin.findById(targetId).select('-password');
                    if (account) {
                        account = account.toObject ? account.toObject() : account;
                        account.role = 'admin';
                        account.isAdmin = true;
                    }
                } catch (e) { }
            }

            // 2. Check User model
            if (!account && User) {
                try {
                    const u = await User.findById(targetId).select('-password');
                    if (u) {
                        account = u.toObject ? u.toObject() : u;
                    }
                } catch (e) { }
            }

            // 3. Fallback to decoded token payload
            if (!account) {
                account = {
                    _id: targetId,
                    id: targetId,
                    role: decoded.role || 'user',
                    isAdmin: decoded.isAdmin || false,
                    email: decoded.email
                };
            }

            // Determine admin status across all common keys
            const isAdmin = Boolean(
                account.isAdmin === true ||
                account.isAdmin === 'true' ||
                (account.role && account.role.toString().toLowerCase() === 'admin') ||
                decoded.isAdmin === true ||
                (decoded.role && decoded.role.toString().toLowerCase() === 'admin')
            );

            account.isAdmin = isAdmin;
            if (isAdmin) account.role = 'admin';

            req.user = account;
            req.isAdmin = isAdmin;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorizeAdmin = (req, res, next) => {
    const isUserAdmin = Boolean(
        req.isAdmin === true ||
        (req.user && (
            req.user.isAdmin === true ||
            req.user.isAdmin === 'true' ||
            (req.user.role && req.user.role.toString().toLowerCase() === 'admin')
        ))
    );

    if (isUserAdmin) {
        return next();
    }

    return res.status(403).json({
        message: 'Access denied: Admin only',
        currentRole: req.user?.role || 'unknown'
    });
};

module.exports = {
    authenticate,
    protect: authenticate,
    authorizeAdmin,
    adminOnly: authorizeAdmin
};