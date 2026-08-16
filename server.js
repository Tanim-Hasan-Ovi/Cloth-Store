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
const prodCtrl = require('./controllers/productController');
const orderCtrl = require('./controllers/orderController');
const cartCtrl = require('./controllers/cartController');

// Routes
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());

// Serverless MongoDB Connection Handler (Vercel-Optimized Cache)
const MONGO_URI = process.env.MONGO_URI;

let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!MONGO_URI) {
        console.error('MONGO_URI is missing in environment variables.');
        return null;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000
        };

        cached.promise = mongoose.connect(MONGO_URI, opts).then((mongooseInstance) => {
            return mongooseInstance;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error('Database connection error:', e.message);
    }

    return cached.conn;
};

// Ensure DB is connected for all API requests
app.use('/api', async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (e) {
        console.error('API DB Connection Error:', e);
        next();
    }
});

// Disable caching for dynamic API responses
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dizzoonz',
    api_key: process.env.CLOUDINARY_API_KEY || '178845322488663',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'tEw1-moCYMihcJhgFT_aioWNJrg'
});

// Cloudinary Multer Storage Engine
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'aven-products',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'svg']
    }
});
const upload = multer({ storage: storage });

// Image Upload Route (Protected)
app.post('/api/upload', authenticate, authorizeAdmin, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        res.status(200).json({ imageUrl: req.file.path });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Auth Routes Mount
app.use('/api/auth', authRoutes);

// Product Routes (Protected with Admin Auth)
app.get('/api/products', prodCtrl.getProducts);
app.post('/api/products', authenticate, authorizeAdmin, prodCtrl.createProduct);
app.put('/api/products/:id', authenticate, authorizeAdmin, prodCtrl.updateProduct);
app.delete('/api/products/:id', authenticate, authorizeAdmin, prodCtrl.deleteProduct);
app.patch('/api/products/:productId/stock', authenticate, authorizeAdmin, prodCtrl.updateVariantStock);

// Order Routes
app.post('/api/orders', authenticate, orderCtrl.createOrder);
app.get('/api/orders/my-orders', authenticate, orderCtrl.getCustomerOrders);
app.get('/api/orders/all', authenticate, authorizeAdmin, orderCtrl.getAllOrders);
app.put('/api/orders/:id/status', authenticate, authorizeAdmin, orderCtrl.updateOrderStatus);
app.patch('/api/orders/:orderId/cancel', authenticate, orderCtrl.cancelUserOrder);

// Optional Auth Middleware
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

// Public Config
app.get('/api/config/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// Static files for local development
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Local development server listener
const PORT = process.env.PORT || 8000;
if (process.env.NODE_ENV !== 'production') {
    connectDB().then(() => {
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    });
}

module.exports = app;