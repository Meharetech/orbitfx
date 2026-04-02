const User = require('../models/User');
const Investment = require('../models/Investment');
const InvestmentWithdrawal = require('../models/InvestmentWithdrawal');

// @route   POST /api/investments/purchase
// @desc    Purchase a portfolio investment (must be activated first)
// @access  Private
exports.purchaseInvestment = async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 🛑 REQUIREMENT 1: Node Activation Must be Active
        if (!user.isActivated) {
            return res.status(403).json({ 
                message: 'Node Activation Required', 
                code: 'ACTIVATION_REQUIRED' 
            });
        }

        // 🛑 Minimum Investment Check (Example: $50)
        const minInvestment = 50;
        if (amount < minInvestment) {
            return res.status(400).json({ message: `Minimum investment is $${minInvestment}` });
        }

        // 🛑 Wallet Balance Check
        if (user.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // ✅ Deduct Balance and Create Investment
        user.balance -= amount;
        await user.save();

        const investment = await Investment.create({
            userId: user._id,
            amount: amount,
            status: 'Active'
        });

        res.status(201).json({ 
            message: 'Portfolio investment successful!',
            investment,
            newBalance: user.balance
        });

    } catch (err) {
        console.error('Purchase investment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @route   GET /api/investments/history
// @desc    Get investment history for logged-in user
// @access  Private
exports.getInvestmentHistory = async (req, res) => {
    try {
        const investments = await Investment.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.json(investments);
    } catch (err) {
        console.error('Get history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
// @route   POST /api/investments/withdraw
// @desc    Request withdrawal of principal investment capital
// @access  Private
exports.requestInvestmentWithdrawal = async (req, res) => {
    try {
        const { investmentId } = req.body;
        const userId = req.user._id;

        const investment = await Investment.findOne({ _id: investmentId, userId });
        if (!investment) return res.status(404).json({ message: 'Investment not found.' });
        if (investment.status !== 'Active') return res.status(400).json({ message: 'Only active investments can be withdrawn.' });

        // Check for existing pending request
        const existingRequest = await InvestmentWithdrawal.findOne({ investmentId, status: 'Pending' });
        if (existingRequest) return res.status(400).json({ message: 'A withdrawal request is already pending for this investment.' });

        const withdrawalRequest = await InvestmentWithdrawal.create({
            userId,
            investmentId,
            amount: investment.amount
        });

        res.json({ message: 'Capital withdrawal request submitted successfully.', request: withdrawalRequest });
    } catch (err) {
        console.error('Request investment withdrawal error:', err);
        res.status(500).json({ message: 'Server error during liquidation request.' });
    }
};

module.exports = exports;
