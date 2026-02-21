// Subscription Helper Service
// Provides utilities for subscription calculations and status checks

const SubscriptionHelperService = {
  /**
   * Calculate days remaining in subscription
   * @param {Date} endDate - Subscription end date
   * @returns {number} - Number of days remaining
   */
  getDaysRemaining(endDate) {
    const now = new Date();
    const timeDiff = endDate.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  },

  /**
   * Calculate months remaining in subscription
   * @param {Date} endDate - Subscription end date
   * @returns {number} - Number of months remaining
   */
  getMonthsRemaining(endDate) {
    const now = new Date();
    let months = 0;
    const tempDate = new Date(now);

    while (tempDate < endDate) {
      tempDate.setMonth(tempDate.getMonth() + 1);
      if (tempDate <= endDate) {
        months++;
      }
    }

    return months;
  },

  /**
   * Get subscription expiry status
   * @param {Date} endDate - Subscription end date
   * @returns {Object} - { status: string, daysRemaining: number, monthsRemaining: number }
   */
  getExpiryStatus(endDate) {
    const now = new Date();
    const daysRemaining = this.getDaysRemaining(endDate);
    const monthsRemaining = this.getMonthsRemaining(endDate);

    if (endDate < now) {
      return {
        status: 'EXPIRED',
        daysRemaining: 0,
        monthsRemaining: 0,
        isExpired: true,
        isExpiring: false
      };
    }

    // If less than or equal to 1 month (30 days) remaining
    if (daysRemaining <= 30) {
      return {
        status: 'EXPIRING',
        daysRemaining,
        monthsRemaining: 0,
        isExpired: false,
        isExpiring: true
      };
    }

    return {
      status: 'ACTIVE',
      daysRemaining,
      monthsRemaining,
      isExpired: false,
      isExpiring: false
    };
  },

  /**
   * Check if subscription is expired
   * @param {Date} endDate - Subscription end date
   * @returns {boolean}
   */
  isExpired(endDate) {
    return new Date() > endDate;
  },

  /**
   * Check if subscription is expiring soon (≤1 month)
   * @param {Date} endDate - Subscription end date
   * @returns {boolean}
   */
  isExpiringSoon(endDate) {
    const daysRemaining = this.getDaysRemaining(endDate);
    return daysRemaining <= 30 && daysRemaining > 0;
  },

  /**
   * Format remaining time for display
   * @param {Date} endDate - Subscription end date
   * @returns {Object} - { text: string, value: number, unit: string }
   */
  formatRemainingTime(endDate) {
    const status = this.getExpiryStatus(endDate);

    if (status.isExpired) {
      return {
        text: 'Expired',
        value: 0,
        unit: 'days'
      };
    }

    if (status.isExpiring) {
      return {
        text: `${status.daysRemaining} day${status.daysRemaining !== 1 ? 's' : ''} remaining`,
        value: status.daysRemaining,
        unit: 'days'
      };
    }

    return {
      text: `${status.monthsRemaining} month${status.monthsRemaining !== 1 ? 's' : ''} remaining`,
      value: status.monthsRemaining,
      unit: 'months'
    };
  },

  /**
   * Get formatted subscription summary
   * @param {Object} subscription - UserSubscription document
   * @returns {Object} - Formatted subscription data
   */
  getFormattedSubscriptionSummary(subscription) {
    const expiryStatus = this.getExpiryStatus(subscription.endDate);
    const remainingTime = this.formatRemainingTime(subscription.endDate);

    return {
      planName: subscription.plan.name,
      planType: subscription.plan.planType,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      allowedStates: subscription.allowedStates,
      allowedSectors: subscription.allowedSectors,
      isPanIndia: subscription.isPanIndia,
      expiryStatus: expiryStatus.status,
      isExpired: expiryStatus.isExpired,
      isExpiring: expiryStatus.isExpiring,
      daysRemaining: expiryStatus.daysRemaining,
      monthsRemaining: expiryStatus.monthsRemaining,
      remainingTimeDisplay: remainingTime.text,
      remainingTimeValue: remainingTime.value,
      remainingTimeUnit: remainingTime.unit,
      warningMessage: expiryStatus.isExpiring
        ? 'Your subscription is about to expire. Please renew it.'
        : null
    };
  }
};

module.exports = SubscriptionHelperService;
