const User = require('../models/User');
const Activation = require('../models/Activation');
const DirectReward = require('../models/DirectReward');
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
        // This calculates left/right team counts and checks for rank upgrades ($30-$100k)
        await updatePairCountsForAncestors(user);

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
                    if (sponsor.leftChild?.toString()  === user._id.toString()) sponsor.firstLeftActivated  = true;
                    if (sponsor.rightChild?.toString() === user._id.toString()) sponsor.firstRightActivated = true;

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

module.exports = { activateAccount, getActivationStatus, getDirectRewardStatus, creditDirectRewardInstallment };
