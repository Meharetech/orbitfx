const mongoose = require('mongoose');

const directRewardSchema = new mongoose.Schema({
    sponsorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    qualifiedDate:  { type: Date, default: Date.now },        // When L+R both activated
    totalPayments:  { type: Number, default: 15 },            // 15 months = $10 x 15
    paidCount:      { type: Number, default: 0 },             // How many months paid so far
    nextPaymentDate:{ type: Date },                           // Next scheduled payout
    isCompleted:    { type: Boolean, default: false },        // All 12 paid?
    payments: [{
        amount:     { type: Number, default: 10 },
        paidAt:     { type: Date, default: Date.now },
        month:      { type: Number },                         // Payment #1, #2 ... #12
    }]
}, { timestamps: true });

module.exports = mongoose.model('DirectReward', directRewardSchema);
