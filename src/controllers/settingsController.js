const Settings = require('../models/Settings');

// @desc    Get global settings
// @route   GET /api/settings
// @access  Public (or semi-private, used by users to see fees and admin to edit)
exports.getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({ withdrawalFee: 10, minWithdrawal: 1 });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching settings' });
    }
};

// @desc    Update global settings
// @route   PUT /api/settings/update
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
    const { withdrawalFee, minWithdrawal } = req.body;

    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }

        if (withdrawalFee !== undefined) settings.withdrawalFee = Number(withdrawalFee);
        if (minWithdrawal !== undefined) settings.minWithdrawal = Number(minWithdrawal);
        
        settings.updatedAt = Date.now();
        await settings.save();

        res.json({ message: 'System protocols updated successfully', settings });
    } catch (error) {
        res.status(500).json({ message: 'Server error during protocol update' });
    }
};
