// const bcrypt = require("bcryptjs");
const User = require("../models/User"); // adjust path if needed
const Role = require("../models/Role");

module.exports = async () => {
  try {
    console.log("🌱 Seeding Admin and roles...");

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
    // CHECK FOR EXISTING ADMIN
    const existingAdmin = await User.findOne({
      email: "admin@askworx.com"
    });

    if (!existingAdmin) {
    //   const hashedPassword = await bcrypt.hash("Admin@123", 10);

      await User.create({
        username: 'admin',
        name: "Super Administrator",
        email: "admin@askworx.com",
        password: "Admin@123",
        role: superAdminRole._id,
        mustResetPassword: false,
        isFirstLogin: false,
      });

      console.log("✅ Admin and roles created");
    } else {
      console.log("ℹ️ Admin already exists");
    }

  } catch (error) {
    console.error("❌ Error in Admin Seed:", error);
    throw error;
  }
};
