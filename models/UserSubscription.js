const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },

  // explicit date range; startDate is kept for backwards compatibility but
  // fromDate / toDate will be used in business logic and exposed to clients.
  startDate: { type: Date, default: Date.now },
  fromDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  toDate: { type: Date, required: true },

  // marks trial/free subscriptions which are read‑only and download‑restricted
  isTrial: { type: Boolean, default: false },

  isActive: { type: Boolean, default: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  // References to master data instead of hardcoded enums
  allowedStates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StateMaster' }],
  allowedSectors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SectorMaster' }],
  isPanIndia: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);