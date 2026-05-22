const express = require('express');
const path = require('path');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('../utils/async-handler');
const upload = require('../middleware/upload');
const { requireAuth, requireRoles, requireCustomerOrAdmin } = require('../middleware/auth');
const { setFlash } = require('../utils/flash');
const { ORDER_STATUSES, ROLES } = require('../config/constants');
const { getReferenceData, getCategoryById } = require('../services/reference.service');

const {
  listOrders,
  createOrder,
  getOrderDetail,
  updateOrderStatus,
  updateOrderProgress,
  addOrderMessage,
  addOrderFile,
  getOrderFileForDownload,
  createOrderReview,
  getOrderMessages,
  createOrderApplication,
  acceptOrderApplication,
  submitOrderForReview,
confirmOrderCompletion,
requestRevision
} = require('../services/order.service');

const router = express.Router();

function firstErrors(result) {
  const errors = {};
  for (const issue of result.array()) {
    if (!errors[issue.path]) {
      errors[issue.path] = issue.msg;
    }
  }
  return errors;
}

function defaultScopeForUser(user) {
  if (user.role === ROLES.CUSTOMER) return 'mine';
  if (user.role === ROLES.PERFORMER) return 'available';
  return '';
}

async function renderOrdersIndex(req, res, overrides = {}) {
  const referenceData = await getReferenceData();
  const filters = {
    search: overrides.filters?.search ?? req.query.search ?? '',
    status: overrides.filters?.status ?? req.query.status ?? '',
    specialtyId: overrides.filters?.specialtyId ?? req.query.specialtyId ?? '',
    categoryId: overrides.filters?.categoryId ?? req.query.categoryId ?? '',
    scope: overrides.filters?.scope ?? req.query.scope ?? defaultScopeForUser(req.session.authUser)
  };

  const orders = await listOrders(filters, req.session.authUser);

  res.render('pages/orders/index', {
    pageTitle: 'Замовлення',
    bodyClass: 'orders-page',
    orders,
    filters,
    referenceData,
    statusOptions: ORDER_STATUSES
  });
}

async function renderCreateOrder(req, res, overrides = {}) {
  const referenceData = await getReferenceData();
  res.render('pages/orders/new', {
    pageTitle: 'Нове замовлення',
    bodyClass: 'orders-page',
    referenceData,
    formData: overrides.formData || {},
    errors: overrides.errors || {},
    formError: overrides.formError || null
  });
}

function isFutureDate(dateValue) {
  const candidate = new Date(`${dateValue}T23:59:59`);
  const now = new Date();
  return Number.isFinite(candidate.getTime()) && candidate > now;
}

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  await renderOrdersIndex(req, res);
}));

router.get('/new', requireCustomerOrAdmin, asyncHandler(async (req, res) => {
  await renderCreateOrder(req, res);
}));

router.post('/:orderId/submit-review', requireRoles(ROLES.PERFORMER), asyncHandler(async (req, res) => {
  try {
    await submitOrderForReview(req.params.orderId, req.session.authUser);
    setFlash(req, 'success', 'Роботу передано на перевірку.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }

  return res.redirect(`/orders/${req.params.orderId}`);
}));

router.post('/:orderId/confirm', requireRoles(ROLES.CUSTOMER), asyncHandler(async (req, res) => {
  try {
    await confirmOrderCompletion(req.params.orderId, req.session.authUser);
    setFlash(req, 'success', 'Замовлення успішно завершено.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }

  return res.redirect(`/orders/${req.params.orderId}`);
}));

router.post('/:orderId/revision', requireRoles(ROLES.CUSTOMER), asyncHandler(async (req, res) => {
  try {
    await requestRevision(req.params.orderId, req.session.authUser);
    setFlash(req, 'success', 'Роботу відправлено на доопрацювання.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }

  return res.redirect(`/orders/${req.params.orderId}`);
}));

router.post('/new', requireCustomerOrAdmin, [
  body('title')
    .trim()
    .isLength({ min: 8, max: 255 }).withMessage('Назва має містити від 8 до 255 символів.'),
  body('specialtyId')
    .notEmpty().withMessage('Оберіть спеціальність.')
    .bail()
    .isInt({ min: 1 }).withMessage('Некоректна спеціальність.'),
  body('categoryId')
    .notEmpty().withMessage('Оберіть категорію.')
    .bail()
    .isInt({ min: 1 }).withMessage('Некоректна категорія.'),
  body('deadline')
    .notEmpty().withMessage('Оберіть дедлайн.')
    .bail()
    .isISO8601().withMessage('Вкажіть коректну дату дедлайну.'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 4000 }).withMessage('Опис має містити від 20 до 4000 символів.')
], asyncHandler(async (req, res) => {
  const result = validationResult(req);
  const formData = {
    title: req.body.title,
    specialtyId: req.body.specialtyId,
    categoryId: req.body.categoryId,
    deadline: req.body.deadline,
    description: req.body.description
  };

  if (!result.isEmpty()) {
    return renderCreateOrder(req, res, { errors: firstErrors(result), formData });
  }

  if (!isFutureDate(req.body.deadline)) {
    return renderCreateOrder(req, res, {
      formError: 'Дедлайн має бути пізнішим за поточну дату.',
      formData
    });
  }

  const category = await getCategoryById(req.body.categoryId);
  if (!category) {
    return renderCreateOrder(req, res, {
      formError: 'Обрана категорія не знайдена.',
      formData
    });
  }

  if (category.specialty_id && Number(category.specialty_id) !== Number(req.body.specialtyId)) {
    return renderCreateOrder(req, res, {
      formError: 'Категорія не відповідає обраній спеціальності.',
      formData
    });
  }

  const order = await createOrder({
    title: req.body.title,
    description: req.body.description,
    customerId: req.session.authUser.id,
    specialtyId: Number(req.body.specialtyId),
    categoryId: Number(req.body.categoryId),
    deadline: req.body.deadline
  });

  setFlash(req, 'success', 'Замовлення успішно створено.');
  return res.redirect(`/orders/${order.id}`);
}));

router.get('/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const detail = await getOrderDetail(req.params.orderId, req.session.authUser);
  if (!detail) {
    return res.status(404).render('pages/error', {
      pageTitle: 'Замовлення не знайдено',
      statusCode: 404,
      message: 'Замовлення з таким ідентифікатором не знайдено.',
      bodyClass: 'error-page'
    });
  }

  res.render('pages/orders/show', {
    pageTitle: detail.order.title,
    bodyClass: 'order-detail-page',
    detail,
    statusOptions: Object.values(ORDER_STATUSES)
  });
}));

router.post('/:orderId/apply', requireRoles(ROLES.PERFORMER), [
  body('message')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Повідомлення до заявки не може перевищувати 1000 символів.')
], asyncHandler(async (req, res) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    setFlash(req, 'danger', result.array()[0].msg);
    return res.redirect(`/orders/${req.params.orderId}`);
  }

  try {
    await createOrderApplication(
      req.params.orderId,
      req.session.authUser,
      req.body.message
    );

    setFlash(req, 'success', 'Заявку успішно подано. Очікуйте підтвердження замовника.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }

  return res.redirect(`/orders/${req.params.orderId}`);
}));

router.post('/:orderId/applications/:applicationId/accept', requireAuth, asyncHandler(async (req, res) => {
  try {
    await acceptOrderApplication(
      req.params.orderId,
      req.params.applicationId,
      req.session.authUser
    );

    setFlash(req, 'success', 'Виконавця успішно призначено.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }

  return res.redirect(`/orders/${req.params.orderId}`);
}));


router.post('/:orderId/status', requireAuth, [
  body('status').isIn(Object.values(ORDER_STATUSES)).withMessage('Оберіть коректний статус.')
], asyncHandler(async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    setFlash(req, 'danger', result.array()[0].msg);
    return res.redirect(`/orders/${req.params.orderId}`);
  }

  try {
    await updateOrderStatus(req.params.orderId, req.body.status, req.session.authUser);
    setFlash(req, 'success', 'Статус замовлення оновлено.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }
  return res.redirect(`/orders/${req.params.orderId}`);
}));

router.post('/:orderId/progress', requireAuth, [
  body('progress')
    .notEmpty().withMessage('Вкажіть значення прогресу.')
    .bail()
    .isInt({ min: 0, max: 100 }).withMessage('Прогрес має бути від 0 до 100%.')
], asyncHandler(async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    setFlash(req, 'danger', result.array()[0].msg);
    return res.redirect(`/orders/${req.params.orderId}`);
  }

  try {
    await updateOrderProgress(req.params.orderId, req.body.progress, req.session.authUser);
    setFlash(req, 'success', 'Прогрес оновлено.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }
  return res.redirect(`/orders/${req.params.orderId}`);
}));

router.post('/:orderId/messages', requireAuth, [
  body('message').trim().notEmpty().withMessage('Повідомлення не може бути порожнім.')
], asyncHandler(async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    setFlash(req, 'danger', result.array()[0].msg);
    return res.redirect(`/orders/${req.params.orderId}`);
  }

  try {
    await addOrderMessage(req.params.orderId, req.session.authUser, req.body.message);
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }
  return res.redirect(`/orders/${req.params.orderId}#chat`);
}));

router.post('/:orderId/files', requireAuth, upload.single('attachment'), asyncHandler(async (req, res) => {
  try {
    await addOrderFile(req.params.orderId, req.session.authUser, req.file);
    setFlash(req, 'success', 'Файл успішно завантажено.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }
  return res.redirect(`/orders/${req.params.orderId}#files`);
}));

router.post('/:orderId/review', requireRoles(ROLES.CUSTOMER), [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Оцінка має бути від 1 до 5.'),
  body('reviewText').trim().isLength({ min: 12, max: 2000 }).withMessage('Відгук має містити від 12 до 2000 символів.')
], asyncHandler(async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    setFlash(req, 'danger', result.array()[0].msg);
    return res.redirect(`/orders/${req.params.orderId}#review`);
  }

  try {
    await createOrderReview(req.params.orderId, req.session.authUser, req.body.rating, req.body.reviewText);
    setFlash(req, 'success', 'Відгук успішно додано.');
  } catch (error) {
    setFlash(req, 'danger', error.message);
  }
  return res.redirect(`/orders/${req.params.orderId}#review`);
}));

router.get('/:orderId/messages', requireAuth, asyncHandler(async (req, res) => {
  const detail = await getOrderDetail(req.params.orderId, req.session.authUser);
  if (!detail) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (!detail.permissions.canUsePrivateBlocks) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const messages = await getOrderMessages(req.params.orderId);
  return res.json({
    orderId: req.params.orderId,
    currentUserId: req.session.authUser.id,
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.created_at,
      senderId: message.sender_id,
      senderName: message.sender_name
    }))
  });
}));

router.get('/files/:fileId/download', requireAuth, asyncHandler(async (req, res) => {
  try {
    const file = await getOrderFileForDownload(req.params.fileId, req.session.authUser);
    return res.download(path.resolve(file.file_path), file.original_name);
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).render('pages/error', {
        pageTitle: 'Файл не знайдено',
        statusCode: 404,
        message: error.message,
        bodyClass: 'error-page'
      });
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).render('pages/error', {
        pageTitle: 'Немає доступу',
        statusCode: 403,
        message: error.message,
        bodyClass: 'error-page'
      });
    }
    throw error;
  }
}));

module.exports = router;
