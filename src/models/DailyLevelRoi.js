const mongoose = require('mongoose');

const dailyLevelRoiSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The receiver
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The investor earning ROI
    amount: { type: Number, required: true },
    level: { type: Number, required: true },
    levelRate: { type: Number }, // To store percentages like 0.30, 0.15 etc
    originalRoi: { type: Number, required: true }, // How much the downline earned that triggered this
    batchId: { type: String }, // To sync with personal ROI distributions
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DailyLevelRoi', dailyLevelRoiSchema);
