const express = require('express');
const asyncHandler = require('../utils/async-handler');
const { requireAuth } = require('../middleware/auth');
const { getUserDashboardData } = require('../services/order.service');
const { findUserById } = require('../services/user.service');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const profile = await findUserById(req.session.authUser.id);

  if (!profile) {
    req.session.destroy(() => {
      return res.redirect('/auth/login');
    });
    return;
  }

  const dashboard = await getUserDashboardData(req.session.authUser);

  res.render('pages/dashboard', {
    pageTitle: 'Dashboard',
    bodyClass: 'dashboard-page',
    dashboard,
    profile
  });
}));

module.exports = router;