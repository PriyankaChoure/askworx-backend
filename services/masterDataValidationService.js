const StateMaster = require('../models/StateMaster');
const SectorMaster = require('../models/SectorMaster');

/**
 * Master Data Validation Service
 * Validates states and sectors against active masters
 */
class MasterDataValidationService {
  /**
   * Get all active states
   * @returns {Promise<Array>} Active state documents
   */
  static async getActiveStates() {
    try {
      return await StateMaster.find({ isActive: true })
        .select('_id name code')
        .sort({ name: 1 });
    } catch (error) {
      console.error('Error fetching active states:', error);
      throw error;
    }
  }

  /**
   * Get all active sectors
   * @returns {Promise<Array>} Active sector documents
   */
  static async getActiveSectors() {
    try {
      return await SectorMaster.find({ isActive: true })
        .select('_id name')
        .sort({ name: 1 });
    } catch (error) {
      console.error('Error fetching active sectors:', error);
      throw error;
    }
  }

  /**
   * Validate if state exists and is active
   * @param {string|ObjectId} stateId - State ID
   * @returns {Promise<boolean>}
   */
  static async isStateActive(stateId) {
    try {
      const state = await StateMaster.findOne({
        _id: stateId,
        isActive: true
      });
      return !!state;
    } catch (error) {
      console.error('Error validating state:', error);
      return false;
    }
  }

  /**
   * Validate if sector exists and is active
   * @param {string|ObjectId} sectorId - Sector ID
   * @returns {Promise<boolean>}
   */
  static async isSectorActive(sectorId) {
    try {
      const sector = await SectorMaster.findOne({
        _id: sectorId,
        isActive: true
      });
      return !!sector;
    } catch (error) {
      console.error('Error validating sector:', error);
      return false;
    }
  }

  /**
   * Validate array of states
   * @param {Array<string|ObjectId>} stateIds - Array of state IDs
   * @returns {Promise<{valid: boolean, invalid: Array, message: string}>}
   */
  static async validateStates(stateIds) {
    try {
      if (!Array.isArray(stateIds) || stateIds.length === 0) {
        return {
          valid: false,
          invalid: stateIds || [],
          message: 'At least one state is required'
        };
      }

      const activeStates = await StateMaster.find({
        _id: { $in: stateIds },
        isActive: true
      }).select('_id');

      const activeStateIds = activeStates.map(s => s._id.toString());
      const invalidStates = stateIds.filter(id => !activeStateIds.includes(id.toString()));

      if (invalidStates.length > 0) {
        return {
          valid: false,
          invalid: invalidStates,
          message: `${invalidStates.length} state(s) are inactive or do not exist`
        };
      }

      return {
        valid: true,
        invalid: [],
        message: 'All states are valid'
      };
    } catch (error) {
      console.error('Error validating states:', error);
      throw error;
    }
  }

  /**
   * Validate array of sectors
   * @param {Array<string|ObjectId>} sectorIds - Array of sector IDs
   * @returns {Promise<{valid: boolean, invalid: Array, message: string}>}
   */
  static async validateSectors(sectorIds) {
    try {
      if (!Array.isArray(sectorIds) || sectorIds.length === 0) {
        return {
          valid: false,
          invalid: sectorIds || [],
          message: 'At least one sector is required'
        };
      }

      const activeSectors = await SectorMaster.find({
        _id: { $in: sectorIds },
        isActive: true
      }).select('_id');

      const activeSectorIds = activeSectors.map(s => s._id.toString());
      const invalidSectors = sectorIds.filter(id => !activeSectorIds.includes(id.toString()));

      if (invalidSectors.length > 0) {
        return {
          valid: false,
          invalid: invalidSectors,
          message: `${invalidSectors.length} sector(s) are inactive or do not exist`
        };
      }

      return {
        valid: true,
        invalid: [],
        message: 'All sectors are valid'
      };
    } catch (error) {
      console.error('Error validating sectors:', error);
      throw error;
    }
  }

  /**
   * Get state by ID
   * @param {string|ObjectId} stateId - State ID
   * @returns {Promise<Object|null>}
   */
  static async getStateById(stateId) {
    try {
      return await StateMaster.findById(stateId);
    } catch (error) {
      console.error('Error fetching state:', error);
      return null;
    }
  }

  /**
   * Get sector by ID
   * @param {string|ObjectId} sectorId - Sector ID
   * @returns {Promise<Object|null>}
   */
  static async getSectorById(sectorId) {
    try {
      return await SectorMaster.findById(sectorId);
    } catch (error) {
      console.error('Error fetching sector:', error);
      return null;
    }
  }
}

module.exports = MasterDataValidationService;
