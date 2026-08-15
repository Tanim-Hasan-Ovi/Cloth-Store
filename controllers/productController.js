const Product = require('../models/Product');

// Get all products 
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find()
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });

        const formattedProducts = products.map(product => ({
            ...product,
            variants: product.variants.map(variant => ({
                size: variant.size,
                quantity: variant.quantity,
                isOutOfStock: variant.quantity === 0
            }))
        }));

        res.status(200).json(formattedProducts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: Create product with Image
exports.createProduct = async (req, res) => {
    try {
        const { title, description, price, category, image, variants } = req.body;
        const product = await Product.create({
            title,
            description,
            price,
            category,
            image: image || '',
            variants
        });
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Admin: Edit / Update complete product
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price, category, image, variants } = req.body;

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { title, description, price, category, image, variants },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(updatedProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Admin: Delete Product
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedProduct = await Product.findByIdAndDelete(id);
        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: Update Stock Only
exports.updateVariantStock = async (req, res) => {
    try {
        const { productId } = req.params;
        const { size, quantity } = req.body;

        const product = await Product.findOneAndUpdate(
            { _id: productId, 'variants.size': size },
            { $set: { 'variants.$.quantity': quantity } },
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product or size variant not found' });
        }

        res.status(200).json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};