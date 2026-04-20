const { query } = require('../db');

async function getAdminOverview() {
  const [statsResult, recentUsersResult, recentOrdersResult, specialtyStatsResult] = await Promise.all([
    query(`SELECT (SELECT COUNT(*)::int FROM users) AS users_total, (SELECT COUNT(*)::int FROM users WHERE is_active = TRUE) AS active_users, (SELECT COUNT(*)::int FROM orders) AS orders_total, (SELECT COUNT(*)::int FROM orders WHERE status = 'completed') AS completed_orders`),
    query(`SELECT u.id,u.full_name,u.email,u.role,u.is_active FROM users u ORDER BY u.created_at DESC LIMIT 6`),
    query(`SELECT o.id,o.title,o.status,o.progress,c.full_name AS customer_name,p.full_name AS performer_name FROM orders o JOIN users c ON c.id = o.customer_id LEFT JOIN users p ON p.id = o.performer_id ORDER BY o.created_at DESC LIMIT 6`),
    query(`SELECT s.short_name AS specialty_title, COUNT(o.id)::int AS orders_count, COUNT(o.id) FILTER (WHERE o.status = 'completed')::int AS completed_count FROM specialties s LEFT JOIN orders o ON o.specialty_id = s.id GROUP BY s.id ORDER BY orders_count DESC, specialty_title ASC`)
  ]);
  return { stats: statsResult.rows[0], recentUsers: recentUsersResult.rows, recentOrders: recentOrdersResult.rows, specialtyStats: specialtyStatsResult.rows };
}

module.exports = { getAdminOverview };
