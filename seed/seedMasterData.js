/**
 * Seed script for master data (States and Sectors)
 * This populates the database with initial states and sectors
 * 
 * Usage: node backend/seed-master-data.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const StateMaster = require('../models/StateMaster');
const SectorMaster = require('../models/SectorMaster');

// Initial states to seed
const statesToSeed = [
  { name: 'Andhra Pradesh', code: 'AP' },
  { name: 'Arunachal Pradesh', code: 'AR' },
  { name: 'Assam', code: 'AS' },
  { name: 'Bihar', code: 'BR' },
  { name: 'Chhattisgarh', code: 'CT' },
  { name: 'Goa', code: 'GA' },
  { name: 'Gujarat', code: 'GJ' },
  { name: 'Haryana', code: 'HR' },
  { name: 'Himachal Pradesh', code: 'HP' },
  { name: 'Jharkhand', code: 'JH' },
  { name: 'Karnataka', code: 'KA' },
  { name: 'Kerala', code: 'KL' },
  { name: 'Madhya Pradesh', code: 'MP' },
  { name: 'Maharashtra', code: 'MH' },
  { name: 'Manipur', code: 'MN' },
  { name: 'Meghalaya', code: 'ML' },
  { name: 'Mizoram', code: 'MZ' },
  { name: 'Nagaland', code: 'NL' },
  { name: 'Odisha', code: 'OD' },
  { name: 'Punjab', code: 'PB' },
  { name: 'Rajasthan', code: 'RJ' },
  { name: 'Sikkim', code: 'SK' },
  { name: 'Tamil Nadu', code: 'TN' },
  { name: 'Telangana', code: 'TG' },
  { name: 'Tripura', code: 'TR' },
  { name: 'Uttar Pradesh', code: 'UP' },
  { name: 'Uttarakhand', code: 'UT' },
  { name: 'West Bengal', code: 'WB' }
];

// Initial sectors to seed
const sectorsToSeed = [  
  { name: 'Industrial' },
  { name: 'Residential & Commercial' },
  { name: 'Govt' },
];

module.exports = async () => {
  try {
    console.log("🌱 Seeding Master Data...");

    // your existing seed logic here
    // Check if data already exists
    const stateCount = await StateMaster.countDocuments();
    const sectorCount = await SectorMaster.countDocuments();

    if (stateCount > 0 || sectorCount > 0) {
      console.log('⚠ Master data already exists in database:');
      console.log(`  - States: ${stateCount}`);
      console.log(`  - Sectors: ${sectorCount}`);
      console.log('  Skipping seed operation');
      // process.exit(0);
    } else {

      // Seed states
      console.log('\n📍 Seeding States...');
      const createdStates = await StateMaster.insertMany(statesToSeed, { ordered: false });
      console.log(`✓ Created ${createdStates.length} states`);

      // Seed sectors
      console.log('\n🏭 Seeding Sectors...');
      const createdSectors = await SectorMaster.insertMany(sectorsToSeed, { ordered: false });
      console.log(`✓ Created ${createdSectors.length} sectors`);

      console.log('\n✅ Master data seeding completed successfully!');
      console.log(`\nSummary:`);
      console.log(`  Total States: ${createdStates.length}`);
      console.log(`  Total Sectors: ${createdSectors.length}`);

      console.log("✅ Master Data Seeded");
    }
  } catch (error) {
    console.error("❌ Error in Master Data Seed:", error);
    throw error;
  }
};