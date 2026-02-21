const mongoose = require('mongoose');

const projectMasterSchema = new mongoose.Schema({
  projectCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  projectTitle: {
    type: String,
    required: true,
    trim: true
  },
  sector: {
    type: String,
    required: true,
    // Validation done via MasterDataValidationService against active sectors
  },
  industryRaw: {
    type: String,
    required: true,
    trim: true
  },
  projectValue: {
    type: String,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    trim: true
  },
  product: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  capacity: {
    type: String,
    trim: true
  },
  placeOfWork: {
    type: String,
    trim: true
  },
  projectDetails: {
    type: String,
    trim: true
  },
  contactDetails: {
    type: String,
    trim: true
  },
  contractor: {
    type: String,
    trim: true
  },
  constructor: {
    type: String,
    trim: true
  },
  architect: {
    type: String,
    trim: true
  },
  updatedDate: {
    type: Date
  },
  expectedCompletionDate: {
    type: Date
  },
  sourceMonth: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
projectMasterSchema.index({ sector: 1, state: 1, status: 1, sourceMonth: 1 });
projectMasterSchema.index({ projectCode: 1 }, { unique: true });

module.exports = mongoose.model('ProjectMaster', projectMasterSchema);