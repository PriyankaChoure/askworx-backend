const User = require('../models/User');
const UserSubscription = require('../models/UserSubscription');
const ProjectMaster = require('../models/ProjectMaster');
const { filterDataBySubscription } = require('../middleware/subscription');
const SubscriptionHelperService = require('../services/subscriptionHelperService');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('role').populate('subscription');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, req.body, { new: true });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSubscription = async (req, res) => {
  try {
    const subscription = await UserSubscription.findOne({ user: req.user._id, isActive: true }).populate(['plan', 'allowedStates', 'allowedSectors']);
    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    // Use subscription helper to get formatted summary with expiry info
    const formattedSummary = SubscriptionHelperService.getFormattedSubscriptionSummary(subscription);
    console.log('formattedSummary -', formattedSummary);
    res.json(formattedSummary);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const { states, months, sectors, page = 1, limit = 50 } = req.query;
    console.info('request-', states, sectors);
    // Build base filter
    const filter = { isActive: true };

    // Handle multi-select months (array)
    if (months) {
      const monthArray = Array.isArray(months) ? months : [months];
      if (monthArray.length > 0) {
        filter.sourceMonth = { $in: monthArray };
      }
    }

    // Handle multi-select sectors (array)
    if (sectors) {
      const sectorArray = Array.isArray(sectors) ? sectors : [sectors];
      if (sectorArray.length > 0) {
        filter.sector = { $in: sectorArray };
      }
    }

    // Handle multi-select states (array)
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      if (statesArray.length > 0) {
        filter.state = { $in: statesArray };
      }
    }
    console.info('filter -', filter);
    // // Handle single state filter
    // if (state) filter.state = state;
    // if (status) filter.status = status;

    // Get all projects matching filters
    const allProjects = await ProjectMaster
      .find(filter)
      .sort({ updatedAt: -1 });
    console.info('allProjects -', allProjects);
    // Apply subscription-based filtering (respects subscription rules)
    // const allProjects = filterDataBySubscription(allProjects, req.subscription);

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedProjects = allProjects.slice(skip, skip + parseInt(limit));

    // Get unique values for available filters
    const availableMonths = [...new Set(allProjects.map(p => p.sourceMonth).filter(Boolean))];
    const availableSectors = [...new Set(allProjects.map(p => p.sector).filter(Boolean))];

    // Group by sector and state for frontend
    const groupedProjects = {
      bySector: {},
      byState: {}
    };

    allProjects.forEach(project => {
      // Group by sector
      if (!groupedProjects.bySector[project.sector]) {
        groupedProjects.bySector[project.sector] = [];
      }
      groupedProjects.bySector[project.sector].push(project);

      // Group by state
      if (!groupedProjects.byState[project.state]) {
        groupedProjects.byState[project.state] = [];
      }
      groupedProjects.byState[project.state].push(project);
    });

    res.json({
      projects: paginatedProjects,
      groupedProjects,
      availableFilters: {
        months: availableMonths.sort().reverse(),
        sectors: availableSectors
      },
      total: allProjects.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allProjects.length,
        pages: Math.ceil(allProjects.length / limit)
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.exportProjectsToExcel = async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const { months, sectors } = req.query;

    // Build base filter
    const filter = { isActive: true };

    // Handle multi-select months
    if (months) {
      const monthArray = Array.isArray(months) ? months : [months];
      if (monthArray.length > 0) {
        filter.sourceMonth = { $in: monthArray };
      }
    }

    // Handle multi-select sectors
    if (sectors) {
      const sectorArray = Array.isArray(sectors) ? sectors : [sectors];
      if (sectorArray.length > 0) {
        filter.sector = { $in: sectorArray };
      }
    }

    // Get all projects matching filters
    const allProjects = await ProjectMaster
      .find(filter)
      .sort({ updatedAt: -1 });

    // Apply subscription-based filtering (enforces security)
    const filteredProjects = filterDataBySubscription(allProjects, req.subscription);

    // Define visible columns (read-only, safe to export)
    const visibleColumns = [
      'projectCode',
      'projectTitle',
      'sector',
      'state',
      'city',
      'country',
      'status',
      'projectValue',
      'product',
      'capacity',
      'placeOfWork',
      'projectDetails',
      'contactDetails',
      'contractor',
      'constructor',
      'architect',
      'updatedDate',
      'expectedCompletionDate',
      'sourceMonth'
    ];

    // Transform data for export (only safe fields)
    const exportData = filteredProjects.map(project => {
      const row = {};
      visibleColumns.forEach(col => {
        row[col] = project[col] || '';
      });
      return row;
    });

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');

    // Set column widths for better readability
    const colWidths = visibleColumns.map(() => 15);
    ws['!cols'] = colWidths.map(width => ({ wch: width }));

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `projects_export_${timestamp}.xlsx`;

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    res.send(buffer);

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Failed to generate Excel file' });
  }
};