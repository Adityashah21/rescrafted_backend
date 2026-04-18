const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['scrap_seller', 'craft_seller', 'scrap_buyer', 'craft_buyer'],
        required: true
    },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    // Seller bank/payment details
    bankDetails: {
        accountHolderName: { type: String },
        accountNumber: { type: String },
        ifscCode: { type: String },
        bankName: { type: String },
        upiId: { type: String }
    },
    razorpayAccountId: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);