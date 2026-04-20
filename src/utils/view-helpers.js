const { ROLE_LABELS, ORDER_STATUS_LABELS } = require('../config/constants');

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

function initials(name = '') {
  return String(name).split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function roleLabel(value) { return ROLE_LABELS[value] || value; }
function statusLabel(value) { return ORDER_STATUS_LABELS[value] || value; }

module.exports = { formatDate, formatDateTime, initials, roleLabel, statusLabel };
