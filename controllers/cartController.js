const mongoose = require('mongoose');
const Product = require('../models/Product');
const CartReservation = require('../models/CartReservation');

const cleanupExpiredReservations = async () => {
    try {
        const now = new Date();
        const expiredItems = await CartReservation.find({
            expiresAt: { $ne: null, $lte: now }
        });

        for (const item of expiredItems) {
            await Product.updateOne(
                { _id: item.productId, 'variants.size': item.size },
                { $inc: { 'variants.$.quantity': item.quantity } }
            );
            await CartReservation.findByIdAndDelete(item._id);
        }
    } catch (err) {
        console.error('Error cleaning up expired reservations:', err);
    }
};

setInterval(cleanupExpiredReservations, 60 * 1000);

exports.getUserCart = async (req, res) => {
    try {
        if (req.user && (req.user.role === 'admin' || req.isAdmin)) {
            return res.status(200).json([]);
        }

        await cleanupExpiredReservations();

        const rawUserId = req.user ? (req.user._id || req.user.id) : null;
        const guestId = req.headers['x-guest-id'] || req.query.guestId;

        let queryConditions = [];

        if (rawUserId) {
            if (mongoose.Types.ObjectId.isValid(rawUserId)) {
                const userObjId = new mongoose.Types.ObjectId(rawUserId);
                queryConditions.push({ userId: userObjId });

                // Auto-merge guest reservations to user account if logged in
                if (guestId) {
                    await CartReservation.updateMany(
                        { guestId: guestId, userId: null },
                        { $set: { userId: userObjId, guestId: null } }
                    );
                }
            }
            queryConditions.push({ userId: rawUserId.toString() });
        } else if (guestId) {
            queryConditions.push({ guestId: guestId });
        }

        if (queryConditions.length === 0) {
            return res.status(200).json([]);
        }

        const items = await CartReservation.find({ $or: queryConditions })
            .populate('productId', 'title price image variants');

        const cart = items.map(item => {
            const p = item.productId;
            const variant = p?.variants?.find(v => v.size === item.size);
            return {
                reservationId: item._id,
                productId: p?._id,
                title: p?.title,
                price: p?.price,
                image: p?.image,
                size: item.size,
                quantity: item.quantity,
                expiresAt: item.expiresAt,
                availableVariants: p?.variants || [],
                currentRemainingStock: variant ? variant.quantity : 0
            };
        });

        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.addToCart = async (req, res) => {
    const { productId, size, quantity } = req.body;
    const qty = parseInt(quantity) || 1;
    const rawUserId = req.user ? (req.user._id || req.user.id) : null;
    const guestId = req.body.guestId || req.headers['x-guest-id'];

    if (req.user && (req.user.role === 'admin' || req.isAdmin)) {
        return res.status(403).json({ message: 'Admins are not permitted to add items to cart.' });
    }

    try {
        await cleanupExpiredReservations();

        const product = await Product.findOneAndUpdate(
            {
                _id: productId,
                variants: {
                    $elemMatch: { size: size, quantity: { $gte: qty } }
                }
            },
            {
                $inc: { 'variants.$.quantity': -qty }
            },
            { new: true }
        );

        if (!product) {
            return res.status(400).json({ message: `Insufficient stock for size ${size}.` });
        }

        const updatedVariant = product.variants.find(v => v.size === size);
        const remainingStock = updatedVariant ? updatedVariant.quantity : 0;

        let expiresAt = null;
        if (remainingStock <= 10) {
            expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        }

        let query = {};
        let userIdToSave = null;

        if (rawUserId) {
            userIdToSave = mongoose.Types.ObjectId.isValid(rawUserId)
                ? new mongoose.Types.ObjectId(rawUserId)
                : rawUserId;
            query = { userId: userIdToSave, productId, size };
        } else {
            query = { guestId, productId, size };
        }

        let reservation = await CartReservation.findOne(query);

        if (reservation) {
            reservation.quantity += qty;
            if (expiresAt) reservation.expiresAt = expiresAt;
            await reservation.save();
        } else {
            reservation = new CartReservation({
                userId: userIdToSave,
                guestId: userIdToSave ? null : guestId,
                productId,
                size,
                quantity: qty,
                expiresAt
            });
            await reservation.save();
        }

        res.status(200).json({
            message: 'Item added to cart & stock reserved.',
            reservation,
            expiresAt
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.removeFromCart = async (req, res) => {
    const { reservationId } = req.params;
    try {
        const reservation = await CartReservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Cart item not found or expired.' });
        }

        await Product.updateOne(
            { _id: reservation.productId, 'variants.size': reservation.size },
            { $inc: { 'variants.$.quantity': reservation.quantity } }
        );

        await CartReservation.findByIdAndDelete(reservationId);
        res.status(200).json({ message: 'Item removed and stock restored.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.clearAllCart = async (req, res) => {
    try {
        const rawUserId = req.user ? (req.user._id || req.user.id) : null;
        const guestId = req.headers['x-guest-id'];

        let queryConditions = [];
        if (rawUserId) {
            if (mongoose.Types.ObjectId.isValid(rawUserId)) {
                queryConditions.push({ userId: new mongoose.Types.ObjectId(rawUserId) });
            }
            queryConditions.push({ userId: rawUserId.toString() });
        }
        if (guestId) {
            queryConditions.push({ guestId });
        }

        if (queryConditions.length > 0) {
            await CartReservation.deleteMany({ $or: queryConditions });
        }

        res.status(200).json({ message: 'Cart cleared successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateCartItem = async (req, res) => {
    const { reservationId } = req.params;
    const { quantity, size } = req.body;
    const newQty = parseInt(quantity);

    try {
        await cleanupExpiredReservations();

        const reservation = await CartReservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Cart item not found or expired.' });
        }

        const product = await Product.findById(reservation.productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const oldSize = reservation.size;
        const targetSize = size || oldSize;
        const oldQty = reservation.quantity;
        const targetQty = newQty > 0 ? newQty : oldQty;

        if (targetSize === oldSize) {
            const diff = targetQty - oldQty;
            if (diff > 0) {
                const updated = await Product.findOneAndUpdate(
                    {
                        _id: product._id,
                        variants: { $elemMatch: { size: targetSize, quantity: { $gte: diff } } }
                    },
                    { $inc: { 'variants.$.quantity': -diff } },
                    { new: true }
                );

                if (!updated) {
                    return res.status(400).json({ message: `Insufficient stock for size ${targetSize}.` });
                }
            } else if (diff < 0) {
                await Product.updateOne(
                    { _id: product._id, 'variants.size': targetSize },
                    { $inc: { 'variants.$.quantity': Math.abs(diff) } }
                );
            }
        } else {
            await Product.updateOne(
                { _id: product._id, 'variants.size': oldSize },
                { $inc: { 'variants.$.quantity': oldQty } }
            );

            const updated = await Product.findOneAndUpdate(
                {
                    _id: product._id,
                    variants: { $elemMatch: { size: targetSize, quantity: { $gte: targetQty } } }
                },
                { $inc: { 'variants.$.quantity': -targetQty } },
                { new: true }
            );

            if (!updated) {
                await Product.updateOne(
                    { _id: product._id, 'variants.size': oldSize },
                    { $inc: { 'variants.$.quantity': -oldQty } }
                );
                return res.status(400).json({ message: `Insufficient stock for size ${targetSize}.` });
            }
        }

        const finalProduct = await Product.findById(product._id);
        const finalVariant = finalProduct.variants.find(v => v.size === targetSize);
        const remainingStock = finalVariant ? finalVariant.quantity : 0;

        reservation.size = targetSize;
        reservation.quantity = targetQty;
        if (remainingStock <= 10) {
            reservation.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        } else {
            reservation.expiresAt = null;
        }

        await reservation.save();
        res.status(200).json({ message: 'Cart item updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};