const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', getSettings);
router.put('/update', updateSettings);

module.exports = router;
