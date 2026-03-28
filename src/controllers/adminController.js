const User = require('../models/User');
const Investment = require('../models/Investment');
const BotActivation = require('../models/BotActivation');
const DailyProfit = require('../models/DailyProfit');
const DailyLevelRoi = require('../models/DailyLevelRoi');

// @route   GET /api/admin/dashboard-stats
// @desc    Get global stats for admin dashboard
// @access  Private (Admin)
exports.getAdminDashboardStats = async (req, res) => {
    try {
        // 1. Total Network Assets (Sum of all active investments)
        const assets = await Investment.aggregate([
            { $match: { status: 'Active' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalAssets = assets.length > 0 ? assets[0].total : 0;

        // 2. Active Investors (Users with active plans)
        const activeUsersCount = await Investment.distinct('userId', { status: 'Active' });
        const totalActivePlanUsers = activeUsersCount.length;

        // 3. New Users (Today)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const newUsersToday = await User.countDocuments({ createdAt: { $gte: todayStart } });

        // 4. Total Recharges (Approved FundRequests)
        const FundRequest = require('../models/FundRequest');
        const recharges = await FundRequest.aggregate([
            { $match: { status: 'Approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRecharges = recharges.length > 0 ? recharges[0].total : 0;

        // 5. Total Distributed ROI
        const totalRoiDistirbuted = await DailyProfit.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRoi = totalRoiDistirbuted.length > 0 ? totalRoiDistirbuted[0].total : 0;

        // 6. User Stats
        const totalUsers = await User.countDocuments();
        const inactiveUsers = totalUsers - totalActivePlanUsers;

        // 7. Tasks
        const Withdrawal = require('../models/Withdrawal');
        const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'Pending' });
        const pendingFunds = await FundRequest.countDocuments({ status: 'Pending' });

        // 8. Growth
        const monthlyGrowth = await User.aggregate([
            {
                $group: {
                    _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } },
            { $limit: 12 }
        ]);

        res.json({
            totalAssets,
            totalActivePlanUsers,
            newUsersToday,
            totalRecharges,
            totalRoi,
            totalUsers,
            inactiveUsers,
            pendingWithdrawals,
            pendingFunds,
            monthlyGrowth
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
// @route   GET /api/admin/roi-reports
// @desc    Get daily aggregated ROI distribution logs
// @access  Private (Admin)
exports.getRoiDistributionReport = async (req, res) => {
    try {
        // Aggregating Daily Personal Profits by batchId
        const personalRoi = await DailyProfit.aggregate([
            {
                $group: {
                    _id: "$batchId",
                    date: { $first: "$createdAt" },
                    totalAmount: { $sum: "$amount" },
                    userCount: { $count: {} },
                    rate: { $first: "$percentage" }
                }
            },
            { $sort: { date: -1 } }
        ]);

        // Aggregating Daily Level Profits by batchId
        const levelRoi = await DailyLevelRoi.aggregate([
            {
                $group: {
                    _id: "$batchId",
                    totalLevelAmount: { $sum: "$amount" }
                }
            }
        ]);

        // Merge results
        const report = personalRoi.map(p => {
            const level = levelRoi.find(l => l._id === p._id);
            return {
                batchId: p._id,
                date: p.date,
                personalTotal: p.totalAmount,
                levelTotal: level ? level.totalLevelAmount : 0,
                userCount: p.userCount,
                percentage: p.rate
            };
        });

        res.json(report);
    } catch (err) {
        console.error('ROI report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @route   GET /api/admin/network-analysis
// @desc    Get all users with their direct referral stats
// @access  Private (Admin)
exports.getNetworkAnalysis = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        
        const analysis = [];
        for (const u of users) {
             const directs = await User.find({ sponsorId: u._id }).select('username balance isActivated createdAt');
             
             // Get total investment of these directs
             const directIds = directs.map(d => d._id);
             const investments = await Investment.aggregate([
                { $match: { userId: { $in: directIds }, status: 'Active' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
             ]);

             analysis.push({
                id: u._id,
                username: u.username,
                email: u.email,
                balance: u.balance,
                totalEarned: u.totalEarned,
                isActivated: u.isActivated,
                createdAt: u.createdAt,
                directCount: directs.length,
                directs: directs.map(d => ({
                    username: d.username,
                    balance: d.balance,
                    isActivated: d.isActivated,
                    dateJoined: d.createdAt
                })),
                directInvestmentTotal: investments.length > 0 ? investments[0].total : 0
             });
        }

        res.json(analysis);
    } catch (err) {
        console.error('Network analysis error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @route   GET /api/admin/user-matrix/:id
// @desc    Get 20-level matrix summary for a specific user
// @access  Private (Admin)
exports.getUserMatrixAnalysis = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId).select('username');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const matrix = [];
        let currentLevelUsers = [userId];

        for (let level = 1; level <= 20; level++) {
            // Find all users who have anyone in currentLevelUsers as their sponsor
            const downline = await User.find({ sponsorId: { $in: currentLevelUsers } }).select('_id username isActivated');
            if (downline.length === 0) break;

            const downlineIds = downline.map(d => d._id);
            const investments = await Investment.aggregate([
                { $match: { userId: { $in: downlineIds }, status: 'Active' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            matrix.push({
                level: level,
                count: downline.length,
                activatedCount: downline.filter(d => d.isActivated).length,
                investmentTotal: investments.length > 0 ? investments[0].total : 0,
                members: downline.slice(0, 10).map(d => d.username) // Just show first 10 usernames as sample
            });

            // Move to the next level
            currentLevelUsers = downlineIds;
        }

        res.json({
            username: user.username,
            matrix: matrix
        });
    } catch (err) {
        console.error('Matrix analysis error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @route   GET /api/admin/latest-users
// @desc    Get latest 100 users with details
// @access  Private (Admin)
exports.getLatestUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(100);
            
        res.json(users);
    } catch (err) {
        console.error('Latest users error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
