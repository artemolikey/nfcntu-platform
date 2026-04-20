const { ALLOWED_EMAIL_DOMAIN } = require('../config/constants');

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function isCorporateEmail(email = '') {
  return normalizeEmail(email).endsWith(ALLOWED_EMAIL_DOMAIN);
}

function toOptionalString(value) {
  const text = String(value || '').trim();
  return text ? text : null;
}

module.exports = { normalizeEmail, isCorporateEmail, toOptionalString };
