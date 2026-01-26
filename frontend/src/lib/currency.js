// Currency configuration and utility functions

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  OMR: { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', locale: 'ar-OM' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  PKR: { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', locale: 'en-PK' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  SAR: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', locale: 'ar-SA' },
};

export const DEFAULT_CURRENCY = 'USD';

/**
 * Format amount with currency
 * @param {number} amount - The amount to format
 * @param {string} currencyCode - The currency code (USD, OMR, AED, INR, etc.)
 * @param {object} options - Additional formatting options
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currencyCode = DEFAULT_CURRENCY, options = {}) {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.USD;
  
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
      ...options
    }).format(amount || 0);
  } catch (e) {
    // Fallback formatting
    return `${currency.symbol} ${(amount || 0).toLocaleString()}`;
  }
}

/**
 * Get currency symbol
 * @param {string} currencyCode - The currency code
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(currencyCode = DEFAULT_CURRENCY) {
  return CURRENCIES[currencyCode]?.symbol || '$';
}

/**
 * Get all available currencies as array for dropdowns
 * @returns {Array} Array of currency objects
 */
export function getCurrencyOptions() {
  return Object.values(CURRENCIES);
}

/**
 * Parse currency amount from formatted string
 * @param {string} formattedAmount - Formatted currency string
 * @returns {number} Parsed amount
 */
export function parseCurrencyAmount(formattedAmount) {
  if (typeof formattedAmount === 'number') return formattedAmount;
  // Remove currency symbols and formatting
  const cleanedString = formattedAmount.replace(/[^0-9.-]+/g, '');
  return parseFloat(cleanedString) || 0;
}

/**
 * Convert amount between currencies (mock implementation - would need real rates)
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {number} Converted amount
 */
export function convertCurrency(amount, fromCurrency, toCurrency) {
  // Mock exchange rates (in a real app, these would come from an API)
  const rates = {
    USD: 1,
    OMR: 0.385,
    AED: 3.67,
    INR: 83.12,
    PKR: 278.50,
    EUR: 0.92,
    GBP: 0.79,
    SAR: 3.75,
  };
  
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  
  // Convert to USD first, then to target currency
  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
}

export default {
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatCurrency,
  getCurrencySymbol,
  getCurrencyOptions,
  parseCurrencyAmount,
  convertCurrency,
};
