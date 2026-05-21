const User = require('../models/User');
const Role = require('../models/Role');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const AuditLog = require('../models/AuditLog');
const MasterDataValidationService = require('../services/masterDataValidationService');

const normalizeDateInput = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return new Date(value);
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .populate('role')
      .populate({
        path: 'subscription',
        populate: {
          path: 'plan',
          model: 'SubscriptionPlan'
        }
      })
      .select('-password'); // Exclude password from response

    // Format the response for the frontend
    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role?.name || 'User',
      subscriptionPlan: user.subscription?.plan?.name || null,
      isFreeSubscriber: user.isFreeSubscriber || false,
      status: user.isActive ? 'active' : 'inactive',
      createdAt: user.createdAt,
      subscriptionEndDate: user.subscription?.endDate || null
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, role, subscriptionPlan, allowedSectors, allowedStates, username, password, isFreeSubscriber } = req.body;
    const subscriptionPayload = req.body.subscription || {};
    const startDate = subscriptionPayload.startDate || req.body.startDate;
    const endDate = subscriptionPayload.endDate || req.body.endDate;
    console.info('Received create user request with data:', {
      name,
      email,
      subscriptionPayload,
    });
    // Find the role
    const userRole = await Role.findOne({ name: role === 'admin' ? 'Super Admin' : 'User' });
    if (!userRole) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = new User({
      name,
      username,
      email,
      password,
      role: userRole._id,
    });

    await user.save();

    // Assign subscription if provided
    if (subscriptionPlan || isFreeSubscriber) {
      // admin may supply a paid plan, or mark the user as free/trial
      const plan = subscriptionPlan ? await SubscriptionPlan.findById(subscriptionPlan) : null;

      const now = new Date();
      const start = startDate ? normalizeDateInput(startDate) : now;
      const end = endDate
        ? normalizeDateInput(endDate)
        : plan
        ? new Date(new Date(start).setMonth(start.getMonth() + plan.duration))
        : start;
      console.info('Calculated subscription dates:', { start, end });
      let isPanIndia = false;
      switch (plan && plan.planType) {
        case 'PLAN_3':
          isPanIndia = true;
          break;
        default:
          break;
      }

      const activeSectors = await MasterDataValidationService.getActiveSectors();
      const defaultSectors = activeSectors.map(s => s._id);

      const subscription = new UserSubscription({
        user: user._id,
        plan: subscriptionPlan || null,
        fromDate: start,
        toDate: end,
        startDate: start,
        endDate: end,
        paymentStatus: 'paid',
        allowedStates,
        allowedSectors: allowedSectors || defaultSectors,
        isPanIndia,
        isTrial: !!isFreeSubscriber,
        isActive: true,
      });

      await subscription.save();
      user.subscription = subscription._id;
      if (isFreeSubscriber) user.isFreeSubscriber = true;
      await user.save();
    }

    // Log user creation
    await AuditLog.create({
      user: req.user._id,
      action: 'create_user',
      resource: 'user',
      details: { createdUserId: user._id },
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.mustResetPassword = true;
    user.password = 'TempPass123!'; // Generate a temp password
    await user.save();
    res.json({ message: 'Password reset initiated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const plan = new SubscriptionPlan(req.body);
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deactivatePlan = async (req, res) => {
  try {
    await SubscriptionPlan.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Plan deactivated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.assignPlan = async (req, res) => {
  try {
    const {
      userId,
      planId,
      allowedStates,
      allowedSectors,
      isPanIndia,
      startDate,
      endDate,
      isTrial // front-end may supply a flag instead of using a "trial" plan record
    } = req.body;

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan && !isTrial) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // validate rules only if a normal paid plan
    const SubscriptionService = require('../services/subscriptionService');
    if (!isTrial) {
      SubscriptionService.validateSubscriptionRules(plan.planType, allowedStates || [], isPanIndia || false);
    }

    // date range validation
    const now = new Date();
    const start = startDate ? new Date(startDate) : now;
    const end = endDate ? new Date(endDate) : new Date(start);

    if (end < start) {
      return res.status(400).json({ message: 'endDate must be after startDate' });
    }

    // default duration when not provided (e.g. trial may pass explicit range)
    if (!toDate && plan) {
      end.setMonth(start.getMonth() + plan.duration);
    }

    // Get active sectors for default
    const activeSectors = await MasterDataValidationService.getActiveSectors();
    const defaultSectors = activeSectors.map(s => s._id);

    const subscriptionData = {
      user: userId,
      plan: planId || null,
      fromDate: start,
      toDate: end,
      startDate: start,
      endDate: end,
      paymentStatus: 'paid',
      allowedStates: allowedStates || [],
      allowedSectors: allowedSectors || defaultSectors,
      isPanIndia: isPanIndia || false,
      isTrial: !!isTrial
    };

    const subscription = new UserSubscription(subscriptionData);
    await subscription.save();

    // update user record
    const userUpdates = { subscription: subscription._id };
    if (isTrial) userUpdates.isFreeSubscriber = true;
    await User.findByIdAndUpdate(userId, userUpdates);

    res.json({ message: 'Plan assigned successfully' });
  } catch (error) {
    console.error('Assign plan error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().populate('user').sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeSubscriptions = await UserSubscription.countDocuments({
      endDate: { $gte: new Date() },
      paymentStatus: 'paid'
    });
    const expiredSubscriptions = await UserSubscription.countDocuments({
      endDate: { $lt: new Date() }
    });

    // New users this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    res.json({
      totalUsers,
      activeSubscriptions,
      expiredSubscriptions,
      newUsersThisMonth
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get subscription plans (alias for getPlans)
exports.getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Disable/Enable user
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'disable' or 'enable'

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = action === 'enable';
    await user.save();

    // Log the action
    await AuditLog.create({
      user: req.user._id,
      action: `${action}_user`,
      details: `User ${user.username} ${action}d`
    });

    res.json({ message: `User ${action}d successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};