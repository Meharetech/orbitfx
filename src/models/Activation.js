const mongoose = require('mongoose');

const activationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, default: 150 },
    planName: { type: String, default: 'Yearly Activation' },
    status: { type: String, default: 'Active' },
    expiryDate: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Activation', activationSchema);
