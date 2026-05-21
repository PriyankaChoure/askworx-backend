const UserSubscription = require('../models/UserSubscription');
const SubscriptionService = require('../services/subscriptionService');

// middleware to ensure user has a currently valid subscription for viewing data
// automatically deactivates expired records and tags trial users
const checkSubscriptionValidity = async (req, res, next) => {
  try {
    const now = new Date();

    // find any subscription for the user that hasn't been explicitly deactivated
    // and where the current date is within the from/to range
    let subscription = await UserSubscription.findOne({
      user: req.user._id,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).populate('plan');

    if (!subscription) {
      // if no active window exists, mark any expired subscriptions inactive
      await UserSubscription.updateMany(
        { user: req.user._id, isActive: true, toDate: { $lt: now } },
        { isActive: false }
      );
      return res.status(403).json({
        message: 'Active subscription required. Please contact admin to renew.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // add warning if ending soon (7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    if (subscription.toDate <= sevenDaysFromNow) {
      req.subscriptionWarning = `Your subscription expires on ${subscription.toDate.toDateString()}`;
    }

    req.subscription = subscription;
    // expose a flag to identify trial/free users
    req.isFreeTrialUser = subscription.isTrial || req.user.isFreeSubscriber;
    next();
  } catch (error) {
    console.error('Subscription validation error:', error);
    res.status(500).json({ message: 'Server error during subscription validation' });
  }
};

const filterDataBySubscription = (data, subscription) => {
  return SubscriptionService.filterDataBySubscription(data, subscription);
};

// ensure download endpoint is only available to paid subscribers
const checkDownloadAccess = (req, res, next) => {
  // subscription validity should already be enforced by previous middleware
  if (req.user.isFreeSubscriber || (req.subscription && req.subscription.isTrial)) {
    return res.status(403).json({
      message: 'Download not permitted for free/trial accounts',
      code: 'DOWNLOAD_RESTRICTED'
    });
  }
  next();
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
  checkSubscription: checkSubscriptionValidity,
  checkSubscriptionValidity,
  checkDownloadAccess,
  filterDataBySubscription,
  validateSubscriptionAccess
};