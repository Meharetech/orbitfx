const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'Active' }, // Active, Completed
    dailyProfit: { type: Number, default: 0 }, // For future ROI tracking
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Investment', investmentSchema);
