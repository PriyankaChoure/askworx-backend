const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  // References to master data instead of hardcoded enums
  allowedStates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StateMaster' }],
  allowedSectors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SectorMaster' }],
  isPanIndia: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);