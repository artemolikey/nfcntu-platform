const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { ROLES } = require('../config/constants');
const { getLevelLabel } = require('../utils/levels');
const { normalizeEmail, toOptionalString } = require('../utils/validators');

async function findUserByEmail(email) {
  const result = await query(`SELECT u.*, s.title AS specialty_title, g.code AS group_code FROM users u LEFT JOIN specialties s ON s.id = u.specialty_id LEFT JOIN academic_groups g ON g.id = u.academic_group_id WHERE u.email = $1`, [normalizeEmail(email)]);
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await query(`SELECT u.*, s.title AS specialty_title, g.code AS group_code FROM users u LEFT JOIN specialties s ON s.id = u.specialty_id LEFT JOIN academic_groups g ON g.id = u.academic_group_id WHERE u.id = $1`, [id]);
  return result.rows[0] || null;
}

function buildSessionUser(user) {
  return { id: user.id, fullName: user.full_name, email: user.email, role: user.role, ratingAvg: Number(user.rating_avg || 0), reputationPoints: Number(user.reputation_points || 0), levelLabel: user.level_label };
}

async function createUser({ fullName, email, password, phone, role, specialtyId, academicGroupId, bio }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(`INSERT INTO users (full_name,email,password_hash,phone,role,specialty_id,academic_group_id,bio) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [fullName.trim(), normalizeEmail(email), passwordHash, toOptionalString(phone), role, specialtyId || null, academicGroupId || null, toOptionalString(bio)]);
  return result.rows[0];
}

async function verifyPassword(user, password) { return bcrypt.compare(password, user.password_hash); }

async function updateProfile(userId, { fullName, phone, specialtyId, academicGroupId, bio }) {
  const result = await query(`UPDATE users SET full_name = $2, phone = $3, specialty_id = $4, academic_group_id = $5, bio = $6 WHERE id = $1 RETURNING *`, [userId, fullName.trim(), toOptionalString(phone), specialtyId || null, academicGroupId || null, toOptionalString(bio)]);
  return result.rows[0];
}

async function getUserPortfolio(userId) {
  const result = await query(`SELECT p.*, o.id AS order_id, c.full_name AS customer_name FROM portfolio_entries p JOIN orders o ON o.id = p.order_id JOIN users c ON c.id = o.customer_id WHERE p.performer_id = $1 ORDER BY p.completed_at DESC`, [userId]);
  return result.rows;
}

async function getPerformerSummary(userId) {
  const [ordersResult, portfolioResult, reviewsResult] = await Promise.all([
    query(`SELECT COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress, COUNT(*) FILTER (WHERE status = 'needs_clarification')::int AS needs_clarification, COUNT(*) FILTER (WHERE status = 'completed')::int AS completed, COUNT(*)::int AS total FROM orders WHERE performer_id = $1`, [userId]),
    query('SELECT COUNT(*)::int AS count FROM portfolio_entries WHERE performer_id = $1', [userId]),
    query('SELECT COUNT(*)::int AS count FROM order_reviews WHERE performer_id = $1', [userId])
  ]);
  return { orderCounts: ordersResult.rows[0], portfolioCount: portfolioResult.rows[0].count, reviewCount: reviewsResult.rows[0].count };
}

async function getCustomerSummary(userId) {
  const result = await query(`SELECT COUNT(*) FILTER (WHERE status = 'new')::int AS new_count, COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress, COUNT(*) FILTER (WHERE status = 'needs_clarification')::int AS needs_clarification, COUNT(*) FILTER (WHERE status = 'completed')::int AS completed, COUNT(*)::int AS total FROM orders WHERE customer_id = $1`, [userId]);
  return result.rows[0];
}

async function getProfileView(userId) {
  const [user, portfolio, performerSummary, customerSummary] = await Promise.all([findUserById(userId), getUserPortfolio(userId), getPerformerSummary(userId), getCustomerSummary(userId)]);
  return { user, portfolio, performerSummary, customerSummary };
}

async function listUsers({ search = '', role = '', specialtyId = '', includeInactive = true } = {}) {
  const params = [];
  const conditions = [];
  if (search) { params.push(`%${search.trim()}%`); conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
  if (role) { params.push(role); conditions.push(`u.role = $${params.length}`); }
  if (specialtyId) { params.push(Number(specialtyId)); conditions.push(`u.specialty_id = $${params.length}`); }
  if (!includeInactive) conditions.push('u.is_active = TRUE');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.rating_avg, u.reputation_points, u.level_label, u.created_at, s.title AS specialty_title, g.code AS group_code FROM users u LEFT JOIN specialties s ON s.id = u.specialty_id LEFT JOIN academic_groups g ON g.id = u.academic_group_id ${where} ORDER BY u.created_at DESC, u.full_name ASC`, params);
  return result.rows;
}

async function toggleUserActive(userId) {
  const result = await query(`UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, full_name, is_active`, [userId]);
  return result.rows[0] || null;
}

async function refreshPerformerMetrics(performerId) {
  return withTransaction(async (client) => {
    const stats = await client.query(`SELECT COALESCE(AVG(rating),0) AS rating_avg, COALESCE(SUM(reputation_awarded),0) AS reputation_points FROM order_reviews WHERE performer_id = $1`, [performerId]);
    const ratingAvg = Number(stats.rows[0].rating_avg || 0);
    const reputationPoints = Number(stats.rows[0].reputation_points || 0);
    const result = await client.query(`UPDATE users SET rating_avg = $2, reputation_points = $3, level_label = $4 WHERE id = $1 RETURNING *`, [performerId, ratingAvg, reputationPoints, getLevelLabel(reputationPoints)]);
    return result.rows[0] || null;
  });
}

module.exports = { findUserByEmail, findUserById, buildSessionUser, createUser, verifyPassword, updateProfile, getProfileView, getUserPortfolio, getPerformerSummary, getCustomerSummary, listUsers, toggleUserActive, refreshPerformerMetrics };
