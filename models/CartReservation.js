const mongoose = require('mongoose');

const cartReservationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    guestId: {
        type: String,
        default: null
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    size: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    expiresAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('CartReservation', cartReservationSchema);