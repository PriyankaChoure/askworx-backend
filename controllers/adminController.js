const User = require('../models/User');
const Role = require('../models/Role');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const AuditLog = require('../models/AuditLog');
const MasterDataValidationService = require('../services/masterDataValidationService');

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
    const { name, email, role, subscriptionPlan, allowedSectors, allowedStates, username, password } = req.body;

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
    if (subscriptionPlan) {
      const plan = await SubscriptionPlan.findById(subscriptionPlan);
      if (plan) {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + plan.duration);

        // let allowedStates = [];
        let isPanIndia = false;
        // const activeSectors = await MasterDataValidationService.getActiveSectors();
        // const allowedSectors = activeSectors.map(s => s._id);

        // Set defaults based on plan type
        switch (plan.planType) {
          case 'PLAN_1':
            // For PLAN_1, admin needs to specify the state, but for now, leave empty
            break;
          case 'PLAN_2':
            // For PLAN_2, admin needs to specify states
            break;
          case 'PLAN_3':
            isPanIndia = true;
            break;
        }

        const subscription = new UserSubscription({
          user: user._id,
          plan: subscriptionPlan,
          endDate,
          paymentStatus: 'paid',
          allowedStates,
          allowedSectors,
          isPanIndia,
        });

        await subscription.save();
        user.subscription = subscription._id;
        await user.save();
      }
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
    const { userId, planId, allowedStates, allowedSectors, isPanIndia } = req.body;
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Validate subscription rules
    const SubscriptionService = require('../services/subscriptionService');
    SubscriptionService.validateSubscriptionRules(plan.planType, allowedStates || [], isPanIndia || false);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.duration);

    // Get active sectors for default
    const activeSectors = await MasterDataValidationService.getActiveSectors();
    const defaultSectors = activeSectors.map(s => s._id);

    const subscription = new UserSubscription({
      user: userId,
      plan: planId,
      endDate,
      paymentStatus: 'paid',
      allowedStates: allowedStates || [],
      allowedSectors: allowedSectors || defaultSectors,
      isPanIndia: isPanIndia || false,
    });

    await subscription.save();

    await User.findByIdAndUpdate(userId, { subscription: subscription._id });

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