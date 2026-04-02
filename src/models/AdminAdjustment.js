const mongoose = require('mongoose');

const adminAdjustmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminId: { type: String, default: 'TRD-001' }, // Tracking the admin node
    amount: { type: Number, required: true },
    type: { type: String, enum: ['Deposit', 'Withdraw'], required: true },
    target: { type: String, enum: ['Wallet', 'Investment'], required: true },
    note: { type: String },
    previousBalance: { type: Number },
    newBalance: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminAdjustment', adminAdjustmentSchema);
