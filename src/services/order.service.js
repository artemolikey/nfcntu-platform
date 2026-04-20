const fs = require('fs');
const { query, withTransaction } = require('../db');
const { ORDER_STATUSES, ORDER_STATUS_LABELS, ROLES, REVIEW_POINTS } = require('../config/constants');
const { getLevelLabel } = require('../utils/levels');

function normalizeProgress(progress) {
  const numeric = Number(progress);
  if (Number.isNaN(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

async function addActivity(client, { orderId = null, actorId = null, actionType, title, description }) {
  await client.query(`INSERT INTO activity_logs (order_id,actor_id,action_type,title,description) VALUES ($1,$2,$3,$4,$5)`, [orderId, actorId, actionType, title, description || null]);
}

async function getOrderBase(orderId, client = { query }) {
  const result = await client.query(`SELECT o.*, c.full_name AS customer_name, p.full_name AS performer_name, s.title AS specialty_title, cat.name AS category_name, r.id AS review_id, r.rating AS review_rating, r.review_text, r.reputation_awarded, r.created_at AS review_created_at FROM orders o JOIN users c ON c.id = o.customer_id LEFT JOIN users p ON p.id = o.performer_id LEFT JOIN specialties s ON s.id = o.specialty_id LEFT JOIN order_categories cat ON cat.id = o.category_id LEFT JOIN order_reviews r ON r.order_id = o.id WHERE o.id = $1`, [orderId]);
  return result.rows[0] || null;
}

function getPermissions(order, currentUser) {
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const isCustomer = order.customer_id === currentUser.id;
  const isPerformer = order.performer_id === currentUser.id;
  const isParticipant = isAdmin || isCustomer || isPerformer;
  return {
    isAdmin,
    isCustomer,
    isPerformer,
    isParticipant,
    canTake: currentUser.role === ROLES.PERFORMER && !order.performer_id && order.status === ORDER_STATUSES.NEW,
    canUpdateStatus: isParticipant,
    canUpdateProgress: isAdmin || isPerformer,
    canReview: isCustomer && order.status === ORDER_STATUSES.COMPLETED && !!order.performer_id && !order.review_id,
    canUsePrivateBlocks: isParticipant
  };
}

async function listOrders(filters = {}, currentUser = null) {
  const params = [];
  const conditions = [];
  if (filters.search) { params.push(`%${filters.search.trim()}%`); conditions.push(`(o.title ILIKE $${params.length} OR o.description ILIKE $${params.length})`); }
  if (filters.status) { params.push(filters.status); conditions.push(`o.status = $${params.length}`); }
  if (filters.specialtyId) { params.push(Number(filters.specialtyId)); conditions.push(`o.specialty_id = $${params.length}`); }
  if (filters.categoryId) { params.push(Number(filters.categoryId)); conditions.push(`o.category_id = $${params.length}`); }
  if (filters.scope === 'mine' && currentUser?.role === ROLES.CUSTOMER) { params.push(currentUser.id); conditions.push(`o.customer_id = $${params.length}`); }
  if (filters.scope === 'assigned' && currentUser?.role === ROLES.PERFORMER) { params.push(currentUser.id); conditions.push(`o.performer_id = $${params.length}`); }
  if (filters.scope === 'available') conditions.push(`o.performer_id IS NULL AND o.status = 'new'`);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`
    SELECT
      o.id,
      o.title,
      o.status,
      o.deadline,
      o.progress,
      o.created_at,
      o.created_at AS order_created_at,
      c.full_name AS customer_name,
      p.full_name AS performer_name,
      s.title AS specialty_title,
      cat.name AS category_name,
      CASE WHEN review_item.id IS NOT NULL THEN TRUE ELSE FALSE END AS has_review,
      CASE o.status
        WHEN 'in_progress' THEN 1
        WHEN 'needs_clarification' THEN 2
        WHEN 'new' THEN 3
        ELSE 4
      END AS status_sort
    FROM orders o
    JOIN users c ON c.id = o.customer_id
    LEFT JOIN users p ON p.id = o.performer_id
    LEFT JOIN specialties s ON s.id = o.specialty_id
    LEFT JOIN order_categories cat ON cat.id = o.category_id
    LEFT JOIN order_reviews review_item ON review_item.order_id = o.id
    ${where}
    ORDER BY status_sort ASC, o.deadline ASC, order_created_at DESC
  `, params);
  return result.rows;
}

async function createOrder({ title, description, customerId, specialtyId, categoryId, deadline }) {
  return withTransaction(async (client) => {
    const result = await client.query(`INSERT INTO orders (title,description,customer_id,specialty_id,category_id,deadline) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [title.trim(), description.trim(), customerId, specialtyId || null, categoryId || null, deadline]);
    const orderId = result.rows[0].id;
    await addActivity(client, { orderId, actorId: customerId, actionType: 'order_created', title: 'Створено замовлення', description: 'Замовлення успішно створено та додано до загального списку.' });
    return getOrderBase(orderId, client);
  });
}

async function getOrderMessages(orderId) {
  const result = await query(`SELECT m.id,m.body,m.created_at,u.id AS sender_id,u.full_name AS sender_name FROM order_messages m JOIN users u ON u.id = m.sender_id WHERE m.order_id = $1 ORDER BY m.created_at ASC`, [orderId]);
  return result.rows;
}

async function getOrderFiles(orderId) {
  const result = await query(`SELECT f.id,f.original_name,f.stored_name,f.mime_type,f.size_bytes,f.file_path,f.created_at,u.full_name AS uploaded_by_name FROM order_files f JOIN users u ON u.id = f.uploaded_by WHERE f.order_id = $1 ORDER BY f.created_at DESC`, [orderId]);
  return result.rows;
}

async function getOrderActivity(orderId) {
  const result = await query(`SELECT a.id,a.title,a.description,a.created_at,u.full_name AS actor_name FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE a.order_id = $1 ORDER BY a.created_at DESC`, [orderId]);
  return result.rows;
}

async function getOrderDetail(orderId, currentUser) {
  const order = await getOrderBase(orderId);
  if (!order) return null;
  const permissions = getPermissions(order, currentUser);
  const [messages, files, activity] = await Promise.all([
    permissions.canUsePrivateBlocks ? getOrderMessages(orderId) : Promise.resolve([]),
    permissions.canUsePrivateBlocks ? getOrderFiles(orderId) : Promise.resolve([]),
    getOrderActivity(orderId)
  ]);
  return { order, permissions, messages, files, activity };
}

async function assignPerformer(orderId, performerId, actorId) {
  return withTransaction(async (client) => {
    const order = await getOrderBase(orderId, client);
    if (!order) throw new Error('Замовлення не знайдено.');
    if (order.performer_id) throw new Error('У цього замовлення вже є виконавець.');
    await client.query(`UPDATE orders SET performer_id = $2, status = $3, progress = GREATEST(progress, 10) WHERE id = $1`, [orderId, performerId, ORDER_STATUSES.IN_PROGRESS]);
    await addActivity(client, { orderId, actorId, actionType: 'performer_assigned', title: 'Замовлення взято в роботу', description: 'Виконавець долучився до виконання.' });
    return getOrderBase(orderId, client);
  });
}

async function updateOrderStatus(orderId, newStatus, actor) {
  return withTransaction(async (client) => {
    const order = await getOrderBase(orderId, client);
    if (!order) throw new Error('Замовлення не знайдено.');
    if (!Object.values(ORDER_STATUSES).includes(newStatus)) throw new Error('Некоректний статус замовлення.');
    const permissions = getPermissions(order, actor);
    if (!permissions.canUpdateStatus) throw new Error('Недостатньо прав для зміни статусу.');
    if (actor.role === ROLES.PERFORMER && newStatus === ORDER_STATUSES.COMPLETED) throw new Error('Завершення замовлення підтверджує замовник або адміністратор.');
    if (newStatus === ORDER_STATUSES.NEW && !permissions.isAdmin) throw new Error('Повернення до статусу «Нове» доступне лише адміністратору.');
    const progress = newStatus === ORDER_STATUSES.COMPLETED ? 100 : order.progress;
    await client.query(`UPDATE orders SET status = $2, progress = $3 WHERE id = $1`, [orderId, newStatus, progress]);
    await addActivity(client, { orderId, actorId: actor.id, actionType: 'status_changed', title: 'Оновлено статус', description: `Статус замовлення змінено на «${ORDER_STATUS_LABELS[newStatus]}».` });
    return getOrderBase(orderId, client);
  });
}

async function updateOrderProgress(orderId, progressValue, actor) {
  const progress = normalizeProgress(progressValue);
  return withTransaction(async (client) => {
    const order = await getOrderBase(orderId, client);
    if (!order) throw new Error('Замовлення не знайдено.');
    const permissions = getPermissions(order, actor);
    if (!permissions.canUpdateProgress) throw new Error('Недостатньо прав для оновлення прогресу.');
    await client.query(`UPDATE orders SET progress = $2 WHERE id = $1`, [orderId, progress]);
    await addActivity(client, { orderId, actorId: actor.id, actionType: 'progress_updated', title: 'Оновлено прогрес', description: `Прогрес виконання змінено на ${progress}%.` });
    return getOrderBase(orderId, client);
  });
}

async function addOrderMessage(orderId, sender, body) {
  const messageText = String(body || '').trim();
  if (!messageText) throw new Error('Повідомлення не може бути порожнім.');
  return withTransaction(async (client) => {
    const order = await getOrderBase(orderId, client);
    if (!order) throw new Error('Замовлення не знайдено.');
    const permissions = getPermissions(order, sender);
    if (!permissions.canUsePrivateBlocks) throw new Error('Повідомлення можуть надсилати лише учасники замовлення.');
    await client.query(`INSERT INTO order_messages (order_id,sender_id,body) VALUES ($1,$2,$3)`, [orderId, sender.id, messageText]);
    await addActivity(client, { orderId, actorId: sender.id, actionType: 'message_added', title: 'Нове повідомлення в чаті', description: 'До замовлення додано нове повідомлення.' });
  });
}

async function addOrderFile(orderId, sender, file) {
  if (!file) throw new Error('Файл не передано.');
  return withTransaction(async (client) => {
    const order = await getOrderBase(orderId, client);
    if (!order) throw new Error('Замовлення не знайдено.');
    const permissions = getPermissions(order, sender);
    if (!permissions.canUsePrivateBlocks) throw new Error('Файли можуть завантажувати лише учасники замовлення.');
    await client.query(`INSERT INTO order_files (order_id,uploaded_by,original_name,stored_name,mime_type,size_bytes,file_path) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [orderId, sender.id, file.originalname, file.filename, file.mimetype, file.size, file.path]);
    await addActivity(client, { orderId, actorId: sender.id, actionType: 'file_uploaded', title: 'Додано файл', description: `Завантажено файл «${file.originalname}».` });
  });
}

async function getOrderFileForDownload(fileId, currentUser) {
  const result = await query(`SELECT f.*, o.customer_id, o.performer_id FROM order_files f JOIN orders o ON o.id = f.order_id WHERE f.id = $1`, [fileId]);
  const file = result.rows[0];
  if (!file) { const error = new Error('Файл не знайдено.'); error.code = 'NOT_FOUND'; throw error; }
  const allowed = currentUser.role === ROLES.ADMIN || currentUser.id === file.customer_id || currentUser.id === file.performer_id;
  if (!allowed) { const error = new Error('Недостатньо прав для завантаження цього файлу.'); error.code = 'FORBIDDEN'; throw error; }
  if (!fs.existsSync(file.file_path)) { const error = new Error('Файл не знайдено на диску.'); error.code = 'NOT_FOUND'; throw error; }
  return file;
}

async function createOrderReview(orderId, customer, rating, reviewText) {
  const safeRating = Number(rating);
  const safeText = String(reviewText || '').trim();
  if (![1, 2, 3, 4, 5].includes(safeRating)) throw new Error('Оцінка має бути в межах від 1 до 5.');
  if (!safeText) throw new Error('Текст відгуку не може бути порожнім.');
  return withTransaction(async (client) => {
    const order = await getOrderBase(orderId, client);
    if (!order) throw new Error('Замовлення не знайдено.');
    if (order.customer_id !== customer.id) throw new Error('Лише замовник може залишити відгук.');
    if (order.status !== ORDER_STATUSES.COMPLETED) throw new Error('Відгук можна залишити лише після завершення замовлення.');
    if (!order.performer_id) throw new Error('У замовлення немає виконавця.');
    if (order.review_id) throw new Error('Для цього замовлення відгук уже існує.');
    const reputationAwarded = REVIEW_POINTS[safeRating];
    await client.query(`INSERT INTO order_reviews (order_id,customer_id,performer_id,rating,review_text,reputation_awarded) VALUES ($1,$2,$3,$4,$5,$6)`, [orderId, customer.id, order.performer_id, safeRating, safeText, reputationAwarded]);
    await client.query(`INSERT INTO portfolio_entries (performer_id,order_id,title,summary,completed_at,rating,review_excerpt) VALUES ($1,$2,$3,$4,NOW(),$5,$6)`, [order.performer_id, orderId, order.title, safeText, safeRating, safeText]);
    const stats = await client.query(`SELECT COALESCE(AVG(rating),0) AS rating_avg, COALESCE(SUM(reputation_awarded),0) AS reputation_points FROM order_reviews WHERE performer_id = $1`, [order.performer_id]);
    const ratingAvg = Number(stats.rows[0].rating_avg || 0);
    const reputationPoints = Number(stats.rows[0].reputation_points || 0);
    await client.query(`UPDATE users SET rating_avg = $2, reputation_points = $3, level_label = $4 WHERE id = $1`, [order.performer_id, ratingAvg, reputationPoints, getLevelLabel(reputationPoints)]);
    await addActivity(client, { orderId, actorId: customer.id, actionType: 'review_added', title: 'Залишено відгук', description: `Замовник оцінив результат на ${safeRating}/5.` });
    return getOrderBase(orderId, client);
  });
}

async function getUserDashboardData(currentUser) {
  const activity = query(`
    SELECT
      a.id,
      a.title,
      a.description,
      a.created_at,
      o.title AS order_title
    FROM activity_logs a
    LEFT JOIN orders o ON o.id = a.order_id
    ORDER BY a.created_at DESC
    LIMIT 8
  `);

  if (currentUser.role === ROLES.ADMIN) {
    const [statsResult, roleBreakdownResult, recentOrdersResult, recentActivityResult] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS users_total,
          (SELECT COUNT(*)::int FROM users WHERE role = 'customer') AS customers_total,
          (SELECT COUNT(*)::int FROM users WHERE role = 'performer') AS performers_total,
          (SELECT COUNT(*)::int FROM orders) AS orders_total,
          (SELECT COUNT(*)::int FROM orders WHERE status = 'new') AS orders_new,
          (SELECT COUNT(*)::int FROM orders WHERE status = 'in_progress') AS orders_in_progress,
          (SELECT COUNT(*)::int FROM orders WHERE status = 'completed') AS orders_completed,
          (SELECT COUNT(*)::int FROM order_reviews) AS reviews_total
      `),

query(`
  SELECT
    s.short_name AS specialty_name,
    COUNT(u.id)::int AS users_count,
    COUNT(u.id) FILTER (WHERE u.role = 'performer')::int AS performers_count,
    COUNT(u.id) FILTER (WHERE u.role = 'customer')::int AS customers_count
  FROM specialties s
  LEFT JOIN users u ON u.specialty_id = s.id
  GROUP BY s.id, s.short_name
  HAVING COUNT(u.id) > 0
  ORDER BY users_count DESC
  LIMIT 6
`),

      query(`
        SELECT
          o.id,
          o.title,
          o.status,
          o.deadline,
          o.progress,
          c.full_name AS customer_name,
          p.full_name AS performer_name
        FROM orders o
        JOIN users c ON c.id = o.customer_id
        LEFT JOIN users p ON p.id = o.performer_id
        ORDER BY o.created_at DESC
        LIMIT 6
      `),

      activity
    ]);

    return {
      type: 'admin',
      stats: statsResult.rows[0],
      roleBreakdown: roleBreakdownResult.rows,
      recentOrders: recentOrdersResult.rows,
      recentActivity: recentActivityResult.rows
    };
  }

  if (currentUser.role === ROLES.PERFORMER) {
    const [summaryResult, assignedOrdersResult, portfolioResult, recentActivityResult] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
          COUNT(*) FILTER (WHERE status = 'needs_clarification')::int AS needs_clarification,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'new')::int AS new_available,
          COUNT(*)::int AS assigned_total
        FROM orders
        WHERE performer_id = $1 OR (performer_id IS NULL AND status = 'new')
      `, [currentUser.id]),

      query(`
        SELECT
          o.id,
          o.title,
          o.status,
          o.deadline,
          o.progress,
          c.full_name AS customer_name,
          cat.name AS category_name
        FROM orders o
        JOIN users c ON c.id = o.customer_id
        LEFT JOIN order_categories cat ON cat.id = o.category_id
        WHERE o.performer_id = $1 OR (o.performer_id IS NULL AND o.status = 'new')
        ORDER BY CASE WHEN o.performer_id = $1 THEN 0 ELSE 1 END, o.deadline ASC
        LIMIT 8
      `, [currentUser.id]),

      query(`
        SELECT
          title,
          summary,
          completed_at,
          rating
        FROM portfolio_entries
        WHERE performer_id = $1
        ORDER BY completed_at DESC
        LIMIT 4
      `, [currentUser.id]),

      query(`
        SELECT
          a.id,
          a.title,
          a.description,
          a.created_at,
          o.title AS order_title
        FROM activity_logs a
        JOIN orders o ON o.id = a.order_id
        WHERE o.performer_id = $1
        ORDER BY a.created_at DESC
        LIMIT 6
      `, [currentUser.id])
    ]);

    return {
      type: 'performer',
      stats: summaryResult.rows[0],
      assignedOrders: assignedOrdersResult.rows,
      portfolioPreview: portfolioResult.rows,
      recentActivity: recentActivityResult.rows
    };
  }

  const [summaryResult, customerOrdersResult, recentActivityResult] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'needs_clarification')::int AS needs_clarification,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*)::int AS total
      FROM orders
      WHERE customer_id = $1
    `, [currentUser.id]),

    query(`
      SELECT
        o.id,
        o.title,
        o.status,
        o.deadline,
        o.progress,
        p.full_name AS performer_name,
        cat.name AS category_name
      FROM orders o
      LEFT JOIN users p ON p.id = o.performer_id
      LEFT JOIN order_categories cat ON cat.id = o.category_id
      WHERE o.customer_id = $1
      ORDER BY o.deadline ASC, o.created_at DESC
      LIMIT 8
    `, [currentUser.id]),

    query(`
      SELECT
        a.id,
        a.title,
        a.description,
        a.created_at,
        o.title AS order_title
      FROM activity_logs a
      JOIN orders o ON o.id = a.order_id
      WHERE o.customer_id = $1
      ORDER BY a.created_at DESC
      LIMIT 6
    `, [currentUser.id])
  ]);

  return {
    type: 'customer',
    stats: summaryResult.rows[0],
    myOrders: customerOrdersResult.rows,
    recentActivity: recentActivityResult.rows
  };
}

async function getLandingPageData() {
  const [statsResult, performersResult, testimonialsResult] = await Promise.all([
    query(`SELECT (SELECT COUNT(*)::int FROM users WHERE role = 'performer') AS performers_total, (SELECT COUNT(*)::int FROM orders) AS orders_total, (SELECT COUNT(*)::int FROM orders WHERE status = 'completed') AS completed_total, (SELECT COUNT(*)::int FROM order_reviews) AS reviews_total`),
    query(`SELECT u.full_name, u.level_label, u.rating_avg, s.short_name AS specialty_title FROM users u LEFT JOIN specialties s ON s.id = u.specialty_id WHERE u.role = 'performer' ORDER BY u.rating_avg DESC, u.reputation_points DESC LIMIT 4`),
    query(`SELECT r.rating, r.review_text, u.full_name AS customer_name, o.title FROM order_reviews r JOIN users u ON u.id = r.customer_id JOIN orders o ON o.id = r.order_id ORDER BY r.created_at DESC LIMIT 3`)
  ]);
  return { stats: statsResult.rows[0], performers: performersResult.rows, testimonials: testimonialsResult.rows };
}

module.exports = { listOrders, createOrder, getOrderDetail, assignPerformer, updateOrderStatus, updateOrderProgress, addOrderMessage, addOrderFile, getOrderFileForDownload, createOrderReview, getUserDashboardData, getLandingPageData, getOrderMessages, getOrderBase, getPermissions };
