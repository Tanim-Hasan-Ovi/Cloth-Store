const mongoose = require('mongoose');

const sizeVariantSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true,
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    quantity: {
        type: Number,
        required: true,
        min: [0, 'Quantity cannot be negative'],
        default: 0
    }
}, { _id: false });

const productSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    image: { type: String, default: '' }, // আপলোড করা ছবির পাথ (/uploads/...) এখানে সেভ হবে
    variants: [sizeVariantSchema]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

productSchema.virtual('isOutOfStock').get(function () {
    return this.variants.every(variant => variant.quantity === 0);
});

module.exports = mongoose.model('Product', productSchema);