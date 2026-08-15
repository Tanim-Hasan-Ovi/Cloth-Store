const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const CartReservation = require('../models/CartReservation');

// Customer: Create order
exports.createOrder = async (req, res) => {
    if (req.user && (req.user.role === 'admin' || req.user.isAdmin === true)) {
        return res.status(403).json({ message: 'Admins are not allowed to place orders.' });
    }

    const { items, shippingAddress } = req.body;

    const userPhone = req.user.phone;
    const finalAddress = shippingAddress || req.user.address;

    if (!userPhone || userPhone.trim() === '') {
        return res.status(400).json({
            message: 'Phone number is required to place an order. Please update your profile.'
        });
    }

    if (!finalAddress || !finalAddress.street || !finalAddress.city) {
        return res.status(400).json({
            message: 'Complete delivery address (Street and City) is required. Please update your profile.'
        });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Order must contain at least one item.' });
    }

    try {
        let totalAmount = 0;
        const processedItems = [];

        for (const item of items) {
            const productId = item.productId || item.product;
            const size = item.size;
            const quantity = parseInt(item.quantity) || 1;

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ message: `Product not found (ID: ${productId})` });
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

            if (CartReservation) {
                await CartReservation.deleteOne({
                    userId: req.user._id,
                    productId: productId,
                    size: size
                });
            }
        }

        const order = new Order({
            customer: req.user._id,
            items: processedItems,
            totalAmount,
            shippingAddress: finalAddress
        });

        await order.save();
        return res.status(201).json(order);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Customer: Get my orders
exports.getCustomerOrders = async (req, res) => {
    try {
        const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 });
        return res.status(200).json(orders);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Admin: Get all orders from all users
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('customer', 'name email phone address')
            .populate('user', 'name email phone address')
            .sort({ createdAt: -1 });

        return res.status(200).json(orders);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Admin: Update Order Status
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

        if (!status || !validStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({ message: 'Invalid order status' });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status: status.toLowerCase() },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        return res.status(200).json(order);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Customer: Cancel Order (Only if Pending)
exports.cancelUserOrder = async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user._id;

    try {
        const order = await Order.findOne({ _id: orderId, customer: userId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        if (order.status.toLowerCase() !== 'pending') {
            return res.status(400).json({ message: 'Only pending orders can be cancelled.' });
        }

        order.status = 'cancelled';
        await order.save();

        for (const item of order.items) {
            const prodId = item.product;
            if (prodId && item.size) {
                await Product.updateOne(
                    { _id: prodId, 'variants.size': item.size },
                    { $inc: { 'variants.$.quantity': item.quantity || 1 } }
                );
            }
        }

        return res.status(200).json({ message: 'Order cancelled successfully and stock restored.', order });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};