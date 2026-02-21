// Excel Import Utility
// Handles parsing and importing Excel files for project master data

const XLSX = require('xlsx');
const { mapIndustryToSector } = require('./sectorMapper');
const MasterDataValidationService = require('../services/masterDataValidationService');
const StateMaster = require('../models/StateMaster');

/**
 * Column mapping from Excel headers to database fields
 */
const COLUMN_MAPPING = {
  'P-Code': 'projectCode',
  'Project Title': 'projectTitle',
  'Industry': 'industryRaw',
  'Project Value': 'projectValue',
  'Status of the Project': 'status',
  'Product': 'product',
  'Country': 'country',
  'State': 'state',
  'City': 'city',
  'Capacity': 'capacity',
  'Place of Work': 'placeOfWork',
  'Project Details': 'projectDetails',
  'Contact Details': 'contactDetails',
  'Contractor': 'contractor',
  'Constructor': 'constructor',
  'Architect': 'architect',
  'Updated Date': 'updatedDate',
  'EDC': 'expectedCompletionDate'
};

/**
 * Validates if a row has required data
 * @param {Object} row - Excel row data
 * @param {Array} validStates - Array of valid state objects from master data
 * @returns {Object} - { isValid: boolean, reason: string }
 */
const validateRow = (row, validStates) => {
  if (!row.projectCode || row.projectCode.trim() === '') {
    return { isValid: false, reason: 'Missing project code' };
  }

  // Check if state is valid against master data
  if (row.state) {
    const stateName = row.state.trim();
    const isValidState = validStates.some(state => 
      state.name.toLowerCase() === stateName.toLowerCase()
    );
    if (!isValidState) {
      return { isValid: false, reason: `Invalid state: ${row.state}. Please create this state in Settings before importing.` };
    }
  }

  return { isValid: true };
};

/**
 * Normalizes and trims string values
 * @param {*} value - Value to normalize
 * @returns {string|null} - Normalized string or null
 */
const normalizeString = (value) => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
};

/**
 * Parses date from Excel format
 * @param {*} dateValue - Excel date value
 * @returns {Date|null} - Parsed date or null
 */
const parseDate = (dateValue) => {
  if (!dateValue) return null;

  // Handle Excel date serial numbers
  if (typeof dateValue === 'number') {
    // Excel dates start from 1900-01-01 (serial number 1)
    const excelEpoch = new Date(1900, 0, 1);
    const days = dateValue - 1; // Excel incorrectly treats 1900 as leap year
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // Handle string dates
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

/**
 * Maps Excel row to database document
 * @param {Object} excelRow - Raw Excel row data
 * @param {string} sourceMonth - Source month (e.g., "Jan-2025")
 * @returns {Object} - Mapped database document
 */
const mapRowToDocument = (excelRow, sourceMonth) => {
  const document = {};

  // Map columns using COLUMN_MAPPING
  Object.entries(COLUMN_MAPPING).forEach(([excelHeader, dbField]) => {
    const value = excelRow[excelHeader];

    if (dbField === 'updatedDate' || dbField === 'expectedCompletionDate') {
      document[dbField] = parseDate(value);
    } else {
      document[dbField] = normalizeString(value);
    }
  });

  // Derive sector from industry
  document.sector = mapIndustryToSector(document.industryRaw);

  // Add system fields
  document.sourceMonth = sourceMonth;
  document.isActive = true;

  return document;
};

/**
 * Parses Excel file and returns processed data
 * @param {Buffer} fileBuffer - Excel file buffer
 * @param {string} sourceMonth - Source month identifier
 * @returns {Promise<Object>} - { success: boolean, data: Array, errors: Array, summary: Object }
 */
const parseExcelFile = async (fileBuffer, sourceMonth) => {
  try {
    // Fetch all active states from master data for validation
    const validStates = await StateMaster.find({ isActive: true }, 'name').lean();
    
    // Read workbook
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Use first row as headers
      defval: null // Default value for empty cells
    });

    if (rawData.length < 2) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, reason: 'Excel file must contain at least a header row and one data row' }],
        summary: { total: 0, valid: 0, invalid: 1 }
      };
    }

    // Extract headers and data
    const headers = rawData[0];
    const dataRows = rawData.slice(1);

    const processedData = [];
    const errors = [];
    let validCount = 0;
    let invalidCount = 0;

    // Process each data row
    dataRows.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because Excel rows start at 1 and we have headers

      // Convert array row to object using headers
      const rowObject = {};
      headers.forEach((header, colIndex) => {
        rowObject[header] = row[colIndex];
      });

      // Check if row is empty (all values are null/undefined/empty)
      const isEmptyRow = Object.values(rowObject).every(value =>
        value === null || value === undefined || String(value).trim() === ''
      );

      if (isEmptyRow) {
        return; // Skip empty rows
      }

      // Map row to document
      const document = mapRowToDocument(rowObject, sourceMonth);
      // Validate row using master data
      const validation = validateRow(document, validStates);
      if (validation.isValid) {
        processedData.push(document);
        validCount++;
      } else {
        errors.push({
          row: rowNumber,
          sector: document.sector,
          projectCode: document.projectCode,
          reason: validation.reason
        });
        invalidCount++;
      }
    });

    return {
      success: true,
      data: processedData,
      errors,
      summary: {
        total: dataRows.length,
        valid: validCount,
        invalid: invalidCount
      }
    };

  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, reason: `Failed to parse Excel file: ${error.message}` }],
      summary: { total: 0, valid: 0, invalid: 1 }
    };
  }
};

module.exports = {
  parseExcelFile,
  COLUMN_MAPPING
};