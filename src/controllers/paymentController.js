const PaymentMethod = require('../models/PaymentMethod');

// @desc    Get all active payment methods (User-facing)
// @route   GET /api/payments/public
// @access  Public (Used by users to see where to pay)
exports.getPublicPaymentMethods = async (req, res) => {
    try {
        const methods = await PaymentMethod.find({ isActive: true });
        res.json(methods);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching payments' });
    }
};

// @desc    Get all payment methods (Admin-facing)
// @route   GET /api/payments/admin
// @access  Private/Admin
exports.getAdminPaymentMethods = async (req, res) => {
    try {
        const methods = await PaymentMethod.find({});
        res.json(methods);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Add new payment method
// @route   POST /api/payments
// @access  Private/Admin
exports.addPaymentMethod = async (req, res) => {
    try {
        const { name, walletAddress, qrCode, network } = req.body;
        
        if (!name || !walletAddress || !qrCode) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const method = await PaymentMethod.create({
            name,
            walletAddress,
            qrCode,
            network
        });

        res.status(201).json(method);
    } catch (err) {
        res.status(500).json({ message: 'Error saving payment method' });
    }
};

// @desc    Delete payment method
// @route   DELETE /api/payments/:id
// @access  Private/Admin
exports.deletePaymentMethod = async (req, res) => {
    try {
        const method = await PaymentMethod.findById(req.params.id);
        if (!method) {
            return res.status(404).json({ message: 'Payment method not found' });
        }
        await method.deleteOne();
        res.json({ message: 'Payment method removed' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting method' });
    }
};

// @desc    Toggle status
// @route   PATCH /api/payments/:id/toggle
// @access  Private/Admin
exports.togglePaymentStatus = async (req, res) => {
    try {
        const method = await PaymentMethod.findById(req.params.id);
        if (!method) {
            return res.status(404).json({ message: 'Payment method not found' });
        }
        method.isActive = !method.isActive;
        await method.save();
        res.json(method);
    } catch (err) {
        res.status(500).json({ message: 'Error updating status' });
    }
};
// @desc    Update payment method
// @route   PUT /api/payments/:id
// @access  Private/Admin
exports.updatePaymentMethod = async (req, res) => {
    try {
        const { name, walletAddress, qrCode, network } = req.body;
        const method = await PaymentMethod.findById(req.params.id);
        
        if (!method) {
            return res.status(404).json({ message: 'Payment method not found' });
        }

        method.name = name || method.name;
        method.walletAddress = walletAddress || method.walletAddress;
        method.qrCode = qrCode || method.qrCode;
        method.network = network || method.network;

        await method.save();
        res.json(method);
    } catch (err) {
        res.status(500).json({ message: 'Error updating payment method' });
    }
};
