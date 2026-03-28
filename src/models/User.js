const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // Referral Properties
  referralCode: { type: String, unique: true }, // e.g., OFX337946
  sponsorRef: { type: String }, // Sponsor's referral code
  sponsorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Binary MLM Structure
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Direct node above
  position: { type: String, enum: ['L', 'R', null] }, // Left or Right relative to parent
  leftChild: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rightChild: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Account Status
  isActive: { type: Boolean, default: false },
  activationDate: { type: Date },
  
  // Wallet
  balance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  walletAddress: { type: String, default: null },
  walletNetwork: { type: String },
  
  // Activation System
  isActivated: { type: Boolean, default: false },
  activationDate: { type: Date },
  activationExpiry: { type: Date },
  
  // Reward Tracking
  qualifiedForDirectReward: { type: Boolean, default: false },
  firstLeftActivated:  { type: Boolean, default: false },
  firstRightActivated: { type: Boolean, default: false },

  // Pair Matching Rank System
  leftTeamCount:  { type: Number, default: 0 }, // Total activated members in left leg
  rightTeamCount: { type: Number, default: 0 }, // Total activated members in right leg
  totalPairs:     { type: Number, default: 0 }, // min(left, right)
  currentRank:    { type: String, default: null },

  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
