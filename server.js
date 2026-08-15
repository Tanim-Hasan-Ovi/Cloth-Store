require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { authenticate, authorizeAdmin } = require('./middleware/auth');
const authCtrl = require('./controllers/authController');
const prodCtrl = require('./controllers/productController');
const orderCtrl = require('./controllers/orderController');

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

// Authentication routes
app.post('/api/auth/register', authCtrl.register);
app.post('/api/auth/login', authCtrl.login);
app.put('/api/auth/profile', authenticate, authCtrl.updateProfile);

// Product routes
app.get('/api/products', prodCtrl.getProducts);
app.post('/api/products', prodCtrl.createProduct);
app.put('/api/products/:id', prodCtrl.updateProduct);
app.delete('/api/products/:id', prodCtrl.deleteProduct);
app.patch('/api/products/:productId/stock', prodCtrl.updateVariantStock);

// Order routes
app.post('/api/orders', authenticate, orderCtrl.createOrder);
app.get('/api/orders/my-orders', authenticate, orderCtrl.getCustomerOrders);

// Frontend fallback route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection & server start
const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('MongoDB connected successfully');
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    })
    .catch((err) => console.error('Database connection error:', err));