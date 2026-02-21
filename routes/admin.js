const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const adminController = require('../controllers/adminController');
const masterDataController = require('../controllers/masterDataController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const checkFirstLogin = require('../middleware/firstLogin');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// All admin routes require authentication and super admin role
router.use(auth);
router.use(checkFirstLogin);
router.use(checkRole(['Super Admin']));

// User management
router.get('/users', adminController.getUsers);

router.post('/users', [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be either user or admin'),
  body('subscriptionPlan')
    .optional()
    .isMongoId()
    .withMessage('Valid subscription plan ID is required'),
], handleValidationErrors, adminController.createUser);

router.put('/users/:id', [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
], handleValidationErrors, adminController.updateUser);

router.delete('/users/:id', adminController.deactivateUser);

router.post('/users/:id/reset-password', adminController.resetUserPassword);

// Subscription plans
router.get('/plans', adminController.getPlans);

router.post('/plans', [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Plan name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Plan name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('duration')
    .isInt({ min: 1, max: 36 })
    .withMessage('Duration must be between 1 and 36 months'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
], handleValidationErrors, adminController.createPlan);

router.put('/plans/:id', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Plan name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 36 })
    .withMessage('Duration must be between 1 and 36 months'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
], handleValidationErrors, adminController.updatePlan);

router.delete('/plans/:id', adminController.deactivatePlan);

// Assign plan to user
router.post('/assign-plan', [
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('planId')
    .isMongoId()
    .withMessage('Valid plan ID is required'),
  body('allowedStates')
    .optional()
    .isArray()
    .withMessage('Allowed states must be an array'),
  body('allowedSectors')
    .optional()
    .isArray()
    .withMessage('Allowed sectors must be an array'),
  body('isPanIndia')
    .optional()
    .isBoolean()
    .withMessage('isPanIndia must be a boolean'),
], handleValidationErrors, adminController.assignPlan);

// Audit logs
router.get('/logs', adminController.getAuditLogs);

// Dashboard statistics
router.get('/dashboard/stats', adminController.getDashboardStats);

// Subscription plans (alias for plans)
router.get('/subscription-plans', adminController.getSubscriptionPlans);

// User actions
router.patch('/users/:id/:action', adminController.toggleUserStatus);

// Project management
const projectController = require('../controllers/projectController');

router.get('/projects', projectController.getProjects);
router.get('/projects/filters', projectController.getFilterOptions);
router.get('/projects/:id', projectController.getProject);
router.post('/projects', [
  body('projectCode')
    .trim()
    .notEmpty()
    .withMessage('Project code is required'),
  body('projectTitle')
    .trim()
    .notEmpty()
    .withMessage('Project title is required'),
  body('industryRaw')
    .trim()
    .notEmpty()
    .withMessage('Industry is required'),
  body('projectValue')
    .isFloat({ min: 0 })
    .withMessage('Project value must be a positive number'),
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('sourceMonth')
    .trim()
    .notEmpty()
    .withMessage('Source month is required'),
], handleValidationErrors, projectController.createProject);

router.put('/projects/:id', [
  body('projectCode')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Project code cannot be empty'),
  body('projectTitle')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Project title cannot be empty'),
  body('industryRaw')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Industry cannot be empty'),
  body('projectValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Project value must be a positive number'),
  body('status')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Status cannot be empty'),
  body('country')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Country cannot be empty'),
  body('state')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('State cannot be empty'),
  body('sourceMonth')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Source month cannot be empty'),
], handleValidationErrors, projectController.updateProject);

router.patch('/projects/:id/toggle', projectController.toggleProjectStatus);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  }
});

// Import projects from Excel
router.post('/projects/import', upload.single('file'), [
  body('sourceMonth')
    .trim()
    .notEmpty()
    .withMessage('Source month is required')
    .matches(/^[A-Za-z]{3}-\d{4}$/)
    .withMessage('Source month must be in format MMM-YYYY (e.g., Jan-2025)'),
], handleValidationErrors, projectController.importProjects);

// ================== MASTER DATA ROUTES ==================

// State management routes
router.post('/states', [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('State name is required'),
  body('code')
    .optional()
    .trim()
], handleValidationErrors, masterDataController.createState);

router.get('/states', masterDataController.getAllStates);
router.get('/states/active', masterDataController.getActiveStates);
router.get('/states/:id', masterDataController.getStateById);

router.put('/states/:id', [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('State name cannot be empty'),
  body('code')
    .optional()
    .trim()
], handleValidationErrors, masterDataController.updateState);

router.put('/states/:id/toggle', masterDataController.toggleState);

// Sector management routes
router.post('/sectors', [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Sector name is required')
], handleValidationErrors, masterDataController.createSector);

router.get('/sectors', masterDataController.getAllSectors);
router.get('/sectors/active', masterDataController.getActiveSectors);
router.get('/sectors/:id', masterDataController.getSectorById);

router.put('/sectors/:id', [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Sector name cannot be empty')
], handleValidationErrors, masterDataController.updateSector);

router.put('/sectors/:id/toggle', masterDataController.toggleSector);

module.exports = router;