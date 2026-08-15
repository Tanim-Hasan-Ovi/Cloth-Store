require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Middlewares
const authMiddleware = require('./middleware/auth');
const authenticate = authMiddleware.authenticate || authMiddleware.protect;
const authorizeAdmin = authMiddleware.authorizeAdmin || authMiddleware.adminOnly;

// Controllers
const authCtrl = require('./controllers/authController');
const prodCtrl = require('./controllers/productController');
const orderCtrl = require('./controllers/orderController');
const cartCtrl = require('./controllers/cartController');

const app = express();

app.use(cors());
app.use(express.json());

// Serverless MongoDB Connection Handler
const MONGO_URI = process.env.MONGO_URI;
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb && mongoose.connection.readyState === 1) {
        return;
    }
    if (!MONGO_URI) {
        console.error('MONGO_URI environment variable is missing.');
        return;
    }
    try {
        const db = await mongoose.connect(MONGO_URI, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
        });
        cachedDb = db;
        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('Database connection error:', err);
    }
};

// Ensure DB connected before processing API requests
app.use(async (req, res, next) => {
    try {
        await connectDB();
    } catch (e) {
        console.error(e);
    }
    next();
});

// Disable 304 Caching for all API routes
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dizzoonz',
    api_key: process.env.CLOUDINARY_API_KEY || '178845322488663',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'tEw1-moCYMihcJhgFT_aioWNJrg'
});

// Cloudinary Multer Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'aven-products',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'svg']
    }
});
const upload = multer({ storage: storage });

// Single Image Upload Route
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const imageUrl = req.file.path;
        res.status(200).json({ imageUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Authentication Routes
app.post('/api/auth/register', authCtrl.register);
app.post('/api/auth/login', authCtrl.login);
app.post('/api/auth/google', authCtrl.googleAuth);
app.put('/api/auth/profile', authenticate, authCtrl.updateProfile);

// Product Routes
app.get('/api/products', prodCtrl.getProducts);
app.post('/api/products', prodCtrl.createProduct);
app.put('/api/products/:id', prodCtrl.updateProduct);
app.delete('/api/products/:id', prodCtrl.deleteProduct);
app.patch('/api/products/:productId/stock', prodCtrl.updateVariantStock);

// Order Routes
app.post('/api/orders', authenticate, orderCtrl.createOrder);
app.get('/api/orders/my-orders', authenticate, orderCtrl.getCustomerOrders);
app.get('/api/orders/all', authenticate, authorizeAdmin, orderCtrl.getAllOrders);
app.put('/api/orders/:id/status', authenticate, authorizeAdmin, orderCtrl.updateOrderStatus);
app.patch('/api/orders/:orderId/cancel', authenticate, orderCtrl.cancelUserOrder);

// Optional Auth Middleware (Allows both logged-in and guest users)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
            req.user = {
                _id: decoded.id || decoded._id,
                id: decoded.id || decoded._id,
                role: decoded.role,
                isAdmin: decoded.isAdmin
            };
            req.isAdmin = decoded.isAdmin || decoded.role === 'admin';
        } catch (err) { }
    }
    next();
};

// Cart Routes
app.get('/api/cart', optionalAuth, cartCtrl.getUserCart);
app.post('/api/cart/add', optionalAuth, cartCtrl.addToCart);
app.patch('/api/cart/:reservationId', optionalAuth, cartCtrl.updateCartItem);
app.delete('/api/cart/:reservationId', optionalAuth, cartCtrl.removeFromCart);
app.delete('/api/cart/clear-all', optionalAuth, cartCtrl.clearAllCart);

// Public Config Route for Frontend
app.get('/api/config/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// Frontend Fallback Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Local Development Server Listener
const PORT = process.env.PORT || 8000;
if (process.env.NODE_ENV !== 'production') {
    connectDB().then(() => {
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    });
}

module.exports = app;