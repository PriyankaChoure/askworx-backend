const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionHelperService = require('../services/subscriptionHelperService');
const AuditService = require('../services/auditService');
const sendEmail = require('../utils/sendEmail');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username }).populate('role');
    const isMatch = user ? await user.comparePassword(password) : false;
    if (!user || !isMatch) {
      // Log failed attempt (only if user exists)
      if (user) {
        await AuditService.logAction({
          userId: user._id,
          action: 'LOGIN_FAILED',
          resourceType: 'AUTH',
          req
        });
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }

    // Check if first login - force password reset
    if (user.isFirstLogin) {
      return res.json({
        forcePasswordReset: true,
        userId: user._id,
        message: 'First login detected. Password reset required.'
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Get subscription info for warning check
    const subscription = await UserSubscription.findOne({
      user: user._id,
      isActive: true
    }).populate('plan');

    let subscriptionWarning = null;
    if (subscription) {
      const expiryStatus = SubscriptionHelperService.getExpiryStatus(subscription.endDate);
      if (expiryStatus.isExpiring || expiryStatus.isExpired) {
        subscriptionWarning = {
          isExpiring: expiryStatus.isExpiring,
          isExpired: expiryStatus.isExpired,
          remainingDays: expiryStatus.daysRemaining,
          message: expiryStatus.isExpired
            ? 'Your subscription has expired. Please renew it.'
            : 'Your subscription is about to expire. Please renew it.'
        };
      }
    }

    // Log successful login
    await AuditService.logAction({
      userId: user._id,
      action: 'LOGIN',
      resourceType: 'AUTH',
      req
    });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role.name,
        mustResetPassword: user.mustResetPassword,
        isFreeSubscriber: user.isFreeSubscriber || false
      },
      tokens: {
        accessToken,
        refreshToken,
      },
      subscriptionWarning,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).populate('role');

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password incorrect' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    user.password = newPassword;
    user.mustResetPassword = false;
    await user.save();

    // Log password change
    await AuditService.logAction({
      userId: user._id,
      action: 'CHANGE_PASSWORD',
      resourceType: 'AUTH',
      req
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resetFirstPassword = async (req, res) => {
  try {
    const { userId, newPassword, confirmPassword } = req.body;

    if (!userId || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isFirstLogin) {
      return res.status(400).json({ message: 'Password already reset' });
    }

    // Check if new password is different from current (temporary) password
    const isSameAsCurrent = await user.comparePassword(newPassword);
    if (isSameAsCurrent) {
      return res.status(400).json({ message: 'New password cannot be the same as the current password' });
    }

    // Update user
    user.password = newPassword;
    user.isFirstLogin = false;
    user.passwordResetAt = new Date();
    await user.save();

    // Log password reset
    await AuditService.logAction({
      userId: user._id,
      action: 'FIRST_PASSWORD_RESET',
      resourceType: 'AUTH',
      req
    });

    res.json({ 
      message: 'Password reset successfully. Please login with your new password.',
      success: true
    });
  } catch (error) {
    console.error('Reset first password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token or implement token revocation
    await AuditService.logAction({
      userId: req.user._id,
      action: 'LOGOUT',
      resourceType: 'AUTH',
      req
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Forgot password request for email:', email);
    const user = await User.findOne({ email: email.toLowerCase() });

    // IMPORTANT: always respond with the same generic message whether or not
    // the user exists — this avoids leaking which emails are registered.
    const genericResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.'
    };
    console.log('User found for forgot password:', user ? user._id : 'No user found');
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Generate a random token; store only its HASH in the DB.
    // The raw token is what goes in the email link — this way, even if the
    // DB is compromised, the stored value can't be used as a working token.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

    try {
      console.log(`Attempting to send password reset email to ${user.email} with reset URL: ${resetUrl}`);
      await sendEmail({
        to: user.email,
        subject: 'Password reset request',
        html: `
          <p>You requested a password reset.</p>
          <p><a href="${resetUrl}">Click here to reset your password</a> (expires in 30 minutes).</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `
      });
    } catch (emailErr) {
      // Don't leave a dangling token if the email failed to send
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      console.error('Failed to send reset email:', emailErr);
      return res.status(500).json({ message: 'Could not send reset email. Please try again later.' });
    }

    // Log reset request, matching the audit pattern used elsewhere in this controller
    await AuditService.logAction({
      userId: user._id,
      action: 'FORGOT_PASSWORD_REQUEST',
      resourceType: 'AUTH',
      req
    });

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again later.' });
  }
};

// POST /auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
    }

    // Assign the PLAIN password and let the pre('save') hook in User.js hash it —
    // same pattern as changePassword/resetFirstPassword above. Hashing it here too
    // (as the previous draft did) would double-hash it and lock the user out.
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.mustResetPassword = false;
    await user.save();

    await AuditService.logAction({
      userId: user._id,
      action: 'PASSWORD_RESET',
      resourceType: 'AUTH',
      req
    });

    return res.status(200).json({ message: 'Password has been reset successfully. Please log in.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again later.' });
  }
};
