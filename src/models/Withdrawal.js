const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    serviceFee: { type: Number, required: true }, // 10% of amount
    netAmount: { type: Number, required: true }, // amount - serviceFee
    walletAddress: { type: String, required: true },
    walletNetwork: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    adminNote: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
