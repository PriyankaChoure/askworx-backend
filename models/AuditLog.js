const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  },
  action: { 
    type: String, 
    required: true,
    enum: [
      'LOGIN',
      'LOGIN_FAILED',
      'LOGOUT',
      'CHANGE_PASSWORD',
      'FIRST_PASSWORD_RESET',
      'CREATE_USER',
      'UPDATE_USER',
      'DELETE_USER',
      'CREATE_SUBSCRIPTION',
      'UPDATE_SUBSCRIPTION',
      'CANCEL_SUBSCRIPTION',
      'CREATE_STATE',
      'UPDATE_STATE',
      'DELETE_STATE',
      'TOGGLE_STATE',
      'CREATE_SECTOR',
      'UPDATE_SECTOR',
      'DELETE_SECTOR',
      'TOGGLE_SECTOR'
    ]
  },
  resourceType: { 
    type: String, 
    required: true,
    enum: ['AUTH', 'USER', 'SUBSCRIPTION', 'STATE', 'SECTOR'],
    index: true
  },
  resourceId: { 
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  previousValues: { type: mongoose.Schema.Types.Mixed },
  newValues: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
});

// Compound index for common queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);