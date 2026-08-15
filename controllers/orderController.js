const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Customer: Create order
exports.createOrder = async (req, res) => {
    // Check if the user is an admin
    if (req.user && req.user.role === 'admin') {
        return res.status(403).json({ message: 'Admins are not allowed to place orders.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { items, shippingAddress } = req.body;
        let totalAmount = 0;
        const processedItems = [];

        for (const item of items) {
            const { productId, size, quantity } = item;

            // Atomic validation and decrement of the selected size
            const product = await Product.findOneAndUpdate(
                {
                    _id: productId,
                    variants: {
                        $elemMatch: { size: size, quantity: { $gte: quantity } }
                    }
                },
                {
                    $inc: { 'variants.$.quantity': -quantity }
                },
                { session, new: true }
            );

            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    message: `Stock unavailable for size "${size}" of product ID ${productId}`
                });
            }

            const itemTotal = product.price * quantity;
            totalAmount += itemTotal;

            processedItems.push({
                product: product._id,
                title: product.title,
                size: size,
                quantity: quantity,
                price: product.price
            });
        }

        const order = new Order({
            customer: req.user._id,
            items: processedItems,
            totalAmount,
            shippingAddress: shippingAddress || req.user.address
        });

        await order.save({ session });
        await session.commitTransaction();
        session.endSession();

        res.status(201).json(order);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

// Customer: Get my orders
exports.getCustomerOrders = async (req, res) => {
    try {
        const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: Get all orders from all users
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('customer', 'name email phone address')
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: Update Order Status
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};