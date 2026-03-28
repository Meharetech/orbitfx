const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, getSponsorName, updatePassword, lookupUser, updateWallet } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.get('/sponsor/:code', getSponsorName);
router.get('/lookup/:username', protect, lookupUser);
router.put('/updatepassword', protect, updatePassword);
router.put('/updatewallet', protect, updateWallet);

module.exports = router;
