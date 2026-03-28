const mongoose = require('mongoose');

const botActivationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    botPrice: { type: Number, required: true },
    status: { type: String, default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BotActivation', botActivationSchema);
