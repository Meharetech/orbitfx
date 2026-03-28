const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const generateReferralCode = async () => {
    let code;
    let exists = true;
    while(exists) {
        code = 'OFX' + Math.floor(100000 + Math.random() * 900000);
        const user = await User.findOne({ referralCode: code });
        if(!user) exists = false;
    }
    return code;
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  const { fullName, email, phone, username, password, sponsorRef, place } = req.body;

  try {
    // 1. Basic validation
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Find Sponsor
    const sponsor = await User.findOne({ referralCode: sponsorRef });
    if (!sponsor && sponsorRef !== 'COMPANY') { // Allow a root 'COMPANY' sponsor for first users
      return res.status(400).json({ message: 'Invalid sponsor code' });
    }

    // 3. MLM Binary Placement Logic
    let parentId = null;
    let actualPosition = place; // 'L' or 'R'

    if (sponsor) {
        // Find the extreme node in the specified side (L or R) starting from sponsor
        let currentNode = sponsor;
        while (currentNode) { // Use currentNode as guard
            if (place === 'L') {
                if (currentNode.leftChild) {
                    const nextNode = await User.findById(currentNode.leftChild);
                    if (!nextNode) { // Safely break if child doesn't exist
                        parentId = currentNode._id;
                        break;
                    }
                    currentNode = nextNode;
                } else {
                    parentId = currentNode._id;
                    break;
                }
            } else if (place === 'R') {
                if (currentNode.rightChild) {
                    const nextNode = await User.findById(currentNode.rightChild);
                    if (!nextNode) { // Safely break if child doesn't exist
                        parentId = currentNode._id;
                        break;
                    }
                    currentNode = nextNode;
                } else {
                    parentId = currentNode._id;
                    break;
                }
            } else {
                break; // Safety break
            }
        }
    }

    // 4. Generate Referral Code
    const referralCode = await generateReferralCode();

    // 5. Create User
    const user = await User.create({
      fullName,
      email,
      phone,
      username,
      password,
      referralCode,
      sponsorRef,
      sponsorId: sponsor ? sponsor._id : null,
      parentId,
      position: actualPosition
    });

    // 6. Update Parent's child reference
    if (parentId) {
        if (actualPosition === 'L') {
            await User.findByIdAndUpdate(parentId, { leftChild: user._id });
        } else {
            await User.findByIdAndUpdate(parentId, { rightChild: user._id });
        }
    }

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      referralCode: user.referralCode,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        referralCode: user.referralCode,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get sponsor name by code
// @route   GET /api/auth/sponsor/:code
// @access  Public
exports.getSponsorName = async (req, res) => {
    try {
        const user = await User.findOne({ referralCode: req.params.code }).select('fullName');
        if (user) {
            res.json({ fullName: user.fullName });
        } else {
            res.status(404).json({ message: 'Sponsor not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Lookup user by username for transfer preview
// @route   GET /api/auth/lookup/:username
// @access  Private
exports.lookupUser = async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).select('fullName position');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update wallet address
// @route   PUT /api/auth/updatewallet
// @access  Private
exports.updateWallet = async (req, res) => {
    const { address, network } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.walletAddress = address;
            user.walletNetwork = network || 'USDT (TRC20)';
            await user.save();
            res.json({ message: 'Wallet address updated successfully', walletAddress: user.walletAddress, walletNetwork: user.walletNetwork });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (user && (await user.comparePassword(oldPassword))) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(401).json({ message: 'Invalid current password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
