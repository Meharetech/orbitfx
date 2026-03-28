const express = require('express');
const router = express.Router();
const { 
  createWithdrawalRequest, 
  getUserWithdrawalHistory, 
  getAllWithdrawals, 
  reviewWithdrawal 
} = require('../controllers/withdrawalController');
const { protect } = require('../middleware/authMiddleware');

router.post('/request', protect, createWithdrawalRequest);
router.get('/history', protect, getUserWithdrawalHistory);
router.get('/admin', getAllWithdrawals);
router.patch('/:id/review', reviewWithdrawal);

module.exports = router;
