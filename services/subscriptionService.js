const { PLAN_TYPES } = require('../utils/constants');

class SubscriptionService {
  static validateSubscriptionRules(planType, allowedStates, isPanIndia) {
    switch (planType) {
      case PLAN_TYPES.PLAN_1:
        if (allowedStates.length !== 1) {
          throw new Error('PLAN_1 requires exactly 1 state');
        }
        break;
      case PLAN_TYPES.PLAN_2:
        if (allowedStates.length < 1) {
          throw new Error('PLAN_2 requires at least 1 state');
        }
        break;
      case PLAN_TYPES.PLAN_3:
        if (!isPanIndia) {
          throw new Error('PLAN_3 requires isPanIndia to be true');
        }
        break;
      default:
        throw new Error('Invalid plan type');
    }
  }

  static getAllowedStates(subscription) {
    if (subscription.isPanIndia) {
      return null; // All states
    }
    return subscription.allowedStates;
  }

  static getAllowedSectors(subscription) {
    return subscription.allowedSectors;
  }

  static canAccessState(subscription, state) {
    if (subscription.isPanIndia) {
      return true;
    }
    return subscription.allowedStates.includes(state);
  }

  static canAccessSector(subscription, sector) {
    return subscription.allowedSectors.includes(sector);
  }

  static filterDataBySubscription(data, subscription) {
    // Assuming data is an array of objects with 'state' and 'sector' fields
    const allowedStates = this.getAllowedStates(subscription);
    const allowedSectors = this.getAllowedSectors(subscription);

    return data.filter(item => {
      const stateAllowed = allowedStates === null || allowedStates.includes(item.state);
      const sectorAllowed = allowedSectors.includes(item.sector);
      return stateAllowed && sectorAllowed;
    });
  }
}

module.exports = SubscriptionService;