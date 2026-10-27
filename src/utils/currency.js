/**
 * Currency utilities for INR calculations in whole paise (avoiding floating point errors)
 */

// Convert INR Rupees to whole Paise (e.g. 499.50 -> 49950)
const rupeesToPaise = (rupees) => {
  if (typeof rupees !== 'number' || isNaN(rupees)) {
    throw new Error('Invalid rupee amount');
  }
  return Math.round(rupees * 100);
};

// Convert Paise to INR Rupees decimal (e.g. 49950 -> 499.50)
const paiseToRupees = (paise) => {
  if (typeof paise !== 'number' || isNaN(paise)) {
    return 0;
  }
  return Number((paise / 100).toFixed(2));
};

// Format paise into a localized INR display string (e.g. 49950 -> "₹499.50")
const formatInr = (paise) => {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(rupees);
};

module.exports = {
  rupeesToPaise,
  paiseToRupees,
  formatInr
};
