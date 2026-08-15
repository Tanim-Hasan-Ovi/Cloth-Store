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

            // 1. Try finding in Admin collection
            if (Admin) {
                try {
                    account = await Admin.findById(targetId).select('-password');
                    if (account) {
                        account = account.toObject ? account.toObject() : account;
                        account.isAdmin = true;
                        account.role = 'admin';
                    }
                } catch (e) { }
            }

            // 2. If not found in Admin, try User collection
            if (!account && User) {
                try {
                    const u = await User.findById(targetId).select('-password');
                    if (u) {
                        account = u.toObject ? u.toObject() : u;
                    }
                } catch (e) { }
            }

            // 3. Fallback to token payload if DB lookup is delayed
            if (!account) {
                account = {
                    _id: targetId,
                    id: targetId,
                    role: decoded.role || 'user',
                    isAdmin: decoded.isAdmin || decoded.role === 'admin',
                    name: decoded.name || 'User'
                };
            }

            // Normalize Admin Flags
            const isUserAdmin = Boolean(
                (account.role && account.role.toString().toLowerCase() === 'admin') ||
                account.isAdmin === true ||
                account.isAdmin === 'true' ||
                (decoded.role && decoded.role.toString().toLowerCase() === 'admin') ||
                decoded.isAdmin === true
            );

            account.isAdmin = isUserAdmin;
            if (isUserAdmin) account.role = 'admin';

            req.user = account;
            req.isAdmin = isUserAdmin;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorizeAdmin = (req, res, next) => {
    const isAdmin = Boolean(
        req.isAdmin ||
        (req.user && (
            (req.user.role && req.user.role.toString().toLowerCase() === 'admin') ||
            req.user.isAdmin === true ||
            req.user.isAdmin === 'true'
        ))
    );

    if (isAdmin) {
        return next();
    }
    return res.status(403).json({ message: 'Access denied: Admin only' });
};

module.exports = {
    authenticate,
    protect: authenticate,
    authorizeAdmin,
    adminOnly: authorizeAdmin
};