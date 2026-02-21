const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');

exports.getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserSubscription = async (req, res) => {
  try {
    const subscription = await UserSubscription.findOne({ user: req.user._id, isActive: true }).populate('plan');
    res.json(subscription);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};