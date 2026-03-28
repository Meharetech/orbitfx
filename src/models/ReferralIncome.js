const mongoose = require('mongoose');

const referralIncomeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Receiver
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who activated
    amount: { type: Number, required: true },
    level: { type: Number, required: true },
    incomeType: { type: String, default: 'AI Bot Referral' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ReferralIncome', referralIncomeSchema);
