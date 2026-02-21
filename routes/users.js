const express = require('express');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { checkSubscription, validateSubscriptionAccess } = require('../middleware/subscription');
const checkFirstLogin = require('../middleware/firstLogin');

const router = express.Router();

// All user routes require authentication
router.use(auth);
router.use(checkFirstLogin);

// Get profile
router.get('/profile', userController.getProfile);

// Update profile
router.put('/profile', userController.updateProfile);

// Get subscription status
router.get('/subscription-plans', userController.getSubscription);

// Protected data (requires active subscription)
router.get('/projects', checkSubscription, userController.getProjects);

// Export projects to Excel (requires active subscription)
router.get('/projects/export/excel', checkSubscription, userController.exportProjectsToExcel);

// Get single project (with subscription filtering)
router.get('/projects/:id', checkSubscription, async (req, res) => {
  try {
    const ProjectMaster = require('../models/ProjectMaster');
    const project = await ProjectMaster.findById(req.params.id);

    if (!project || !project.isActive) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check subscription access
    const { validateSubscriptionAccess } = require('../middleware/subscription');
    const accessCheck = (req, res, next) => {
      const { canAccessState, canAccessSector } = require('../services/subscriptionService');
      if (canAccessState(req.subscription, project.state) &&
          canAccessSector(req.subscription, project.sector)) {
        next();
      } else {
        res.status(403).json({ message: 'Access denied' });
      }
    };

    accessCheck(req, res, () => res.json(project));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Example: Get data for specific state
router.get('/data/state/:state', checkSubscription, validateSubscriptionAccess((req) => ({ requiredStates: [req.params.state] })), (req, res) => {
  // This would be implemented in a controller
  res.json({ message: `Data for ${req.params.state}` });
});

// Example: Get data for specific sector
router.get('/data/sector/:sector', checkSubscription, validateSubscriptionAccess((req) => ({ requiredSectors: [req.params.sector] })), (req, res) => {
  res.json({ message: `Data for ${req.params.sector}` });
});

module.exports = router;