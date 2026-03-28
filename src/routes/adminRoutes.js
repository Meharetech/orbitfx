const express = require('express');
const router = express.Router();
const { protect, adminProtect } = require('../middleware/authMiddleware');
const { getAdminDashboardStats, getRoiDistributionReport, getNetworkAnalysis, getUserMatrixAnalysis, getLatestUsers } = require('../controllers/adminController');

// @route   GET /api/admin/dashboard-stats
// @desc    Get global stats for admin dashboard
// @access  Private (Admin)
router.get('/dashboard-stats', adminProtect, getAdminDashboardStats);

// @route   GET /api/admin/roi-reports
// @desc    Get daily ROI reports
// @access  Private (Admin)
router.get('/roi-reports', adminProtect, getRoiDistributionReport);

// @route   GET /api/admin/network-analysis
// @desc    Get network referral analytics
// @access  Private (Admin)
router.get('/network-analysis', adminProtect, getNetworkAnalysis);

// @route   GET /api/admin/user-matrix/:id
// @desc    Get 20-level matrix summary
// @access  Private (Admin)
router.get('/user-matrix/:id', adminProtect, getUserMatrixAnalysis);

// @route   GET /api/admin/latest-users
// @desc    Get latest 100 users
// @access  Private (Admin)
router.get('/latest-users', adminProtect, getLatestUsers);

module.exports = router;
