const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    purchaseInvestment, 
    getInvestmentHistory,
    requestInvestmentWithdrawal
} = require('../controllers/investmentController');

// @route   POST /api/investments/purchase
// @desc    Purchase a portfolio investment
// @access  Private
router.post('/purchase', protect, purchaseInvestment);

// @route   GET /api/investments/history
// @desc    Get investment history
// @access  Private
router.get('/history', protect, getInvestmentHistory);

// @route   POST /api/investments/withdraw
// @desc    Request withdrawal of principal investment capital
// @access  Private
router.post('/withdraw', protect, requestInvestmentWithdrawal);

module.exports = router;
