const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Settings = require('../models/Settings');

// @desc    Create a new withdrawal request
// @route   POST /api/withdrawals/request
// @access  Private
exports.createWithdrawalRequest = async (req, res) => {
    const { amount } = req.body;
    const userId = req.user._id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Get global settings for dynamic fee
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({ withdrawalFee: 10, minWithdrawal: 1 });
        }

        if (amount < settings.minWithdrawal) {
            return res.status(400).json({ message: `Minimum withdrawal is $${settings.minWithdrawal}` });
        }

        if (!user.walletAddress) {
            return res.status(400).json({ message: 'Please setup your withdrawal wallet first' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance for this liquidation' });
        }

        const feeRate = settings.withdrawalFee / 100;
        const serviceFee = (amount * feeRate).toFixed(2); 
        const netAmount = (amount - serviceFee).toFixed(2);

        // Deduct gross amount from balance immediately
        user.balance -= Number(amount);
        await user.save();

        const withdrawal = await Withdrawal.create({
            userId,
            amount: Number(amount),
            serviceFee: Number(serviceFee),
            netAmount: Number(netAmount),
            walletAddress: user.walletAddress,
            walletNetwork: user.walletNetwork,
            status: 'Pending'
        });

        res.status(201).json({ 
            message: 'Liquidation request submitted to the core. Awaiting authorization (ETA: 24h).',
            withdrawal,
            newBalance: user.balance 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during liquidation protocol' });
    }
};

// @desc    Get user's withdrawal history
// @route   GET /api/withdrawals/history
// @access  Private
exports.getUserWithdrawalHistory = async (req, res) => {
    try {
        const history = await Withdrawal.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Admin: Get all withdrawal requests
// @route   GET /api/withdrawals/admin
// @access  Private/Admin
exports.getAllWithdrawals = async (req, res) => {
    try {
        const history = await Withdrawal.find().populate('userId', 'fullName username email phone').sort({ createdAt: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Admin: Review withdrawal request
// @route   PATCH /api/withdrawals/:id/review
// @access  Private/Admin
exports.reviewWithdrawal = async (req, res) => {
    const { status, adminNote } = req.body;
    const { id } = req.params;

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const withdrawal = await Withdrawal.findById(id);
        if (!withdrawal) return res.status(404).json({ message: 'Request not found' });

        if (withdrawal.status !== 'Pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }

        withdrawal.status = status;
        withdrawal.adminNote = adminNote || '';
        withdrawal.updatedAt = Date.now();
        await withdrawal.save();

        // If rejected, refund the original gross amount
        if (status === 'Rejected') {
            const user = await User.findById(withdrawal.userId);
            if (user) {
                user.balance += withdrawal.amount;
                await user.save();
            }
        }

        res.json({ message: `Liquidation protocol ${status.toLowerCase()}` });
    } catch (error) {
        res.status(500).json({ message: 'Server error during validation' });
    }
};
