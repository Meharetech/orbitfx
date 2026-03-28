const User = require('../models/User');
const Investment = require('../models/Investment');

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
