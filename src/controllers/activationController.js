const User = require('../models/User');
const Activation = require('../models/Activation');
const DirectReward = require('../models/DirectReward');
const ReferralIncome = require('../models/ReferralIncome');
const { updatePairCountsForAncestors } = require('./pairRewardController');

// ─── Credit $10 to sponsor & log payment ─────────────────────────────────────
const creditDirectRewardInstallment = async (rewardDoc) => {
    if (rewardDoc.isCompleted) return;

    const sponsor = await User.findById(rewardDoc.sponsorId);
    if (!sponsor) return;

    const monthNum = rewardDoc.paidCount + 1;

    // Credit $10
    sponsor.balance    += 10;
    sponsor.totalEarned += 10;
    await sponsor.save();

    // Record payment
    rewardDoc.paidCount += 1;
    rewardDoc.payments.push({ amount: 10, paidAt: new Date(), month: monthNum });

    // Schedule next or mark complete
    if (rewardDoc.paidCount >= rewardDoc.totalPayments) {
        rewardDoc.isCompleted = true;
        rewardDoc.nextPaymentDate = null;
    } else {
        // Next payment: 30 days from today
        const next = new Date();
        next.setDate(next.getDate() + 30);
        rewardDoc.nextPaymentDate = next;
    }

    await rewardDoc.save();
    console.log(`[DirectReward] Paid $10 installment #${monthNum} to ${sponsor.username}`);
};

// ─── Main: Activate Account ──────────────────────────────────────────────────
const activateAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.isActivated) {
            return res.status(400).json({ message: 'Account is already activated' });
        }

        const ACTIVATION_COST = 150;
        if (user.balance < ACTIVATION_COST) {
            return res.status(400).json({ message: 'Insufficient balance ($150 required)' });
        }

        // Deduct balance & activate
        user.balance -= ACTIVATION_COST;
        const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
        user.isActivated     = true;
        user.activationDate  = new Date();
        user.activationExpiry = new Date(Date.now() + ONE_YEAR);
        await user.save();

        // 🎉 NEW: Update Pair Counts for ALL ancestors in the binary tree
        await updatePairCountsForAncestors(user);

        // 🚀 NEW: Distribute 35% Referral Income (20 Levels)
        await distributeActivationCommission(user, ACTIVATION_COST);

        // Log activation record
        await Activation.create({
            userId:     user._id,
            amount:     ACTIVATION_COST,
            expiryDate: user.activationExpiry
        });

        // ── Direct Referral Reward Logic ──────────────────────────────
        if (user.sponsorId) {
            const sponsor = await User.findById(user.sponsorId);
            if (sponsor && !sponsor.qualifiedForDirectReward) {

                const joinDate          = new Date(sponsor.createdAt);
                const fifteenDaysInMs   = 15 * 24 * 60 * 60 * 1000;
                const withinWindow      = (Date.now() - joinDate.getTime()) <= fifteenDaysInMs;

                if (withinWindow) {
                    // Check if this user is L or R direct child of sponsor
                    if (user.position === 'L') sponsor.firstLeftActivated  = true;
                    if (user.position === 'R') sponsor.firstRightActivated = true;

                    // BOTH sides now active → QUALIFY IMMEDIATELY
                    if (sponsor.firstLeftActivated && sponsor.firstRightActivated) {
                        sponsor.qualifiedForDirectReward = true;
                        await sponsor.save();

                        // 🎉 Credit FIRST $10 TODAY (same day as qualification)
                        const nextPayment = new Date();
                        nextPayment.setDate(nextPayment.getDate() + 30); // 2nd payment in 30 days

                        const rewardDoc = await DirectReward.create({
                            sponsorId:       sponsor._id,
                            qualifiedDate:   new Date(),
                            nextPaymentDate: nextPayment,
                            paidCount:       0,
                        });

                        // Credit installment #1 immediately
                        await creditDirectRewardInstallment(rewardDoc);

                        console.log(`[DirectReward] Sponsor ${sponsor.username} qualified! First $10 credited immediately.`);
                    } else {
                        await sponsor.save();
                    }
                }
            }
        }

        res.json({
            message: 'Account activated successfully for 1 year',
            user: {
                isActivated:      user.isActivated,
                balance:          user.balance,
                activationExpiry: user.activationExpiry
            }
        });

    } catch (err) {
        console.error('Activation error:', err);
        res.status(500).json({ message: 'Server error during activation' });
    }
};

// ─── Get Activation Status ───────────────────────────────────────────────────
const getActivationStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('isActivated activationDate activationExpiry qualifiedForDirectReward firstLeftActivated firstRightActivated balance');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching activation status' });
    }
};

// ─── Get Direct Reward Status (for dashboard) ────────────────────────────────
const getDirectRewardStatus = async (req, res) => {
    try {
        const reward = await DirectReward.findOne({ sponsorId: req.user.id }).sort({ createdAt: -1 });
        res.json(reward || null);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching reward status' });
    }
};

const distributeActivationCommission = async (purchaser, amount) => {
    const mongoose = require('mongoose');
    // 20-Level Commission Rules (Total 35%)
    const levelCommissions = {
        1: 0.10, 2: 0.05, 3: 0.05, 4: 0.03, 5: 0.02,
    };

    let currentSponsorId = purchaser.sponsorId;
    let level = 1;

    console.log(`[ActivationRef] Starting 35% Distribution for ${purchaser.username} ($${amount})`);

    while (currentSponsorId && level <= 20) {
        try {
            if (!mongoose.Types.ObjectId.isValid(currentSponsorId)) break;

            const sponsor = await User.findById(currentSponsorId);
            if (!sponsor) break;

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
                const commission = amount * rate;
                
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
                    incomeType: 'Account Activation'
                });
                console.log(`[ActivationRef] L${level} -> ${sponsor.username} | Amt: $${commission.toFixed(2)} (${(rate*100).toFixed(1)}%)`);
            }

            // Move to next sponsor (Upline)
            currentSponsorId = sponsor.sponsorId;
            level++;
        } catch (lvlErr) {
            console.error(`[ActivationRef] Error at Level ${level}:`, lvlErr.message);
            break;
        }
    }
    console.log(`[ActivationRef] Distribution Finished for ${purchaser.username}`);
};

module.exports = { activateAccount, getActivationStatus, getDirectRewardStatus, creditDirectRewardInstallment };
