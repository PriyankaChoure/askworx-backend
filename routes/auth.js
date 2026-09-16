const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

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

// Shared password strength rule (was duplicated 2x before — now reused everywhere a new password is set)
const strongPassword = (field) =>
  body(field)
    .isLength({ min: 8 })
    .withMessage(`${field} must be at least 8 characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(`${field} must contain at least one uppercase letter, one lowercase letter, and one number`);

// Login
router.post('/login', [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
], handleValidationErrors, authController.login);

// Refresh token
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
], handleValidationErrors, authController.refreshToken);

// Reset first password (no auth required)
router.post('/reset-first-password', [
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  strongPassword('newPassword'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required'),
], handleValidationErrors, authController.resetFirstPassword);

// Change password (first login or reset)
router.post('/change-password', auth, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  strongPassword('newPassword'),
], handleValidationErrors, authController.changePassword);
// --- Forgot password flow ---

// Step 1: request a reset link (sent to the user's registered email)
router.post('/forgot-password', [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Enter a valid email address'),
], handleValidationErrors, authController.forgotPassword);

// Step 2: submit new password using the token from the emailed link
router.post('/reset-password/:token', [
  strongPassword('newPassword'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),
], handleValidationErrors, authController.resetPassword);

// Logout
router.post('/logout', auth, authController.logout);

module.exports = router;