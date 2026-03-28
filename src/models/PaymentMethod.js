const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a payment method name'],
        trim: true
    },
    walletAddress: {
        type: String,
        required: [true, 'Please add a wallet address'],
        trim: true
    },
    qrCode: {
        type: String, // URL/Path to the uploaded QR image
        required: [true, 'Please upload a QR code image']
    },
    network: {
        type: String, // e.g., TRC20, ERC20, BEP20
        default: 'TRC20'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
