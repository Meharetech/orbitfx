const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { activateBot, getBotIncomeHistory } = require('../controllers/botController');

// @route   POST /api/bots/activate
// @desc    Purchase AI Bot
// @access  Private
router.post('/activate', protect, activateBot);

// @route   GET /api/bots/income
// @desc    Get Bot Referral Income History
// @access  Private
router.get('/income', protect, getBotIncomeHistory);

module.exports = router;
