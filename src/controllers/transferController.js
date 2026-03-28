const User = require('../models/User');
const Transfer = require('../models/Transfer');

// @desc    Transfer funds to another user
// @route   POST /api/transfers
// @access  Private
exports.transferFunds = async (req, res) => {
  const { amount, targetUsername, note } = req.body;
  const senderId = req.user.id;

  try {
    const sender = await User.findById(senderId);
    if (!sender) return res.status(404).json({ message: 'Sender not found' });

    if (amount <= 0) return res.status(400).json({ message: 'Amount must be greater than zero' });
    if (sender.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });

    const receiver = await User.findOne({ username: targetUsername });
    if (!receiver) return res.status(404).json({ message: 'Target user not found' });

    if (senderId.toString() === receiver._id.toString()) {
      return res.status(400).json({ message: 'Cannot transfer funds to yourself' });
    }

    // Perform Transfer (Use transactions in production if possible)
    sender.balance -= Number(amount);
    receiver.balance += Number(amount);

    await sender.save();
    await receiver.save();

    // Create Transfer Record
    const transfer = new Transfer({
      senderId,
      receiverId: receiver._id,
      amount: Number(amount),
      note
    });

    await transfer.save();

    res.status(200).json({ 
      message: 'Transfer successful', 
      newBalance: sender.balance,
      transfer 
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

// @desc    Get transfer history (sent and received)
// @route   GET /api/transfers/history
// @access  Private
exports.getTransferHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await Transfer.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    })
    .populate('senderId', 'username fullName')
    .populate('receiverId', 'username fullName')
    .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching history', error: err.message });
  }
};
