// Ordnet ein Land einer Region zu (grobe Einteilung wie bei MSCI/Allokationsansichten).
const REGIONS = {
  'Nordamerika': ['United States', 'Canada', 'Mexico'],
  'Europa': [
    'Switzerland', 'Germany', 'France', 'United Kingdom', 'Netherlands', 'Sweden', 'Denmark',
    'Norway', 'Finland', 'Italy', 'Spain', 'Ireland', 'Belgium', 'Austria', 'Portugal',
    'Luxembourg', 'Poland', 'Greece', 'Czech Republic', 'Hungary', 'Iceland', 'Jersey', 'Guernsey',
    'Isle of Man', 'Liechtenstein', 'Monaco', 'Malta', 'Cyprus'
  ],
  'Asien-Pazifik': [
    'Japan', 'China', 'Hong Kong', 'Taiwan', 'South Korea', 'Singapore', 'India', 'Australia',
    'New Zealand', 'Indonesia', 'Thailand', 'Malaysia', 'Philippines', 'Vietnam', 'Macau'
  ],
  'Lateinamerika': ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Uruguay'],
  'Naher Osten & Afrika': ['Israel', 'South Africa', 'United Arab Emirates', 'Saudi Arabia', 'Egypt', 'Qatar', 'Turkey', 'Nigeria']
};

const LOOKUP = {};
for (const [region, countries] of Object.entries(REGIONS)) {
  for (const c of countries) LOOKUP[c] = region;
}

function regionFor(country) {
  if (!country) return null;
  return LOOKUP[country] || 'Andere';
}

module.exports = { regionFor };
