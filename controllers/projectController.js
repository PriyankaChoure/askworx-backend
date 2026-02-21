const ProjectMaster = require('../models/ProjectMaster');
const { mapIndustryToSector } = require('../utils/sectorMapper');
const { SECTORS } = require('../utils/constants');
const { parseExcelFile } = require('../utils/excelImporter');

// Admin: Get all projects with filters
exports.getProjects = async (req, res) => {
  try {
    const {
      sector,
      state,
      status,
      month,
      page = 1,
      limit = 50
    } = req.query;

    const filter = { isActive: true };

    if (sector && Object.values(SECTORS).includes(sector)) {
      filter.sector = sector;
    }
    if (state) {
      filter.state = state;
    }
    if (status) {
      filter.status = status;
    }
    if (month) {
      filter.sourceMonth = month;
    }

    const skip = (page - 1) * limit;

    const projects = await ProjectMaster
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ProjectMaster.countDocuments(filter);

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Get single project
exports.getProject = async (req, res) => {
  try {
    const project = await ProjectMaster.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Create project
exports.createProject = async (req, res) => {
  try {
    const projectData = { ...req.body };

    // Map industry to sector if not provided
    if (!projectData.sector && projectData.industryRaw) {
      projectData.sector = mapIndustryToSector(projectData.industryRaw);
    }

    // Validate sector
    if (!Object.values(SECTORS).includes(projectData.sector)) {
      return res.status(400).json({ message: 'Invalid sector' });
    }

    const project = new ProjectMaster(projectData);
    await project.save();

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Project code already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Update project
exports.updateProject = async (req, res) => {
  try {
    const projectData = { ...req.body };

    // Map industry to sector if industryRaw changed and sector not provided
    if (projectData.industryRaw && !projectData.sector) {
      projectData.sector = mapIndustryToSector(projectData.industryRaw);
    }

    // Validate sector if provided
    if (projectData.sector && !Object.values(SECTORS).includes(projectData.sector)) {
      return res.status(400).json({ message: 'Invalid sector' });
    }

    const project = await ProjectMaster.findByIdAndUpdate(
      req.params.id,
      projectData,
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Project code already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Toggle project active status
exports.toggleProjectStatus = async (req, res) => {
  try {
    const project = await ProjectMaster.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.isActive = !project.isActive;
    await project.save();

    res.json({
      message: `Project ${project.isActive ? 'activated' : 'deactivated'}`,
      project
    });
  } catch (error) {
    console.error('Toggle project status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Get filter options
exports.getFilterOptions = async (req, res) => {
  try {
    const sectors = await ProjectMaster.distinct('sector', { isActive: true });
    const states = await ProjectMaster.distinct('state', { isActive: true });
    const statuses = await ProjectMaster.distinct('status', { isActive: true });
    const months = await ProjectMaster.distinct('sourceMonth', { isActive: true });

    res.json({
      sectors,
      states,
      statuses,
      months
    });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Import projects from Excel
exports.importProjects = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { sourceMonth } = req.body;
    if (!sourceMonth) {
      return res.status(400).json({ message: 'Source month is required' });
    }

    // Validate file type
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Only Excel files are allowed' });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res.status(400).json({ message: 'File size must be less than 10MB' });
    }

    // Parse Excel file
    const parseResult = await parseExcelFile(req.file.buffer, sourceMonth);
    console.log('Parse Result:', parseResult);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Failed to parse Excel file',
        errors: parseResult.errors
      });
    }

    const { data: projectsData, errors: parseErrors } = parseResult;

    if (projectsData.length === 0) {
      return res.status(400).json({
        message: 'No valid data found in Excel file',
        errors: parseErrors
      });
    }

    // Import statistics
    let inserted = 0;
    let updated = 0;
    let skipped = parseErrors.length;
    const importErrors = [...parseErrors];

    // Process each project (upsert logic)
    for (const projectData of projectsData) {
      try {
        const existingProject = await ProjectMaster.findOne({
          projectCode: projectData.projectCode
        });

        if (existingProject) {
          // Update existing project
          await ProjectMaster.findByIdAndUpdate(
            existingProject._id,
            {
              ...projectData,
              updatedAt: new Date()
            },
            { runValidators: true }
          );
          updated++;
        } else {
          // Create new project
          const newProject = new ProjectMaster(projectData);
          await newProject.save();
          inserted++;
        }
      } catch (error) {
        // Log individual row errors but continue processing
        importErrors.push({
          row: 'N/A',
          projectCode: projectData.projectCode,
          reason: `Database error: ${error.message}`
        });
        skipped++;
      }
    }

    // Return import summary
    res.json({
      message: 'Import completed',
      summary: {
        totalRows: parseResult.summary.total,
        processed: inserted + updated,
        inserted,
        updated,
        skipped,
        errors: importErrors.length
      },
      errors: importErrors.slice(0, 50) // Limit error details to first 50
    });

  } catch (error) {
    console.error('Import projects error:', error);
    res.status(500).json({ message: 'Server error during import' });
  }
};