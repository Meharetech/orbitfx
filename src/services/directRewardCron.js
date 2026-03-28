const DirectReward = require('../models/DirectReward');
const PairReward = require('../models/PairReward');
const { creditDirectRewardInstallment } = require('../controllers/activationController');
const { creditPairRewardInstallment } = require('../controllers/pairRewardController');

/**
 * Runs every day at midnight.
 * Finds all active rewards whose nextPaymentDate has passed
 * and credits the installment to the user's balance.
 */
const processAllMonthlyRewards = async () => {
    try {
        const now = new Date();
        
        // ── 1. Direct Referral Rewards ($10/mo) ──
        const dueDirect = await DirectReward.find({
            isCompleted:     false,
            nextPaymentDate: { $lte: now }
        });

        if (dueDirect.length > 0) {
            console.log(`[Cron] Processing ${dueDirect.length} direct reward payment(s)...`);
            for (const reward of dueDirect) {
                await creditDirectRewardInstallment(reward);
            }
        }

        // ── 2. Pair Matching Monthly Rewards ($30-$100k/mo) ──
        const duePairs = await PairReward.find({
            isRewarded:      true,
            isCompleted:     false,
            nextPaymentDate: { $lte: now }
        });

        if (duePairs.length > 0) {
            console.log(`[Cron] Processing ${duePairs.length} pair reward payment(s)...`);
            for (const reward of duePairs) {
                // Find the rank plan to get the correct amount for current rank
                const rankPlan = PairReward.RANK_PLANS.find(p => p.rank === reward.currentRank);
                if (rankPlan) {
                    await creditPairRewardInstallment(reward, rankPlan.monthlyReward, rankPlan.rank);
                }
            }
        }

        console.log('[Cron] All rewards checked for today.');
    } catch (err) {
        console.error('[Cron] Error processing monthly rewards:', err);
    }
};

module.exports = { processAllMonthlyRewards };
