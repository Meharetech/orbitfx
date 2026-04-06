const User = require('../models/User');
const Investment = require('../models/Investment');
const BotActivation = require('../models/BotActivation');
const DailyProfit = require('../models/DailyProfit');
const DailyLevelRoi = require('../models/DailyLevelRoi');
const InvestmentWithdrawal = require('../models/InvestmentWithdrawal');
const AdminAdjustment = require('../models/AdminAdjustment');

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
             
             // Get detailed stats for each direct
             const directDetails = [];
             for (const d of directs) {
                const dInvs = await Investment.aggregate([
                    { $match: { userId: d._id, status: 'Active' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]);
                directDetails.push({
                    id: d._id,
                    username: d.username,
                    balance: d.balance,
                    isActivated: d.isActivated,
                    dateJoined: d.createdAt,
                    totalInvestedAmount: dInvs.length > 0 ? dInvs[0].total : 0
                });
             }
             
             // Get collective investment of these directs
             const collectiveTotal = directDetails.reduce((sum, d) => sum + d.totalInvestedAmount, 0);

             analysis.push({
                id: u._id,
                username: u.username,
                email: u.email,
                balance: u.balance,
                totalEarned: u.totalEarned,
                isActivated: u.isActivated,
                createdAt: u.createdAt,
                directCount: directs.length,
                directs: directDetails,
                directInvestmentTotal: collectiveTotal
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
// @desc    Get latest 100 users with aggregated investment stats
// @access  Private (Admin)
exports.getLatestUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(100);
            
        const detailedUsers = [];
        for (const user of users) {
            const activeInvestments = await Investment.find({ userId: user._id, status: 'Active' });
            const totalInvested = activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);
            
            detailedUsers.push({
                ...user.toObject(),
                activeInvestmentCount: activeInvestments.length,
                totalInvestedAmount: totalInvested
            });
        }
            
        res.json(detailedUsers);
    } catch (err) {
        console.error('Latest users error:', err);
        res.status(500).json({ message: 'Server error fetching registry.' });
    }
};

// @route   POST /api/admin/users/:id/toggle-status
// @desc    Enable or Disable user account nodes
// @access  Private (Admin)
exports.toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.isActive = !user.isActive;
        await user.save();

        res.json({ message: `User account ${user.isActive ? 'enabled' : 'disabled'} successfully.`, isActive: user.isActive });
    } catch (err) {
        console.error('Toggle status error:', err);
        res.status(500).json({ message: 'Server error updating user status.' });
    }
};

// @route   POST /api/admin/users/:id/adjust-balance
// @desc    Manually withdraw or deposit funds (Wallet or Investment)
// @access  Private (Admin)
exports.manualBalanceAdjustment = async (req, res) => {
    try {
        const { amount, type, target, note } = req.body; // target: 'Wallet' or 'Investment'
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const adjustmentAmount = Number(amount);
        let previousVal = target === 'Wallet' ? user.balance : 0; // Simplified for investment
        let newVal = 0;

        if (target === 'Wallet') {
            if (type === 'Withdraw') {
                user.balance -= adjustmentAmount;
            } else {
                user.balance += adjustmentAmount;
                user.totalEarned += adjustmentAmount;
            }
            newVal = user.balance;
            await user.save();
        } else {
            // Target: Investment Portfolio
            if (type === 'Withdraw') {
                // Find active investments to reduce
                let remainingToDeduct = adjustmentAmount;
                const activeInvs = await Investment.find({ userId: user._id, status: 'Active' }).sort({ createdAt: -1 });

                for (const inv of activeInvs) {
                    if (remainingToDeduct <= 0) break;
                    if (inv.amount > remainingToDeduct) {
                        inv.amount -= remainingToDeduct;
                        remainingToDeduct = 0;
                        await inv.save();
                    } else {
                        remainingToDeduct -= inv.amount;
                        inv.amount = 0;
                        inv.status = 'Completed';
                        await inv.save();
                    }
                }
            } else {
                // Admin Deposit into Investment (Create new investment node)
                const newInv = new Investment({
                    userId: user._id,
                    amount: adjustmentAmount,
                    status: 'Active',
                    adminNote: note || 'Administrative System Activation'
                });
                await newInv.save();
            }
            newVal = adjustmentAmount; // Log the change amount as the "new" value for investment nodes
        }

        // Save History
        const log = new AdminAdjustment({
            userId: user._id,
            amount: adjustmentAmount,
            type,
            target,
            note,
            previousBalance: previousVal,
            newBalance: newVal
        });
        await log.save();

        res.json({ message: `${target} ${type.toLowerCase()}ed successfully.`, newBalance: newVal });
    } catch (err) {
        console.error('Balance adjustment error:', err);
        res.status(500).json({ message: 'Server error adjusting funds.' });
    }
};

// @route   GET /api/admin/adjustments
// @desc    Get all administrative adjustment records (History)
// @access  Private (Admin)
exports.getAdjustmentHistory = async (req, res) => {
    try {
        const history = await AdminAdjustment.find()
            .populate('userId', 'username email')
            .sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        console.error('Adjustment history error:', err);
        res.status(500).json({ message: 'Server error fetching audit history.' });
    }
};
// @route   GET /api/admin/investment-withdrawals
// @desc    Get all investment withdrawal requests
// @access  Private (Admin)
exports.getInvestmentWithdrawals = async (req, res) => {
    try {
        const requests = await InvestmentWithdrawal.find()
            .populate('userId', 'username fullName balance')
            .populate('investmentId', 'amount createdAt status')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (err) {
        console.error('Get admin investment withdrawals error:', err);
        res.status(500).json({ message: 'Server error fetching liquidation requests.' });
    }
};

// @route   POST /api/admin/investment-withdrawals/process
// @desc    Approve or Reject an investment withdrawal
// @access  Private (Admin)
exports.processInvestmentWithdrawal = async (req, res) => {
    try {
        const { requestId, status, adminNote } = req.body;

        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status update.' });
        }

        const request = await InvestmentWithdrawal.findById(requestId);
        if (!request) return res.status(404).json({ message: 'Request not found.' });
        if (request.status !== 'Pending') return res.status(400).json({ message: 'Request already processed.' });

        const investment = await Investment.findById(request.investmentId);
        
        if (status === 'Approved') {
            if (!investment) return res.status(404).json({ message: 'Original investment not found.' });
            
            const user = await User.findById(request.userId);
            if (!user) return res.status(404).json({ message: 'User not found.' });

            // 1. Credit User Balance
            user.balance += request.amount;
            await user.save();

            // 2. Mark Investment as Completed
            investment.status = 'Completed';
            await investment.save();
        } else if (status === 'Rejected' && req.body.forceTerminate) {
            // "Remove funds" logic — close the investment without crediting user balance
            if (investment) {
                investment.status = 'Completed';
                await investment.save();
            }
        }

        if (investment) {
            investment.adminNote = adminNote || 'Administrative decision rendered.';
            await investment.save();
        }

        request.status = status;
        request.adminNote = adminNote || 'Administrative decision rendered.';
        await request.save();

        res.json({ message: `Investment withdrawal ${status.toLowerCase()} successfully.`, request });
    } catch (err) {
        console.error('Process investment withdrawal error:', err);
        res.status(500).json({ message: 'Server error processing liquidation.' });
    }
};

module.exports = exports;
