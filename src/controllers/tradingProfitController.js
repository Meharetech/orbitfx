const mongoose = require('mongoose');
const User = require('../models/User');
const Investment = require('../models/Investment');
const DailyProfit = require('../models/DailyProfit');
const DailyLevelRoi = require('../models/DailyLevelRoi');
const ReferralIncome = require('../models/ReferralIncome');
const Activation = require('../models/Activation');
const DirectReward = require('../models/DirectReward');
const PairReward = require('../models/PairReward');
const Withdrawal = require('../models/Withdrawal');

// @route   POST /api/reports/preview-roi
// @desc    Admin previews the impact of a distribution percentage
// @access  Private (Admin)
exports.previewRoiDistribution = async (req, res) => {
    try {
        const { percentage } = req.body;
        if (!percentage || percentage <= 0) {
            return res.status(400).json({ message: 'Invalid percentage' });
        }

        const dailyRate = percentage / 100;
        const activeInvestments = await Investment.find({ status: 'Active' });
        
        let totalPersonalProfit = 0;
        let totalLevelSharing = 0;
        let userCount = 0;

        for (const inv of activeInvestments) {
            const amount = inv.amount;
            const personalProfit = amount * dailyRate;
            totalPersonalProfit += personalProfit;
            totalLevelSharing += (personalProfit * 0.25);
            userCount++;
        }

        res.json({
            userCount,
            totalPersonalProfit,
            totalLevelSharing,
            totalSystemOutflow: totalPersonalProfit + totalLevelSharing,
            percentage
        });
    } catch (err) {
        console.error('Preview ROI error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @route   POST /api/reports/distribute-roi
// @desc    Admin manually triggers daily ROI for all active investments
// @access  Private (Admin)
exports.distributeRoiManual = async (req, res) => {
    try {
        const { percentage } = req.body; 
        if (!percentage || percentage <= 0) {
            return res.status(400).json({ message: 'Invalid percentage' });
        }

        const dailyRate = percentage / 100;
        const batchId = `BATCH-${Date.now()}`; // Unique ID for this distribution event
        console.log(`[Admin] STARTING Manual ROI: ${percentage}% (Batch: ${batchId})...`);

        const activeInvestments = await Investment.find({ status: 'Active' });
        console.log(`[Admin] Found ${activeInvestments.length} Active Investments.`);

        for (const investment of activeInvestments) {
            try {
                const user = await User.findById(investment.userId);
                if (!user) continue;

                const profitAmount = investment.amount * dailyRate;

                // 1. Credit User balance
                user.balance += profitAmount;
                user.totalEarned += profitAmount;
                await user.save();

                // 2. Personal Log
                await DailyProfit.create({
                    userId: user._id,
                    investmentId: investment._id,
                    amount: profitAmount,
                    percentage: percentage,
                    batchId: batchId
                });

                // 3. Level Distribution
                const levelSharePool = profitAmount * 0.25; 
                await distributeTradingLevelRoi(user, levelSharePool, profitAmount, batchId);
                
            } catch (userErr) {
                console.error(`[Admin] ROI Err ${investment._id}:`, userErr.message);
            }
        }

        res.json({ message: `ROI Distributed. Batch: ${batchId}` });
    } catch (err) {
        console.error('CRITICAL ROI error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

const distributeTradingLevelRoi = async (investor, poolAmount, originalProfit, batchId) => {
    const levelRates = {
        1: 0.30, 2: 0.15, 3: 0.12, 4: 0.10, 5: 0.08, 6: 0.05, 7: 0.04,
    };

    let currentSponsorId = investor.sponsorId;
    let level = 1;

    while (currentSponsorId && level <= 20) {
        try {
            if (!mongoose.Types.ObjectId.isValid(currentSponsorId)) break;

            const sponsor = await User.findById(currentSponsorId);
            if (!sponsor) break;

            let ratePerLevel = 0;
            if (levelRates[level]) {
                ratePerLevel = levelRates[level];
            } else if (level >= 8 && level <= 10) {
                ratePerLevel = 0.02;
            } else if (level >= 11 && level <= 20) {
                ratePerLevel = 0.01;
            }

            if (ratePerLevel > 0) {
                const levelIncome = poolAmount * ratePerLevel;
                sponsor.balance += levelIncome;
                sponsor.totalEarned += levelIncome;
                await sponsor.save();

                await DailyLevelRoi.create({
                    userId: sponsor._id,
                    fromUserId: investor._id,
                    amount: levelIncome,
                    level: level,
                    levelRate: ratePerLevel,
                    originalRoi: originalProfit,
                    batchId: batchId
                });
            }

            currentSponsorId = sponsor.sponsorId;
            level++;
        } catch (lvlErr) {
            console.error(`[LevelROI] Err L${level}:`, lvlErr.message);
            break;
        }
    }
};

exports.getPersonalRoiHistory = async (req, res) => {
    try {
        const history = await DailyProfit.find({ userId: req.user._id })
            .populate('investmentId', 'amount status')
            .sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        console.error('Get personal ROI error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getLevelRoiHistory = async (req, res) => {
    try {
        const history = await DailyLevelRoi.find({ userId: req.user._id })
            .populate('fromUserId', 'username fullName')
            .sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        console.error('Get level ROI error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @route   GET /api/reports/dashboard-stats
// @desc    Get aggregated stats for user dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // 1. My Activation ($) & Days Remaining
        const latestActivation = await Activation.findOne({ userId }).sort({ createdAt: -1 });
        let activationAmount = 0;
        let daysRemaining = 0;
        if (latestActivation) {
            activationAmount = latestActivation.amount;
            const expiry = new Date(latestActivation.expiryDate);
            daysRemaining = Math.max(0, Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)));
        }

        // 2. Portfolio Investment ($)
        const activeInvestments = await Investment.find({ userId, status: 'Active' });
        const totalInvestment = activeInvestments.reduce((acc, i) => acc + i.amount, 0);

        // 3. Team Statistics
        const directReferralCount = await User.countDocuments({ sponsorId: userId });
        const leftTeamCount = user.leftTeamCount || 0;
        const rightTeamCount = user.rightTeamCount || 0;
        const totalTeamCount = leftTeamCount + rightTeamCount;

        // 4. Incomes & Rewards
        // 4a. Trading Profit
        const tradingProfits = await DailyProfit.find({ userId });
        const totalTradingProfit = tradingProfits.reduce((acc, p) => acc + p.amount, 0);

        // 4b. Referral Income (e.g. Bot comms)
        const referralIncomes = await ReferralIncome.find({ userId });
        const totalReferralIncome = referralIncomes.reduce((acc, r) => acc + r.amount, 0);

        // 4c. Trading Profit Level Income
        const levelRois = await DailyLevelRoi.find({ userId });
        const totalLevelRoi = levelRois.reduce((acc, r) => acc + r.amount, 0);

        // 4d. Direct Referral Reward (Qualified reward system)
        const directReward = await DirectReward.findOne({ sponsorId: userId });
        const totalDirectReward = directReward ? (directReward.paidCount * 10) : 0; 

        // 4e. Pair Matching Rewards (One-time rank rewards & monthly rewards)
        const pairReward = await PairReward.findOne({ userId });
        let totalPairMatchingReward = 0;
        let totalPairMatchingMonthlyReward = 0;
        if (pairReward) {
            // Rank Rewards
            totalPairMatchingReward = (pairReward.payments || [])
                .filter(p => p.type === 'Rank Reward' || !p.type)
                .reduce((acc, p) => acc + p.amount, 0);
            
            // Monthly Rewards
            totalPairMatchingMonthlyReward = (pairReward.payments || [])
                .filter(p => p.type === 'Monthly Reward' || p.type === 'Weekly Reward')
                .reduce((acc, p) => acc + p.amount, 0);
        }

        // 4f. Monthly Profit Growth (For Charts)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);

        const monthlyGrowth = await DailyProfit.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: twelveMonthsAgo } } },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" }
                    },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // 5. Overall Earnings & Withdrawals
        const totalEarnings = totalTradingProfit + totalReferralIncome + totalLevelRoi + totalDirectReward + totalPairMatchingReward + totalPairMatchingMonthlyReward;

        const approvedWithdrawals = await Withdrawal.find({ userId, status: 'Approved' });
        const totalWithdrawal = approvedWithdrawals.reduce((acc, w) => acc + w.amount, 0);

        // 6. Recent Activity Aggregation
        const WithdrawalModel = require('../models/Withdrawal');
        const FundRequestModel = require('../models/FundRequest');

        const [latestWithdrawals, latestFunds, latestProfits, latestReferralIncomes] = await Promise.all([
            WithdrawalModel.find({ userId }).sort({ createdAt: -1 }).limit(5),
            FundRequestModel.find({ userId }).sort({ createdAt: -1 }).limit(5),
            DailyProfit.find({ userId }).sort({ createdAt: -1 }).limit(5),
            ReferralIncome.find({ userId }).sort({ createdAt: -1 }).limit(5),
        ]);

        const allActivity = [
            ...latestWithdrawals.map(w => ({ type: 'Withdrawal', amount: `-$${w.amount}`, status: w.status, date: w.createdAt, rawDate: w.createdAt, color: 'text-red-400', iconType: 'withdrawal' })),
            ...latestFunds.map(f => ({ type: 'Deposit', amount: `+$${f.amount}`, status: f.status, date: f.createdAt, rawDate: f.createdAt, color: 'text-blue-400', iconType: 'deposit' })),
            ...latestProfits.map(p => ({ type: 'Trading Profit', amount: `+$${p.amount.toFixed(2)}`, status: 'Completed', date: p.createdAt, rawDate: p.createdAt, color: 'text-green-400', iconType: 'profit' })),
            ...latestReferralIncomes.map(r => ({ type: 'Referral Bonus', amount: `+$${r.amount.toFixed(2)}`, status: 'Completed', date: r.createdAt, rawDate: r.createdAt, color: 'text-crypto-violet', iconType: 'referral' })),
        ]
        .sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate))
        .slice(0, 5);

        res.json({
            balance: user.balance,
            isActivated: user.isActivated,
            username: user.username,
            // Row 1
            myActivation: activationAmount,
            daysRemaining: daysRemaining,
            totalInvestment: totalInvestment,
            directReferralCount: directReferralCount,
            // Row 2
            leftTeamCount: leftTeamCount,
            rightTeamCount: rightTeamCount,
            totalTeamCount: totalTeamCount,
            totalTradingProfit: totalTradingProfit,
            // Row 3
            totalReferralIncome: totalReferralIncome,
            directReferralReward: totalDirectReward,
            pairMatchingReward: totalPairMatchingReward,
            pairMatchingMonthlyReward: totalPairMatchingMonthlyReward,
            // Row 4
            totalLevelRoi: totalLevelRoi,
            totalEarnings: totalEarnings,
            totalWithdrawal: totalWithdrawal,
            // Activity
            recentActivity: allActivity,
            // Growth
            monthlyProfitGrowth: monthlyGrowth
        });
    } catch (err) {
        console.error('Dashboard Stats Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
