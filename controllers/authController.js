const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionHelperService = require('../services/subscriptionHelperService');

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
    console.log('Login attempt for user:', username, password);
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username }).populate('role');
    console.log('User found:', user ? user : 'none');
    const isMatch = user ? await user.comparePassword(password) : false;
    console.log('Password match:', isMatch);
    if (!user || !isMatch) {
      // Log failed attempt
      await AuditLog.create({
        user: user ? user._id : null,
        action: 'login_failed',
        resource: 'auth',
        details: { username },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
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
    await AuditLog.create({
      user: user._id,
      action: 'login',
      resource: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role.name,
        mustResetPassword: user.mustResetPassword,
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
    await AuditLog.create({
      user: user._id,
      action: 'change_password',
      resource: 'auth',
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
    await AuditLog.create({
      user: user._id,
      action: 'first_password_reset',
      resource: 'auth',
      details: { firstLogin: true },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
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
    await AuditLog.create({
      user: req.user._id,
      action: 'logout',
      resource: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};