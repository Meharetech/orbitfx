const express = require('express');
const router = express.Router();
const { 
    getDirectTeam, 
    getLeftTeam, 
    getRightTeam, 
    getLevelTeam, 
    getTreeView 
} = require('../controllers/networkController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All network routes are protected

router.get('/direct', getDirectTeam);
router.get('/left', getLeftTeam);
router.get('/right', getRightTeam);
router.get('/levels', getLevelTeam);
router.get('/tree', getTreeView);

module.exports = router;
