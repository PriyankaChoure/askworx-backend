require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

// 🔐 Prevent seeding in production
if (process.env.NODE_ENV === "production") {
  console.log("❌ Seeding is disabled in production");
  process.exit(1);
}

const runSeed = async () => {
  try {
    console.log("🌱 Starting seeding process...");
    const conn = await connectDB();
    // console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Import seed files
    await require("./seedMasterData")();
    await require("./seedAdmin")();
    await require("./seedPlans")();

    console.log("🎉 Seeding completed successfully");
    process.exit();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

runSeed();
