const User = require('../models/User');

// @desc    Get Direct Referrals
// @route   GET /api/network/direct
// @access  Private
exports.getDirectTeam = async (req, res) => {
    try {
        const directs = await User.find({ sponsorId: req.user._id }).select('fullName username email referralCode position isActivated activationDate activationExpiry createdAt balance');
        res.json(directs);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Helper function to get all descendants in a specific side
const getSubtree = async (rootId) => {
    let results = [];
    let queue = [rootId];
    
    while(queue.length > 0) {
        let currentId = queue.shift();
        let children = await User.find({ parentId: currentId }).select('fullName username email referralCode position isActivated activationDate activationExpiry createdAt balance parentId');
        for(let child of children) {
            results.push(child);
            queue.push(child._id);
        }
    }
    return results;
};

// @desc    Get Left Team
// @route   GET /api/network/left
// @access  Private
exports.getLeftTeam = async (req, res) => {
    try {
        if (!req.user.leftChild) return res.json([]);
        const team = await getSubtree(req.user.leftChild);
        // Add the direct left child itself
        const directLeft = await User.findById(req.user.leftChild).select('-password');
        res.json([directLeft, ...team]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Right Team
// @route   GET /api/network/right
// @access  Private
exports.getRightTeam = async (req, res) => {
    try {
        if (!req.user.rightChild) return res.json([]);
        const team = await getSubtree(req.user.rightChild);
        // Add the direct right child itself
        const directRight = await User.findById(req.user.rightChild).select('-password');
        res.json([directRight, ...team]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Team by Level
// @route   GET /api/network/levels
// @access  Private
exports.getLevelTeam = async (req, res) => {
    try {
        let levels = {};
        let queue = [{ id: req.user._id, level: 0 }];
        
        while(queue.length > 0) {
            let { id, level } = queue.shift();
            
            if(level > 0) {
                if(!levels[level]) levels[level] = [];
                const userData = await User.findById(id).select('username fullName referralCode createdAt isActivated activationExpiry');
                levels[level].push(userData);
            }
            
            if(level < 20) { // Limit to 20 levels deep
                const children = await User.find({ sponsorId: id });
                for(let child of children) {
                    queue.push({ id: child._id, level: level + 1 });
                }
            }
        }
        res.json(levels);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Tree View (Binary)
// @route   GET /api/network/tree
// @access  Private
exports.getTreeView = async (req, res) => {
    try {
        const buildTree = async (nodeId, depth = 0) => {
            if (!nodeId || depth > 5) return null; // Limit depth for UI performance
            
            const user = await User.findById(nodeId).select('username fullName phone referralCode leftChild rightChild position isActivated activationExpiry');
            if(!user) return null;

            return {
                id: user._id,
                name: user.fullName,
                username: user.username,
                phone: user.phone,
                referralCode: user.referralCode,
                position: user.position,
                isActivated: user.isActivated,
                activationExpiry: user.activationExpiry,
                left: await buildTree(user.leftChild, depth + 1),
                right: await buildTree(user.rightChild, depth + 1)
            };
        };

        const tree = await buildTree(req.user._id);
        res.json(tree);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
