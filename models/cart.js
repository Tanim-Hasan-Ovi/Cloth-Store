const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    size: {
        type: String,
        default: ''
    },
    color: {
        type: String,
        default: ''
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1
    }
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    items: [cartItemSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('Cart', cartSchema);