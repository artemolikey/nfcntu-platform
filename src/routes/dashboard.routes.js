const express = require('express');
const asyncHandler = require('../utils/async-handler');
const { requireAuth } = require('../middleware/auth');
const { getUserDashboardData } = require('../services/order.service');
const { findUserById } = require('../services/user.service');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const [dashboard, profile] = await Promise.all([
    getUserDashboardData(req.session.authUser),
    findUserById(req.session.authUser.id)
  ]);

  res.render('pages/dashboard', {
    pageTitle: 'Dashboard',
    bodyClass: 'dashboard-page',
    dashboard,
    profile
  });
}));

module.exports = router;
