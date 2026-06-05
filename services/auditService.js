const AuditLog = require('../models/AuditLog');

/**
 * Centralized audit logging service
 * All controllers should use this service for consistent audit logging
 */

/**
 * Log an action to the audit log
 * @param {Object} auditData - The audit data object
 * @param {string} auditData.userId - ID of the user performing the action
 * @param {string} auditData.action - Action being performed (e.g., 'LOGIN', 'CREATE_USER')
 * @param {string} auditData.resourceType - Type of resource affected (e.g., 'USER', 'SUBSCRIPTION')
 * @param {string|null} auditData.resourceId - ID of the resource affected (optional)
 * @param {Object} auditData.previousValues - Previous state of the resource (for updates)
 * @param {Object} auditData.newValues - New state of the resource (for updates/creates)
 * @param {Object} auditData.req - Express request object (to extract IP and user-agent)
 * @returns {Promise<Object>} The created audit log document
 */
exports.logAction = async (auditData) => {
  try {
    const {
      userId,
      action,
      resourceType,
      resourceId = null,
      previousValues = null,
      newValues = null,
      req = {}
    } = auditData;

    // Extract IP address from request
    let ipAddress = null;
    if (req.ip) {
      ipAddress = req.ip;
    } else if (req.headers && req.headers['x-forwarded-for']) {
      ipAddress = req.headers['x-forwarded-for'].split(',')[0].trim();
    }

    // Extract user agent from request
    const userAgent = req.headers && req.headers['user-agent'] 
      ? req.headers['user-agent'] 
      : null;

    // Create audit log entry
    const auditLog = await AuditLog.create({
      userId,
      action,
      resourceType,
      resourceId,
      previousValues,
      newValues,
      ipAddress,
      userAgent
    });

    return auditLog;
  } catch (error) {
    // Log the error but don't throw - audit logging failures shouldn't break API responses
    console.error('Audit logging error:', error);
    return null;
  }
};

/**
 * Get audit logs with filtering and pagination
 * @param {Object} filters - Filter criteria
 * @param {string} filters.userId - Filter by user ID
 * @param {string} filters.action - Filter by action
 * @param {string} filters.resourceType - Filter by resource type
 * @param {number} filters.page - Page number (1-indexed)
 * @param {number} filters.limit - Results per page
 * @param {string} filters.sortBy - Sort field (default: '-createdAt')
 * @returns {Promise<Object>} Audit logs and total count
 */
exports.getAuditLogs = async (filters = {}) => {
  try {
    const {
      userId = null,
      action = null,
      resourceType = null,
      page = 1,
      limit = 20,
      sortBy = '-createdAt'
    } = filters;

    // Build query filter
    const query = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort(sortBy)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name email username'),
      AuditLog.countDocuments(query)
    ]);

    return {
      logs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error('Get audit logs error:', error);
    throw error;
  }
};

/**
 * Get recent actions for a specific user
 * @param {string} userId - User ID
 * @param {number} limit - Number of recent logs to return
 * @returns {Promise<Array>} Recent audit logs for the user
 */
exports.getUserActivityLog = async (userId, limit = 50) => {
  try {
    return await AuditLog.find({ userId })
      .sort('-createdAt')
      .limit(parseInt(limit))
      .populate('userId', 'name email username');
  } catch (error) {
    console.error('Get user activity log error:', error);
    throw error;
  }
};

/**
 * Get activity for a specific resource
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @param {number} limit - Number of logs to return
 * @returns {Promise<Array>} Audit logs for the resource
 */
exports.getResourceActivityLog = async (resourceType, resourceId, limit = 50) => {
  try {
    return await AuditLog.find({ resourceType, resourceId })
      .sort('-createdAt')
      .limit(parseInt(limit))
      .populate('userId', 'name email username');
  } catch (error) {
    console.error('Get resource activity log error:', error);
    throw error;
  }
};
