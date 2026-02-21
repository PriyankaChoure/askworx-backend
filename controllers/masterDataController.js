const StateMaster = require('../models/StateMaster');
const SectorMaster = require('../models/SectorMaster');
const AuditLog = require('../models/AuditLog');

/**
 * Master Data Controller
 * Handles CRUD operations for States and Sectors
 */

// ================== STATE OPERATIONS ==================

/**
 * Create new state
 * POST /api/admin/states
 */
exports.createState = async (req, res) => {
  try {
    const { name, code } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'State name is required'
      });
    }

    // Check if state already exists
    const existingState = await StateMaster.findOne({
      name: { $regex: `^${name.trim()}$`, $options: 'i' }
    });

    if (existingState) {
      return res.status(400).json({
        success: false,
        message: 'State with this name already exists'
      });
    }

    // Create state
    const state = new StateMaster({
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : null
    });

    await state.save();

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      action: 'CREATE_STATE',
      resourceType: 'StateMaster',
      resourceId: state._id,
      details: { name: state.name, code: state.code }
    });

    res.status(201).json({
      success: true,
      message: 'State created successfully',
      data: state
    });
  } catch (error) {
    console.error('Error creating state:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating state',
      error: error.message
    });
  }
};

/**
 * Get all states (active and inactive)
 * GET /api/admin/states
 */
exports.getAllStates = async (req, res) => {
  try {
    const { isActive } = req.query;

    let filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const states = await StateMaster.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      data: states,
      total: states.length
    });
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching states',
      error: error.message
    });
  }
};

/**
 * Get only active states
 * GET /api/admin/states/active
 */
exports.getActiveStates = async (req, res) => {
  try {
    const states = await StateMaster.find({ isActive: true })
      .select('_id name code')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: states
    });
  } catch (error) {
    console.error('Error fetching active states:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active states',
      error: error.message
    });
  }
};

/**
 * Get state by ID
 * GET /api/admin/states/:id
 */
exports.getStateById = async (req, res) => {
  try {
    const state = await StateMaster.findById(req.params.id);

    if (!state) {
      return res.status(404).json({
        success: false,
        message: 'State not found'
      });
    }

    res.json({
      success: true,
      data: state
    });
  } catch (error) {
    console.error('Error fetching state:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching state',
      error: error.message
    });
  }
};

/**
 * Toggle state active/inactive
 * PUT /api/admin/states/:id/toggle
 */
exports.toggleState = async (req, res) => {
  try {
    const state = await StateMaster.findById(req.params.id);

    if (!state) {
      return res.status(404).json({
        success: false,
        message: 'State not found'
      });
    }

    const previousStatus = state.isActive;
    state.isActive = !state.isActive;
    await state.save();

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      action: 'TOGGLE_STATE',
      resourceType: 'StateMaster',
      resourceId: state._id,
      details: { name: state.name, previousStatus, newStatus: state.isActive }
    });

    res.json({
      success: true,
      message: `State ${state.isActive ? 'activated' : 'deactivated'} successfully`,
      data: state
    });
  } catch (error) {
    console.error('Error toggling state:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling state',
      error: error.message
    });
  }
};

/**
 * Update state
 * PUT /api/admin/states/:id
 */
exports.updateState = async (req, res) => {
  try {
    const { name, code } = req.body;
    const state = await StateMaster.findById(req.params.id);

    if (!state) {
      return res.status(404).json({
        success: false,
        message: 'State not found'
      });
    }

    const oldData = { name: state.name, code: state.code };

    if (name && name.trim()) {
      // Check if new name is unique
      const existingState = await StateMaster.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: `^${name.trim()}$`, $options: 'i' }
      });

      if (existingState) {
        return res.status(400).json({
          success: false,
          message: 'State with this name already exists'
        });
      }

      state.name = name.trim();
    }

    if (code) {
      state.code = code.trim().toUpperCase();
    }

    await state.save();

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      action: 'UPDATE_STATE',
      resourceType: 'StateMaster',
      resourceId: state._id,
      details: { old: oldData, new: { name: state.name, code: state.code } }
    });

    res.json({
      success: true,
      message: 'State updated successfully',
      data: state
    });
  } catch (error) {
    console.error('Error updating state:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating state',
      error: error.message
    });
  }
};

// ================== SECTOR OPERATIONS ==================

/**
 * Create new sector
 * POST /api/admin/sectors
 */
exports.createSector = async (req, res) => {
  try {
    const { name } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Sector name is required'
      });
    }

    // Check if sector already exists
    const existingSector = await SectorMaster.findOne({
      name: { $regex: `^${name.trim()}$`, $options: 'i' }
    });

    if (existingSector) {
      return res.status(400).json({
        success: false,
        message: 'Sector with this name already exists'
      });
    }

    // Create sector
    const sector = new SectorMaster({
      name: name.trim()
    });

    await sector.save();

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      action: 'CREATE_SECTOR',
      resourceType: 'SectorMaster',
      resourceId: sector._id,
      details: { name: sector.name }
    });

    res.status(201).json({
      success: true,
      message: 'Sector created successfully',
      data: sector
    });
  } catch (error) {
    console.error('Error creating sector:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating sector',
      error: error.message
    });
  }
};

/**
 * Get all sectors (active and inactive)
 * GET /api/admin/sectors
 */
exports.getAllSectors = async (req, res) => {
  try {
    const { isActive } = req.query;

    let filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const sectors = await SectorMaster.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      data: sectors,
      total: sectors.length
    });
  } catch (error) {
    console.error('Error fetching sectors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sectors',
      error: error.message
    });
  }
};

/**
 * Get only active sectors
 * GET /api/admin/sectors/active
 */
exports.getActiveSectors = async (req, res) => {
  try {
    const sectors = await SectorMaster.find({ isActive: true })
      .select('_id name')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: sectors
    });
  } catch (error) {
    console.error('Error fetching active sectors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active sectors',
      error: error.message
    });
  }
};

/**
 * Get sector by ID
 * GET /api/admin/sectors/:id
 */
exports.getSectorById = async (req, res) => {
  try {
    const sector = await SectorMaster.findById(req.params.id);

    if (!sector) {
      return res.status(404).json({
        success: false,
        message: 'Sector not found'
      });
    }

    res.json({
      success: true,
      data: sector
    });
  } catch (error) {
    console.error('Error fetching sector:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sector',
      error: error.message
    });
  }
};

/**
 * Toggle sector active/inactive
 * PUT /api/admin/sectors/:id/toggle
 */
exports.toggleSector = async (req, res) => {
  try {
    const sector = await SectorMaster.findById(req.params.id);

    if (!sector) {
      return res.status(404).json({
        success: false,
        message: 'Sector not found'
      });
    }

    const previousStatus = sector.isActive;
    sector.isActive = !sector.isActive;
    await sector.save();

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      action: 'TOGGLE_SECTOR',
      resourceType: 'SectorMaster',
      resourceId: sector._id,
      details: { name: sector.name, previousStatus, newStatus: sector.isActive }
    });

    res.json({
      success: true,
      message: `Sector ${sector.isActive ? 'activated' : 'deactivated'} successfully`,
      data: sector
    });
  } catch (error) {
    console.error('Error toggling sector:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling sector',
      error: error.message
    });
  }
};

/**
 * Update sector
 * PUT /api/admin/sectors/:id
 */
exports.updateSector = async (req, res) => {
  try {
    const { name } = req.body;
    const sector = await SectorMaster.findById(req.params.id);

    if (!sector) {
      return res.status(404).json({
        success: false,
        message: 'Sector not found'
      });
    }

    const oldData = { name: sector.name };

    if (name && name.trim()) {
      // Check if new name is unique
      const existingSector = await SectorMaster.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: `^${name.trim()}$`, $options: 'i' }
      });

      if (existingSector) {
        return res.status(400).json({
          success: false,
          message: 'Sector with this name already exists'
        });
      }

      sector.name = name.trim();
    }

    await sector.save();

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      action: 'UPDATE_SECTOR',
      resourceType: 'SectorMaster',
      resourceId: sector._id,
      details: { old: oldData, new: { name: sector.name } }
    });

    res.json({
      success: true,
      message: 'Sector updated successfully',
      data: sector
    });
  } catch (error) {
    console.error('Error updating sector:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sector',
      error: error.message
    });
  }
};
