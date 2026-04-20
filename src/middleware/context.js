const { APP_NAME, COLLEGE_NAME, ALLOWED_EMAIL_DOMAIN, ROLE_LABELS, ORDER_STATUS_LABELS } = require('../config/constants');
const helpers = require('../utils/view-helpers');

function attachViewContext(req, res, next) {
  res.locals.appName = APP_NAME;
  res.locals.collegeName = COLLEGE_NAME;
  res.locals.allowedEmailDomain = ALLOWED_EMAIL_DOMAIN;
  res.locals.roleLabels = ROLE_LABELS;
  res.locals.orderStatusLabels = ORDER_STATUS_LABELS;
  res.locals.currentUser = req.session.authUser || null;
  res.locals.currentPath = req.path;
  res.locals.helpers = helpers;
  next();
}

module.exports = { attachViewContext };
