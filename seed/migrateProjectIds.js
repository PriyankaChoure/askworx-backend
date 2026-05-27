/**
 * Migration script to populate stateId and sectorId for existing projects
 * Run this once to backfill the new ID fields
 */

const mongoose = require('mongoose');
const ProjectMaster = require('../models/ProjectMaster');
const StateMaster = require('../models/StateMaster');
const SectorMaster = require('../models/SectorMaster');
const config = require('../config/db');

const migrateProjectIds = async () => {
  try {
    // Connect to database
    console.log('Connecting to database...');
    await mongoose.connect(config.mongoURI);
    console.log('Connected to database');

    // Find all projects
    const projects = await ProjectMaster.find({}).lean();
    console.log(`Found ${projects.length} projects to migrate`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Create lookup maps for faster processing
    console.log('Creating lookup maps...');
    const statesMap = new Map();
    const sectorsMap = new Map();

    const states = await StateMaster.find({ isActive: true }).lean();
    states.forEach(state => {
      statesMap.set(state.name.toLowerCase(), state._id);
    });

    const sectors = await SectorMaster.find({ isActive: true }).lean();
    sectors.forEach(sector => {
      sectorsMap.set(sector.name.toLowerCase(), sector._id);
    });

    console.log(`State map has ${statesMap.size} entries`);
    console.log(`Sector map has ${sectorsMap.size} entries`);

    // Process each project
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const updateData = {};
      let needsUpdate = false;

      // Check and update stateId
      if (project.state && !project.stateId) {
        const stateId = statesMap.get(project.state.toLowerCase());
        if (stateId) {
          updateData.stateId = stateId;
          needsUpdate = true;
        } else {
          console.warn(`State not found in master: "${project.state}" (project: ${project.projectCode})`);
          skippedCount++;
          continue;
        }
      }

      // Check and update sectorId
      if (project.sector && !project.sectorId) {
        const sectorId = sectorsMap.get(project.sector.toLowerCase());
        if (sectorId) {
          updateData.sectorId = sectorId;
          needsUpdate = true;
        } else {
          console.warn(`Sector not found in master: "${project.sector}" (project: ${project.projectCode})`);
          skippedCount++;
          continue;
        }
      }

      // Update if needed
      if (needsUpdate) {
        try {
          await ProjectMaster.findByIdAndUpdate(project._id, updateData);
          updatedCount++;
          
          // Log progress every 100 records
          if ((updatedCount + skippedCount) % 100 === 0) {
            console.log(`Progress: ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`);
          }
        } catch (error) {
          console.error(`Error updating project ${project.projectCode}:`, error.message);
          errorCount++;
        }
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total projects: ${projects.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

    // Verify migration
    const projectsWithIds = await ProjectMaster.countDocuments({ 
      stateId: { $exists: true, $ne: null },
      sectorId: { $exists: true, $ne: null }
    });
    console.log(`\nProjects with both IDs populated: ${projectsWithIds}`);

    await mongoose.connection.close();
    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateProjectIds();
