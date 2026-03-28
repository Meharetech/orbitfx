const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  note: { type: String },
  status: { type: String, default: 'Completed' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transfer', transferSchema);
