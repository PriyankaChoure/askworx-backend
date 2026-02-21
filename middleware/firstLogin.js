const checkFirstLogin = (req, res, next) => {
  // Check if user is on first login
  if (req.user && req.user.isFirstLogin) {
    return res.status(403).json({
      message: 'First login password reset required',
      code: 'FIRST_LOGIN_RESET_REQUIRED',
      forcePasswordReset: true,
      userId: req.user._id
    });
  }
  next();
};

module.exports = checkFirstLogin;