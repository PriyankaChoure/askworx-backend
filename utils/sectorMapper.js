/**
 * Maps industry names to sector names for Excel import
 * Returns the sector name as a string, which will be matched against
 * active sectors from the master data during validation
 */
const SECTOR_NAMES = {
  INDUSTRIAL: 'Industrial',
  RESIDENTIAL_COMMERCIAL: 'Residential & Commercial',
  GOVERNMENT: 'Government'
};

const mapIndustryToSector = (industry) => {
  if (!industry) return SECTOR_NAMES.INDUSTRIAL; // default

  const industryLower = industry.toLowerCase();

  // Government sector keywords
  if (industryLower.includes('government') ||
      industryLower.includes('govt') ||
      industryLower.includes('public') ||
      industryLower.includes('municipal') ||
      industryLower.includes('railway') ||
      industryLower.includes('airport') ||
      industryLower.includes('hospital') ||
      industryLower.includes('school') ||
      industryLower.includes('university') ||
      industryLower.includes('defense')) {
    return SECTOR_NAMES.GOVERNMENT;
  }

  // Residential & Commercial sector keywords
  if (industryLower.includes('residential') ||
      industryLower.includes('commercial') ||
      industryLower.includes('housing') ||
      industryLower.includes('apartment') ||
      industryLower.includes('office') ||
      industryLower.includes('mall') ||
      industryLower.includes('retail') ||
      industryLower.includes('hotel') ||
      industryLower.includes('restaurant') ||
      industryLower.includes('shopping')) {
    return SECTOR_NAMES.RESIDENTIAL_COMMERCIAL;
  }

  // Industrial sector (default for manufacturing, power, etc.)
  if (industryLower.includes('industrial') ||
      industryLower.includes('manufacturing') ||
      industryLower.includes('power') ||
      industryLower.includes('energy') ||
      industryLower.includes('chemical') ||
      industryLower.includes('petrochemical') ||
      industryLower.includes('steel') ||
      industryLower.includes('cement') ||
      industryLower.includes('mining') ||
      industryLower.includes('infrastructure')) {
    return SECTOR_NAMES.INDUSTRIAL;
  }

  // Default to Industrial if no match
  return SECTOR_NAMES.INDUSTRIAL;
};

module.exports = {
  mapIndustryToSector
};