const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const DirectReward = require('../models/DirectReward');
const Activation = require('../models/Activation');
const User = require('../models/User');
const { 
    getPersonalRoiHistory, 
    getLevelRoiHistory,
    distributeRoiManual,
    previewRoiDistribution,
    getDashboardStats
} = require('../controllers/tradingProfitController');

// @route   GET /api/reports/dashboard-stats
// @desc    Get aggregated stats for user dashboard
// @access  Private
router.get('/dashboard-stats', protect, getDashboardStats);

// @route   POST /api/reports/preview-roi
// @desc    Admin previews distribution
// @access  Private (Admin Only)
router.post('/preview-roi', protect, previewRoiDistribution);

// @route   POST /api/reports/distribute-roi
// @desc    Admin manually triggers daily ROI for all active investments
// @access  Private (Admin Only)
router.post('/distribute-roi', protect, distributeRoiManual);

// @route   GET /api/reports/direct-reward
// @desc    Get full direct referral reward history for logged-in user
// @access  Private
router.get('/direct-reward', protect, async (req, res) => {
    try {
        const reward = await DirectReward.findOne({ sponsorId: req.user._id })
            .sort({ createdAt: -1 });

        if (!reward) {
            return res.json({
                qualified: false,
                totalEarned: 0,
                paidCount: 0,
                remaining: 12,
                isCompleted: false,
                payments: [],
                nextPaymentDate: null,
                qualifiedDate: null,
            });
        }

        const leftChild  = req.user.leftChild  ? await User.findById(req.user.leftChild).select('fullName username referralCode activationDate isActivated') : null;
        const rightChild = req.user.rightChild ? await User.findById(req.user.rightChild).select('fullName username referralCode activationDate isActivated') : null;

        res.json({
            qualified: true,
            totalEarned: reward.paidCount * 10,
            paidCount: reward.paidCount,
            remaining: reward.totalPayments - reward.paidCount,
            isCompleted: reward.isCompleted,
            nextPaymentDate: reward.nextPaymentDate,
            qualifiedDate: reward.qualifiedDate,
            payments: reward.payments,
            leftReferral: leftChild,
            rightReferral: rightChild,
        });
    } catch (err) {
        console.error('Direct reward report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/reports/activation-history
// @desc    Get activation history for logged-in user
// @access  Private
router.get('/activation-history', protect, async (req, res) => {
    try {
        const activations = await Activation.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        const now = new Date();

        const result = activations.map(a => {
            const expiry = new Date(a.expiryDate);
            const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
            const isExpired = expiry < now;
            return {
                _id: a._id,
                planName: a.planName,
                amount: a.amount,
                status: isExpired ? 'Expired' : a.status,
                activatedOn: a.createdAt,
                expiryDate: a.expiryDate,
                daysRemaining,
                isExpired,
            };
        });

        res.json(result);
    } catch (err) {
        console.error('Activation history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

const PairReward = require('../models/PairReward');

// @route   GET /api/reports/pair-reward
// @desc    Get pair matching monthly reward status and history
// @access  Private
router.get('/pair-reward', protect, async (req, res) => {
    try {
        const reward = await PairReward.findOne({ userId: req.user._id });
        
        // Always return the rank plans so frontend can show the table
        const rankPlans = PairReward.RANK_PLANS;

        if (!reward) {
            return res.json({
                isRewarded: false,
                currentRank: req.user.currentRank || null,
                totalPairs:  req.user.totalPairs || 0,
                leftCount:   req.user.leftTeamCount || 0,
                rightCount:  req.user.rightTeamCount || 0,
                payments: [],
                rankPlans
            });
        }

        res.json({
            isRewarded:      reward.isRewarded,
            currentRank:     reward.currentRank,
            totalPairs:      reward.totalPairs,
            leftCount:       reward.leftCount,
            rightCount:      reward.rightCount,
            paidCount:       reward.paidCount,
            nextPaymentDate: reward.nextPaymentDate,
            isCompleted:     reward.isCompleted,
            payments:        reward.payments,
            rankPlans
        });
    } catch (err) {
        console.error('Pair reward report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/reports/trading-profit
// @desc    Get personal daily ROI history
// @access  Private
router.get('/trading-profit', protect, getPersonalRoiHistory);

// @route   GET /api/reports/trading-level
// @desc    Get level-roi history
// @access  Private
router.get('/trading-level', protect, getLevelRoiHistory);

// @route   POST /api/reports/sync-pairs
// @desc    Utility to recalculate all binary pair counts across the whole system
// @access  Private (Admin ideally, but for now simple protect)
router.get('/sync-pairs', protect, async (req, res) => {
    try {
        const { updatePairCountsForAncestors } = require('../controllers/pairRewardController');

        // 1. Reset everyone to 0 first to avoid double counting
        await User.updateMany({}, {
            leftTeamCount: 0,
            rightTeamCount: 0,
            totalPairs: 0
        });

        // 2. Find all activated users
        const activeUsers = await User.find({ isActivated: true });

        // 3. For each activated user, walk up their tree and increment counts
        // We don't want to trigger "immediate reward payouts" during sync usually,
        // or if we do, we should check if they already have PairReward record.
        // For simplicity, let's just update the counts first.
        for (const user of activeUsers) {
            let currentChild = user;
            let currentParentId = user.parentId;

            while (currentParentId) {
                const parent = await User.findById(currentParentId);
                if (!parent) break;

                if (parent.leftChild && parent.leftChild.toString() === currentChild._id.toString()) {
                    parent.leftTeamCount = (parent.leftTeamCount || 0) + 1;
                } else if (parent.rightChild && parent.rightChild.toString() === currentChild._id.toString()) {
                    parent.rightTeamCount = (parent.rightTeamCount || 0) + 1;
                }

                parent.totalPairs = Math.min(parent.leftTeamCount, parent.rightTeamCount);
                await parent.save();

                currentChild = parent;
                currentParentId = parent.parentId;
            }
        }

        res.json({ message: 'Binary pair counts synchronized successfully for the entire tree.' });
    } catch (err) {
        console.error('Sync pairs error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
