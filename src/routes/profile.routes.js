const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('../utils/async-handler');
const { requireAuth } = require('../middleware/auth');
const { setFlash } = require('../utils/flash');
const { ROLES } = require('../config/constants');
const { getReferenceData, getAcademicGroupById } = require('../services/reference.service');
const { getProfileView, updateProfile, findUserById, buildSessionUser } = require('../services/user.service');

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

function destroySessionAndRedirect(req, res) {
  req.session.destroy(() => {
    return res.redirect('/auth/login');
  });
}

async function renderProfile(req, res, overrides = {}) {
  const [profileView, referenceData] = await Promise.all([
    getProfileView(req.session.authUser.id),
    getReferenceData()
  ]);

  if (!profileView || !profileView.user) {
    return destroySessionAndRedirect(req, res);
  }

  res.render('pages/profile/show', {
    pageTitle: 'Профіль',
    bodyClass: 'profile-page',
    profileView,
    referenceData,
    formData: overrides.formData || null,
    errors: overrides.errors || {},
    formError: overrides.formError || null
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  await renderProfile(req, res);
}));

router.post('/', requireAuth, [
  body('fullName')
    .trim()
    .isLength({ min: 5, max: 255 }).withMessage('Вкажіть ПІБ довжиною від 5 до 255 символів.'),
  body('specialtyId')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Некоректна спеціальність.'),
  body('academicGroupId')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Некоректна група.'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 7, max: 30 }).withMessage('Вкажіть коректний номер телефону.'),
  body('bio')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Опис профілю не має перевищувати 500 символів.')
], asyncHandler(async (req, res) => {
  const result = validationResult(req);
  const formData = {
    fullName: req.body.fullName,
    phone: req.body.phone,
    specialtyId: req.body.specialtyId,
    academicGroupId: req.body.academicGroupId,
    bio: req.body.bio
  };

  if (!result.isEmpty()) {
    return renderProfile(req, res, { errors: firstErrors(result), formData });
  }

  if (req.session.authUser.role !== ROLES.ADMIN) {
    if (!req.body.specialtyId || !req.body.academicGroupId) {
      return renderProfile(req, res, {
        formError: 'Для студентських ролей потрібно вказати спеціальність і групу.',
        formData
      });
    }

    const group = await getAcademicGroupById(req.body.academicGroupId);
    if (!group || Number(group.specialty_id) !== Number(req.body.specialtyId)) {
      return renderProfile(req, res, {
        formError: 'Обрана група не відповідає зазначеній спеціальності.',
        formData
      });
    }
  }

  await updateProfile(req.session.authUser.id, {
    fullName: req.body.fullName,
    phone: req.body.phone,
    specialtyId: req.body.specialtyId ? Number(req.body.specialtyId) : null,
    academicGroupId: req.body.academicGroupId ? Number(req.body.academicGroupId) : null,
    bio: req.body.bio
  });

  const refreshedUser = await findUserById(req.session.authUser.id);

  if (!refreshedUser) {
    return destroySessionAndRedirect(req, res);
  }

  req.session.authUser = buildSessionUser(refreshedUser);
  await saveSession(req);

  setFlash(req, 'success', 'Профіль успішно оновлено.');
  return res.redirect('/profile');
}));

module.exports = router;