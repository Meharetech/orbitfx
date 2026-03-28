const mongoose = require('mongoose');

const fundRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paymentMethod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentMethod',
        required: true
    },
    amount: {
        type: Number,
        required: [true, 'Please enter an amount']
    },
    transactionId: {
        type: String,
        required: [true, 'Please enter transaction ID'],
        trim: true
    },
    screenshot: {
        type: String, // Base64 or URL
        required: [true, 'Please upload payment proof screenshot']
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    adminNote: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('FundRequest', fundRequestSchema);
