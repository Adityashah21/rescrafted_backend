const User = require('../models/User');

// Update bank/payment details
exports.updateBankDetails = async (req, res) => {
    try {
        const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                bankDetails: {
                    accountHolderName,
                    accountNumber,
                    ifscCode,
                    bankName,
                    upiId
                }
            },
            { new: true }
        ).select('-password');

        res.status(200).json({ message: 'Bank details updated!', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};