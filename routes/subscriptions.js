const express = require('express');
const subscriptionController = require('../controllers/subscriptionController');
const auth = require('../middleware/auth');

const router = express.Router();

// Get available plans (public)
router.get('/plans', subscriptionController.getPlans);

// User subscription routes (authenticated)
router.use(auth);
router.get('/my-subscription', subscriptionController.getUserSubscription);

module.exports = router;