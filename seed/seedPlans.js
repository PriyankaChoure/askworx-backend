const SubscriptionPlan = require("../models/SubscriptionPlan");

module.exports = async () => {
  try {
    console.log("🌱 Seeding Plans Master Data...");

    // your existing seed logic here
    // Create sample plans
        const plan1 = await SubscriptionPlan.findOneAndUpdate(
          { name: 'One State Plan' },
          {
            name: 'One State Plan',
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

    console.log("✅ Plans Master Data Seeded");
  } catch (error) {
    console.error("❌ Error in Master Data Seed:", error);
    throw error;
  }
};
