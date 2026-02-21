require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Create roles
    const superAdminRole = await Role.findOneAndUpdate(
      { name: 'Super Admin' },
      { name: 'Super Admin', permissions: ['all'] },
      { upsert: true, new: true }
    );

    const userRole = await Role.findOneAndUpdate(
      { name: 'User' },
      { name: 'User', permissions: ['read'] },
      { upsert: true, new: true }
    );

    // Create super admin user
    const hashedPassword = await bcrypt.hash('Admin123', 12);
    const superAdmin = await User.findOneAndUpdate(
      { username: 'admin' },
      {
        name: 'Super Administrator',
        username: 'admin',
        email: 'admin@askworx.com',
        password: hashedPassword,
        role: superAdminRole._id,
        mustResetPassword: false,
        isFirstLogin: false,
      },
      { upsert: true, new: true }
    );

    // Create sample plans
    const plan1 = await SubscriptionPlan.findOneAndUpdate(
      { name: 'State Plan' },
      {
        name: 'State Plan',
        description: 'Access to one selected state',
        planType: 'PLAN_1',
        features: ['Access to 1 state', 'All sectors'],
        limits: { projects: 100, downloads: 10 },
        duration: 12,
        price: 5000,
      },
      { upsert: true, new: true }
    );

    const plan2 = await SubscriptionPlan.findOneAndUpdate(
      { name: 'Multi-State Plan' },
      {
        name: 'Multi-State Plan',
        description: 'Access to multiple selected states',
        planType: 'PLAN_2',
        features: ['Access to multiple states', 'All sectors'],
        limits: { projects: -1, downloads: -1 },
        duration: 12,
        price: 10000,
      },
      { upsert: true, new: true }
    );

    const plan3 = await SubscriptionPlan.findOneAndUpdate(
      { name: 'Pan India Plan' },
      {
        name: 'Pan India Plan',
        description: 'Access to all states and sectors',
        planType: 'PLAN_3',
        features: ['Pan India access', 'All sectors', 'Priority support'],
        limits: { projects: -1, downloads: -1 },
        duration: 12,
        price: 20000,
      },
      { upsert: true, new: true }
    );

    console.log('Seed data created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();