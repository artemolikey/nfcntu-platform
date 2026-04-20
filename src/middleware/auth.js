const { ROLES } = require('../config/constants');
const { setFlash } = require('../utils/flash');

function requireAuth(req, res, next) {
  if (!req.session.authUser) {
    setFlash(req, 'warning', 'Для продовження потрібно увійти в систему.');
    return res.redirect('/auth/login');
  }
  return next();
}

function requireRoles(...roles) {
  return function guard(req, res, next) {
    if (!req.session.authUser) {
      setFlash(req, 'warning', 'Для продовження потрібно увійти в систему.');
      return res.redirect('/auth/login');
    }
    if (!roles.includes(req.session.authUser.role)) {
      setFlash(req, 'danger', 'У вас немає доступу до цього розділу.');
      return res.redirect('/dashboard');
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  requireRoles,
  requireCustomerOrAdmin: requireRoles(ROLES.CUSTOMER, ROLES.ADMIN),
  requirePerformerOrAdmin: requireRoles(ROLES.PERFORMER, ROLES.ADMIN)
};
