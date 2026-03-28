const mongoose = require('mongoose');

const dailyProfitSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    investmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment', required: true },
    amount: { type: Number, required: true },
    percentage: { type: Number, required: true }, // The rate used (e.g., 1%)
    batchId: { type: String }, // To group multiple distributions on same day
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DailyProfit', dailyProfitSchema);
