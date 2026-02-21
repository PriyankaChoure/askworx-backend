const UserSubscription = require('../models/UserSubscription');
const SubscriptionService = require('../services/subscriptionService');

const checkSubscription = async (req, res, next) => {
  try {
    const subscription = await UserSubscription.findOne({
      user: req.user._id,
      isActive: true,
      endDate: { $gte: new Date() }
    }).populate('plan');

    if (!subscription) {
      return res.status(403).json({
        message: 'Active subscription required. Please contact admin to renew.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // Check if subscription is about to expire (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    if (subscription.endDate <= sevenDaysFromNow) {
      req.subscriptionWarning = `Your subscription expires on ${subscription.endDate.toDateString()}`;
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ message: 'Server error during subscription validation' });
  }
};

const filterDataBySubscription = (data, subscription) => {
  return SubscriptionService.filterDataBySubscription(data, subscription);
};

const validateSubscriptionAccess = (options = {}) => {
  return async (req, res, next) => {
    try {
      // Assume req.subscription is set by checkSubscription middleware
      if (!req.subscription) {
        return res.status(403).json({ message: 'Subscription check required' });
      }

      // Support dynamic options via function
      const resolvedOptions = typeof options === 'function' ? options(req) : options;
      const { requiredStates = [], requiredSectors = [] } = resolvedOptions;

      // If no specific requirements, allow access
      if (requiredStates.length === 0 && requiredSectors.length === 0) {
        return next();
      }

      // Check state access
      if (requiredStates.length > 0) {
        const hasStateAccess = requiredStates.every(state => 
          SubscriptionService.canAccessState(req.subscription, state)
        );
        if (!hasStateAccess) {
          return res.status(403).json({ 
            message: 'Access denied: Insufficient state permissions',
            code: 'INSUFFICIENT_STATE_ACCESS'
          });
        }
      }

      // Check sector access
      if (requiredSectors.length > 0) {
        const hasSectorAccess = requiredSectors.every(sector => 
          SubscriptionService.canAccessSector(req.subscription, sector)
        );
        if (!hasSectorAccess) {
          return res.status(403).json({ 
            message: 'Access denied: Insufficient sector permissions',
            code: 'INSUFFICIENT_SECTOR_ACCESS'
          });
        }
      }

      next();
    } catch (error) {
      console.error('Access validation error:', error);
      res.status(500).json({ message: 'Server error during access validation' });
    }
  };
};

module.exports = {
  checkSubscription,
  filterDataBySubscription,
  validateSubscriptionAccess
};