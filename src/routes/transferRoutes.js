const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { transferFunds, getTransferHistory } = require('../controllers/transferController');

router.post('/', protect, transferFunds);
router.get('/history', protect, getTransferHistory);

module.exports = router;
