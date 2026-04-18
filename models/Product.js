const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: ['scrap', 'handicraft'], required: true },
    subCategory: { type: String, default: 'General' },
    price: { type: Number, required: true },
    unit: { type: String, default: 'piece', enum: ['piece', 'kg', 'ton'] },
    stock: { type: Number, required: true },
    images: [{ url: String, fileId: String }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);