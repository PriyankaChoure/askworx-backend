const { PLAN_TYPES } = require('../utils/constants');
const mongoose = require('mongoose');

class SubscriptionService {
  /**
   * Helper method to compare ObjectIds safely
   * @param {ObjectId|string} id1 - First ID
   * @param {ObjectId|string} id2 - Second ID
   * @returns {boolean} - True if IDs match
   */
  static compareObjectIds(id1, id2) {
    if (!id1 || !id2) return false;
    
    // If they're Mongoose ObjectIds, use equals()
    if (id1._id) id1 = id1._id;
    if (id2._id) id2 = id2._id;
    
    // Convert to string and compare
    const str1 = id1.toString?.() || String(id1);
    const str2 = id2.toString?.() || String(id2);
    
    return str1 === str2 && str1 !== '';
  }
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

  static canAccessState(subscription, stateId) {
    if (subscription.isPanIndia) {
      return true;
    }
    if (!Array.isArray(subscription.allowedStates)) {
      return false;
    }
    return subscription.allowedStates.some(allowedState =>
      this.compareObjectIds(allowedState, stateId)
    );
  }

  static canAccessSector(subscription, sectorId) {
    if (!Array.isArray(subscription.allowedSectors)) {
      return false;
    }
    return subscription.allowedSectors.some(allowedSector =>
      this.compareObjectIds(allowedSector, sectorId)
    );
  }

  static filterDataBySubscription(data, subscription) {
    // Filter data based on allowed states and sectors using ObjectIds
    console.info('Filtering data with subscription:', {
      isPanIndia: subscription.isPanIndia,
      allowedStatesCount: subscription.allowedStates?.length || 0,
      allowedSectorsCount: subscription.allowedSectors?.length || 0
    });
    
    const allowedStates = this.getAllowedStates(subscription);
    const allowedSectors = this.getAllowedSectors(subscription);
    
    if (!Array.isArray(data)) {
      console.error('Data is not an array:', typeof data);
      return [];
    }
    
    return data.filter(item => {
      // Skip items without required IDs
      if (!item.stateId || !item.sectorId) {
        console.warn('Item missing stateId or sectorId:', { 
          projectCode: item.projectCode, 
          hasStateId: !!item.stateId,
          hasSectorId: !!item.sectorId 
        });
        return false;
      }
      
      // Check state: if isPanIndia, all states allowed; otherwise check stateId against allowedStates
      let stateAllowed = false;
      if (allowedStates === null) {
        // Pan India - all states allowed
        stateAllowed = true;
      } else if (Array.isArray(allowedStates) && allowedStates.length > 0) {
        // Check if item's stateId matches any allowed state
        stateAllowed = allowedStates.some(allowedState => 
          this.compareObjectIds(allowedState, item.stateId)
        );
      }
      
      // Check sector: sectorId must be in allowedSectors
      let sectorAllowed = false;
      if (Array.isArray(allowedSectors) && allowedSectors.length > 0) {
        sectorAllowed = allowedSectors.some(allowedSector =>
          this.compareObjectIds(allowedSector, item.sectorId)
        );
      }
      
      const itemAllowed = stateAllowed && sectorAllowed;
      
      if (!itemAllowed) {
        console.debug(`Item filtered: ${item.projectCode} | state: ${stateAllowed} | sector: ${sectorAllowed}`);
      }
      
      return itemAllowed;
    });
  }
}

module.exports = SubscriptionService;