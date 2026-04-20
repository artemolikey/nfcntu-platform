const express = require('express');
const asyncHandler = require('../utils/async-handler');
const { requireRoles } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { getAdminOverview } = require('../services/admin.service');
const { listUsers, toggleUserActive } = require('../services/user.service');
const { listOrders } = require('../services/order.service');
const { getReferenceData } = require('../services/reference.service');
const { setFlash } = require('../utils/flash');

const router = express.Router();

router.use(requireRoles(ROLES.ADMIN));

router.get('/', asyncHandler(async (req, res) => {
  const overview = await getAdminOverview();
  res.render('pages/admin/index', {
    pageTitle: 'Адмін-панель',
    bodyClass: 'admin-page',
    overview
  });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const referenceData = await getReferenceData();
  const filters = {
    search: req.query.search || '',
    role: req.query.role || '',
    specialtyId: req.query.specialtyId || '',
    includeInactive: req.query.includeInactive !== 'false'
  };
  const users = await listUsers(filters);

  res.render('pages/admin/users', {
    pageTitle: 'Користувачі',
    bodyClass: 'admin-page',
    users,
    filters,
    referenceData
  });
}));

router.post('/users/:userId/toggle-active', asyncHandler(async (req, res) => {
  if (req.params.userId === req.session.authUser.id) {
    setFlash(req, 'danger', 'Неможливо деактивувати власний обліковий запис адміністратора.');
    return res.redirect('/admin/users');
  }

  const updatedUser = await toggleUserActive(req.params.userId);
  if (!updatedUser) {
    setFlash(req, 'danger', 'Користувача не знайдено.');
    return res.redirect('/admin/users');
  }

  setFlash(req, 'success', `Статус користувача «${updatedUser.full_name}» змінено.`);
  return res.redirect('/admin/users');
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const referenceData = await getReferenceData();
  const filters = {
    search: req.query.search || '',
    status: req.query.status || '',
    specialtyId: req.query.specialtyId || '',
    categoryId: req.query.categoryId || '',
    scope: ''
  };
  const orders = await listOrders(filters, req.session.authUser);

  res.render('pages/admin/orders', {
    pageTitle: 'Усі замовлення',
    bodyClass: 'admin-page',
    orders,
    filters,
    referenceData
  });
}));

module.exports = router;
