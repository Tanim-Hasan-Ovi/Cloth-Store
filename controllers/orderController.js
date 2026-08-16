const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const CartReservation = require('../models/CartReservation');
const sendEmail = require('../utils/sendEmail');

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

        // Send Order Confirmation Email (Non-blocking background process)
        if (req.user && req.user.email) {
            const itemsTableRows = processedItems.map(item => `
                <tr>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111;">
                        <strong>${item.title}</strong><br>
                        <span style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Size: ${item.size}</span>
                    </td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: center; color: #111;">
                        ${item.quantity}
                    </td>
                    <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: right; color: #111;">
                        ৳ ${item.price * item.quantity}
                    </td>
                </tr>
            `).join('');

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; background-color: #ffffff;">
                    <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #111;">
                        <h1 style="letter-spacing: 4px; font-size: 24px; margin: 0; color: #000; text-transform: uppercase;">AVEN</h1>
                    </div>

                    <div style="padding: 20px 0;">
                        <h2 style="font-size: 18px; color: #16a34a; margin: 0 0 8px 0;">Order Confirmed!</h2>
                        <p style="font-size: 13px; color: #4b5563; line-height: 1.5; margin: 0 0 20px 0;">
                            Thank you for your order, <strong>${req.user.name || 'Valued Customer'}</strong>. We have received your order (ID: <code>${order._id}</code>) and are preparing it for shipment.
                        </p>

                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                            <thead>
                                <tr style="background-color: #f9fafb; text-align: left;">
                                    <th style="padding: 8px; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Item</th>
                                    <th style="padding: 8px; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; text-align: center;">Qty</th>
                                    <th style="padding: 8px; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsTableRows}
                            </tbody>
                        </table>

                        <div style="text-align: right; margin-bottom: 20px; border-top: 1px solid #111; padding-top: 12px;">
                            <p style="font-size: 16px; font-weight: bold; margin: 0; color: #000;">Total: ৳ ${totalAmount}</p>
                        </div>

                        <div style="background-color: #f9fafb; padding: 14px; border-radius: 4px; font-size: 12px; color: #4b5563; line-height: 1.6;">
                            <strong style="color: #111; text-transform: uppercase; font-size: 11px;">Delivery Details:</strong><br>
                            ${finalAddress.street || ''}, ${finalAddress.city || ''}<br>
                            <strong>Phone:</strong> ${userPhone}
                        </div>
                    </div>

                    <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 11px; color: #9ca3af;">
                        <p style="margin: 0;">© 2026 AVEN Apparel. All rights reserved.</p>
                    </div>
                </div>
            `;

            sendEmail({
                to: req.user.email,
                subject: `Order Confirmation #${order._id} — AVEN`,
                html: emailHtml
            }).catch(err => console.error('Order confirmation email failed to send:', err));
        }

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
            .populate({
                path: 'customer',
                select: 'name email phone address'
            })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
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