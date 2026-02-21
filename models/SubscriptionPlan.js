const mongoose = require('mongoose');
const { PLAN_TYPES } = require('../utils/constants');

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  planType: { type: String, enum: Object.values(PLAN_TYPES), required: true },
  features: [{ type: String }],
  limits: {
    projects: { type: Number, default: -1 }, // -1 for unlimited
    downloads: { type: Number, default: -1 },
  },
  duration: { type: Number, required: true }, // in months
  price: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);