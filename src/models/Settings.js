const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    withdrawalFee: { type: Number, default: 10 }, // Percentage
    minWithdrawal: { type: Number, default: 1 }, 
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
