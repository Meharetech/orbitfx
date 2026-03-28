const User = require('../models/User');
const BotActivation = require('../models/BotActivation');
const ReferralIncome = require('../models/ReferralIncome');

// @route   POST /api/bots/activate
// @desc    Purchase AI Bot and distribute 35% commission through 20 levels
// @access  Private
exports.activateBot = async (req, res) => {
    try {
        const { botPrice } = req.body; // e.g., $100
        const user = await User.findById(req.user._id);

        if (!user) return res.status(404).json({ message: 'User not found' });

        // 🛑 Requirement: Wallet Balance check
        if (user.balance < botPrice) {
            return res.status(400).json({ message: 'Insufficient balance for AI Bot activation' });
        }

        // ✅ Deduct Balance and Record Purchase
        user.balance -= botPrice;
        await user.save();

        const activation = await BotActivation.create({
            userId: user._id,
            botPrice: botPrice
        });

        // 🚀 Distribute 35% Referral Income (20 Levels)
        await distributeBotCommission(user, botPrice);

        res.status(201).json({ 
            message: 'AI Bot Activated Successfully!',
            botPrice,
            newBalance: user.balance 
        });

    } catch (err) {
        console.error('Bot activation error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

const distributeBotCommission = async (purchaser, botPrice) => {
    const mongoose = require('mongoose');
    // 20-Level Commission Rules (Total 35%)
    const levelCommissions = {
        1: 0.10, 2: 0.05, 3: 0.05, 4: 0.03, 5: 0.02,
    };

    let currentSponsorId = purchaser.sponsorId;
    let level = 1;

    console.log(`[BotRef] Starting 35% Distribution for ${purchaser.username} ($${botPrice})`);

    while (currentSponsorId && level <= 20) {
        try {
            // Validate if sponsorId is a valid MongoDB ID
            if (!mongoose.Types.ObjectId.isValid(currentSponsorId)) {
                console.log(`[BotRef] Invalid SponsorId: ${currentSponsorId}. Stopping.`);
                break;
            }

            const sponsor = await User.findById(currentSponsorId);
            if (!sponsor) {
                console.log(`[BotRef] Sponsor ${currentSponsorId} NOT FOUND at Level ${level}. Breaking.`);
                break;
            }

            // Determine rate
            let rate = 0;
            if (levelCommissions[level]) {
                rate = levelCommissions[level];
            } else if (level >= 6 && level <= 10) {
                rate = 0.01; // 1%
            } else if (level >= 11 && level <= 20) {
                rate = 0.005; // 0.5%
            }

            if (rate > 0) {
                const commission = botPrice * rate;
                console.log(`[BotRef] L${level} -> ${sponsor.username} | Amt: $${commission.toFixed(2)} (${(rate*100).toFixed(1)}%)`);
                
                // Credit to sponsor wallet
                sponsor.balance += commission;
                sponsor.totalEarned += commission;
                await sponsor.save();

                // Log Referral Income record
                await ReferralIncome.create({
                    userId: sponsor._id,
                    fromUserId: purchaser._id,
                    amount: commission,
                    level: level,
                    incomeType: 'AI Bot Referral'
                });
            }

            // Move to next sponsor (Upline)
            currentSponsorId = sponsor.sponsorId;
            level++;
        } catch (lvlErr) {
            console.error(`[BotRef] Error at Level ${level}:`, lvlErr.message);
            break;
        }
    }
    console.log(`[BotRef] Distribution Finished for ${purchaser.username}`);
};

// @route   GET /api/reports/referral-income
// @desc    Get referral income history
// @access  Private
exports.getBotIncomeHistory = async (req, res) => {
    try {
        const history = await ReferralIncome.find({ userId: req.user._id })
            .populate('fromUserId', 'username fullName')
            .sort({ createdAt: -1 });
        
        res.json(history);
    } catch (err) {
        console.error('Get history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
