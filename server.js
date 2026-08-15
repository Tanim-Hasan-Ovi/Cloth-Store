require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken'); // Added missing jwt

// Middlewares
const authMiddleware = require('./middleware/auth');
// Handle both naming styles (protect/authenticate and adminOnly/authorizeAdmin)
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

// Serve static frontend files and uploaded images
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Single Image Upload Route
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ imageUrl });
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
app.patch('/api/cart/:reservationId', optionalAuth, cartCtrl.updateCartItem); // Ensure this line exists
app.delete('/api/cart/:reservationId', optionalAuth, cartCtrl.removeFromCart);
app.delete('/api/cart/clear-all', optionalAuth, cartCtrl.clearAllCart);

// Frontend Fallback Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Public Config Route for Frontend
app.get('/api/config/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

app.delete('/api/cart/clear-all', authenticate, cartCtrl.clearAllCart);


app.patch('/api/cart/:reservationId', optionalAuth, cartCtrl.updateCartItem);

app.patch('/api/orders/:orderId/cancel', authenticate, orderCtrl.cancelUserOrder);


// Disable 304 Caching for all API routes
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});


// Database Connection & Server Start
const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('MongoDB connected successfully');
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    })
    .catch((err) => console.error('Database connection error:', err));