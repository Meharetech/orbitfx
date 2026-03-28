const express = require('express');
const router = express.Router();
const { 
  createFundRequest, 
  getAdminFundRequests, 
  getUserFundHistory, 
  reviewFundRequest 
} = require('../controllers/fundController');
const { protect } = require('../middleware/authMiddleware');

// User Routes
router.post('/request', protect, createFundRequest);
router.get('/history', protect, getUserFundHistory);

// Admin Routes (Protect + Admin Check)
router.get('/admin', getAdminFundRequests);
router.patch('/:id/review', reviewFundRequest);

module.exports = router;
