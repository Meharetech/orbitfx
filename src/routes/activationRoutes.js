const express = require('express');
const router = express.Router();
const { activateAccount, getActivationStatus, getDirectRewardStatus } = require('../controllers/activationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/status', protect, getActivationStatus);
router.post('/activate', protect, activateAccount);
router.get('/reward-status', protect, getDirectRewardStatus);

module.exports = router;
