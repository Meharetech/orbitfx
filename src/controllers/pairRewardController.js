const User = require('../models/User');
const PairReward = require('../models/PairReward');

const RANK_PLANS = PairReward.schema.statics.RANK_PLANS;

/**
 * Walks up the ancestor chain from `newMember` and increments
 * leftTeamCount or rightTeamCount for every ancestor depending
 * on which leg the new member falls under.
 * Then checks if the ancestor has earned a new rank.
 */
const updatePairCountsForAncestors = async (activatingUser) => {
    try {
        let currentChild = activatingUser;
        let currentParentId = activatingUser.parentId;

        while (currentParentId) {
            const parent = await User.findById(currentParentId);
            if (!parent) break;

            // Determine which leg the activatingUser falls into for this parent
            // by checking if the path came through the parent's leftChild or rightChild
            if (parent.leftChild && parent.leftChild.toString() === currentChild._id.toString()) {
                parent.leftTeamCount = (parent.leftTeamCount || 0) + 1;
            } else if (parent.rightChild && parent.rightChild.toString() === currentChild._id.toString()) {
                parent.rightTeamCount = (parent.rightTeamCount || 0) + 1;
            } else {
                // This shouldn't happen in a perfect tree, but as a fallback/safety:
                // If we are walking up but the relationship is broken, we stop.
                break;
            }

            // Recalculate pairs = min(left, right)
            parent.totalPairs = Math.min(parent.leftTeamCount, parent.rightTeamCount);

            // Get rank for the new pair count
            const rankPlan = PairReward.getRankForPairs(parent.totalPairs);
            
            if (rankPlan) {
                // Check if user reached a NEW rank (not already achieved)
                // We compare with parent.currentRank. 
                // Rank order is important here.
                const rankOrder = RANK_PLANS.map(p => p.rank);
                const currentRankIdx = parent.currentRank ? rankOrder.indexOf(parent.currentRank) : -1;
                const newRankIdx = rankOrder.indexOf(rankPlan.rank);

                if (newRankIdx > currentRankIdx) {
                    parent.currentRank = rankPlan.rank;
                    await parent.save();
                    await handleRankUpgrade(parent, rankPlan);
                } else {
                    await parent.save();
                }
            } else {
                await parent.save();
            }

            // Move up the tree
            currentChild = parent;
            currentParentId = parent.parentId;
        }
    } catch (err) {
        console.error('[PairReward] updatePairCounts error:', err);
    }
};

/**
 * When a user achieves a new rank, upsert their PairReward record
 * and credit the first monthly payment immediately.
 */
const handleRankUpgrade = async (user, rankPlan) => {
    try {
        let rewardDoc = await PairReward.findOne({ userId: user._id });

        const nextPayment = new Date();
        nextPayment.setDate(nextPayment.getDate() + 30);

        if (!rewardDoc) {
            rewardDoc = await PairReward.create({
                userId:          user._id,
                currentRank:     rankPlan.rank,
                totalPairs:      user.totalPairs,
                leftCount:       user.leftTeamCount,
                rightCount:      user.rightTeamCount,
                isRewarded:      true,
                rewardStartDate: new Date(),
                nextPaymentDate: nextPayment,
                paidCount:       0,
            });
        } else {
            // Rank upgraded — reset payment cycle for THE NEW higher rank
            rewardDoc.currentRank     = rankPlan.rank;
            rewardDoc.totalPairs      = user.totalPairs;
            rewardDoc.isRewarded      = true;
            rewardDoc.nextPaymentDate = nextPayment;
            rewardDoc.isCompleted     = false;
            rewardDoc.paidCount       = 0;
            await rewardDoc.save();
        }

        // --- NEW LOGIC: CREDIT ONE-TIME REWARD ---
        // Check for skipped ranks or ensure current rank reward is paid
        const allRanks = RANK_PLANS;
        const currentRankIdx = allRanks.findIndex(p => p.rank === rankPlan.rank);
        
        for (let i = 0; i <= currentRankIdx; i++) {
            const plan = allRanks[i];
            if (!rewardDoc.claimedOneTimeRewards.includes(plan.rank)) {
                console.log(`[PairReward] Awarding one-time prize for ${plan.rank} ($${plan.oneTimeReward}) to ${user.username}`);
                await creditOneTimeRankReward(rewardDoc, plan.oneTimeReward, plan.rank);
            }
        }

        // Credit first payment of the NEW RANK immediately
        await creditPairRewardInstallment(rewardDoc, rankPlan.monthlyReward, rankPlan.rank);
    } catch (err) {
        console.error('[PairReward] handleRankUpgrade error:', err);
    }
};

/**
 * Helper: Credit the One-Time Rank Achievement Prize
 */
const creditOneTimeRankReward = async (rewardDoc, amount, rank) => {
    try {
        const user = await User.findById(rewardDoc.userId);
        if (!user) return;

        // 1. Update User Balance
        user.balance += amount;
        user.totalEarned += amount;
        await user.save();

        // 2. Track as claimed
        rewardDoc.claimedOneTimeRewards.push(rank);
        
        // 3. Optional: Add to payments history or a special one-time logs
        // Using existing payments array but identifying as one-time
        if (!rewardDoc.payments) rewardDoc.payments = [];
        rewardDoc.payments.push({ 
            rank, 
            amount, 
            paidAt: new Date(), 
            month: 0 // Using 0 to denote One-Time / Non-Installment
        });

        await rewardDoc.save();
    } catch (err) {
        console.error('[PairReward] creditOneTimeRankReward error:', err);
    }
};

/**
 * Credit one monthly installment ($amount) to the user.
 */
const creditPairRewardInstallment = async (rewardDoc, amount, rank) => {
    try {
        const user = await User.findById(rewardDoc.userId);
        if (!user) return;

        user.balance    += amount;
        user.totalEarned += amount;
        await user.save();

        const monthNum = rewardDoc.paidCount + 1;
        rewardDoc.paidCount += 1;
        
        if (!rewardDoc.payments) rewardDoc.payments = [];
        rewardDoc.payments.push({ rank, amount, paidAt: new Date(), month: monthNum });

        if (rewardDoc.paidCount >= 12) {
            rewardDoc.isCompleted     = true;
            rewardDoc.nextPaymentDate = null;
        } else {
            const next = new Date();
            next.setDate(next.getDate() + 30);
            rewardDoc.nextPaymentDate = next;
        }

        await rewardDoc.save();
        console.log(`[PairReward] Paid $${amount} (${rank}) installment #${monthNum} to ${user.username}`);
    } catch (err) {
        console.error('[PairReward] creditInstallment error:', err);
    }
};

module.exports = { updatePairCountsForAncestors, creditPairRewardInstallment };
