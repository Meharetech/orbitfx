const mongoose = require('mongoose');

// Rank definitions — pairs required & monthly reward
const RANK_PLANS = [
    { rank: 'STAR',             pairs: 10,      monthlyReward: 30,     color: '#60a5fa' },
    { rank: 'SILVER',           pairs: 30,      monthlyReward: 60,     color: '#94a3b8' },
    { rank: 'GOLD',             pairs: 100,     monthlyReward: 200,    color: '#f59e0b' },
    { rank: 'PEARL',            pairs: 250,     monthlyReward: 300,    color: '#e879f9' },
    { rank: 'PLATINUM',         pairs: 500,     monthlyReward: 600,    color: '#67e8f9' },
    { rank: 'EMERALD',          pairs: 1200,    monthlyReward: 1600,   color: '#4ade80' },
    { rank: 'DIAMOND',          pairs: 3000,    monthlyReward: 3000,   color: '#818cf8' },
    { rank: 'ROYAL DIAMOND',    pairs: 7000,    monthlyReward: 6000,   color: '#c084fc' },
    { rank: 'KOHINOOR',         pairs: 15000,   monthlyReward: 10000,  color: '#f472b6' },
    { rank: 'CROWN',            pairs: 30000,   monthlyReward: 20000,  color: '#fb923c' },
    { rank: 'AMBASSADOR',       pairs: 70000,   monthlyReward: 40000,  color: '#34d399' },
    { rank: 'CROWN AMBASSADOR', pairs: 150000,  monthlyReward: 100000, color: '#fbbf24' },
];

const pairRewardSchema = new mongoose.Schema({
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currentRank:    { type: String, default: null },
    totalPairs:     { type: Number, default: 0 },
    leftCount:      { type: Number, default: 0 },  // Total activated left-leg descendants
    rightCount:     { type: Number, default: 0 },  // Total activated right-leg descendants
    isRewarded:     { type: Boolean, default: false },
    rewardStartDate:{ type: Date },
    nextPaymentDate:{ type: Date },
    paidCount:      { type: Number, default: 0 },  // How many months paid
    isCompleted:    { type: Boolean, default: false },
    payments: [{
        rank:        { type: String },
        amount:      { type: Number },
        paidAt:      { type: Date, default: Date.now },
        month:       { type: Number },
    }]
}, { timestamps: true });

pairRewardSchema.statics.RANK_PLANS = RANK_PLANS;

// Helper: get rank for given pairs
pairRewardSchema.statics.getRankForPairs = (pairs) => {
    let currentRank = null;
    for (const plan of RANK_PLANS) {
        if (pairs >= plan.pairs) currentRank = plan;
    }
    return currentRank;
};

module.exports = mongoose.model('PairReward', pairRewardSchema);
