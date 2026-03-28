const FundRequest = require('../models/FundRequest');
const User = require('../models/User');

// @desc    Create new fund request (User)
// @route   POST /api/funds/request
// @access  Private
exports.createFundRequest = async (req, res) => {
    try {
        const { amount, paymentMethod, transactionId, screenshot } = req.body;
        
        if (!amount || !paymentMethod || !transactionId || !screenshot) {
            return res.status(400).json({ message: 'Please provide all required transaction details' });
        }

        const fundRequest = await FundRequest.create({
            user: req.user._id,
            amount,
            paymentMethod,
            transactionId,
            screenshot
        });

        res.status(201).json({
            message: 'Fund request submitted successfully for verification',
            fundRequest
        });
    } catch (err) {
        res.status(500).json({ message: 'Error submitting fund request' });
    }
};

// @desc    Get all fund requests (Admin)
// @route   GET /api/funds/admin
// @access  Private (Admin Role would ideally be checked here)
exports.getAdminFundRequests = async (req, res) => {
    try {
        const requests = await FundRequest.find({})
            .populate('user', 'fullName username email phone referralCode')
            .populate('paymentMethod', 'name network walletAddress')
            .sort('-createdAt');
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching fund requests' });
    }
};

// @desc    Get user fund history (User)
// @route   GET /api/funds/history
// @access  Private
exports.getUserFundHistory = async (req, res) => {
    try {
        const requests = await FundRequest.find({ user: req.user._id })
            .populate('paymentMethod', 'name')
            .sort('-createdAt');
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching history' });
    }
};

// @desc    Approve/Reject Fund Request (Admin)
// @route   PATCH /api/funds/:id/review
// @access  Private
exports.reviewFundRequest = async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        const request = await FundRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.status !== 'Pending') {
            return res.status(400).json({ message: 'This request has already been processed' });
        }

        request.status = status;
        request.adminNote = adminNote;

        if (status === 'Approved') {
            const user = await User.findById(request.user);
            user.balance += Number(request.amount);
            await user.save();
        }

        await request.save();
        res.json({ message: `Fund request ${status.toLowerCase()} successfully`, request });
    } catch (err) {
        res.status(500).json({ message: 'Error processing request' });
    }
};
