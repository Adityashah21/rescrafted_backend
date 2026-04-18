const Product = require('../models/Product');

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find().populate('seller', 'name email').sort({ createdAt: -1 });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: "Server Error while fetching products." });
    }
};

exports.getUserProducts = async (req, res) => {
    try {
        const myProducts = await Product.find({ seller: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(myProducts);
    } catch (error) {
        res.status(500).json({ message: "Server Error while fetching your products." });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { title, description, category, subCategory, price, stock, unit } = req.body;

        if (!title || !description || !category || !price || !stock) {
            return res.status(400).json({ message: "All required fields must be filled." });
        }

        let imageArray = [];
        if (req.file) {
            const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
            imageArray.push({ url: imageUrl, fileId: req.file.filename });
        }

        const newProduct = new Product({
            seller: req.user._id,
            title, description, category,
            subCategory: subCategory || 'General',
            price, stock,
            unit: unit || 'piece',
            images: imageArray
        });

        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }
        if (product.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized to delete this product." });
        }
        await Product.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Product deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};