const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('../utils/async-handler');
const { setFlash } = require('../utils/flash');
const { ROLES } = require('../config/constants');
const { isCorporateEmail, normalizeEmail } = require('../utils/validators');
const { getReferenceData, getAcademicGroupById } = require('../services/reference.service');
const { findUserByEmail, verifyPassword, createUser, buildSessionUser } = require('../services/user.service');

const router = express.Router();

function guestOnly(req, res, next) {
  if (req.session.authUser) {
    return res.redirect('/dashboard');
  }
  return next();
}

function firstErrors(result) {
  const errors = {};
  for (const issue of result.array()) {
    if (!errors[issue.path]) {
      errors[issue.path] = issue.msg;
    }
  }
  return errors;
}

async function renderLogin(req, res, data = {}) {
  res.render('pages/auth/login', {
    pageTitle: 'Вхід',
    bodyClass: 'auth-page',
    formData: data.formData || {},
    errors: data.errors || {},
    formError: data.formError || null
  });
}

async function renderRegister(req, res, data = {}) {
  const referenceData = await getReferenceData();
  res.render('pages/auth/register', {
    pageTitle: 'Реєстрація',
    bodyClass: 'auth-page',
    referenceData,
    formData: data.formData || {},
    errors: data.errors || {},
    formError: data.formError || null
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

router.get('/login', guestOnly, asyncHandler(async (req, res) => {
  await renderLogin(req, res);
}));

router.post('/login', guestOnly, [
  body('email')
    .trim()
    .notEmpty().withMessage('Вкажіть email.')
    .bail()
    .isEmail().withMessage('Вкажіть коректний email.')
    .bail()
    .custom((value) => isCorporateEmail(value)).withMessage('Вхід доступний лише з корпоративної адреси коледжу.'),
  body('password')
    .trim()
    .notEmpty().withMessage('Вкажіть пароль.')
], asyncHandler(async (req, res) => {
  const result = validationResult(req);
  const formData = { email: req.body.email };

  if (!result.isEmpty()) {
    return renderLogin(req, res, { errors: firstErrors(result), formData });
  }

  const user = await findUserByEmail(req.body.email);
  if (!user) {
    return renderLogin(req, res, { formError: 'Користувача з такою електронною адресою не знайдено.', formData });
  }

  if (!user.is_active) {
    return renderLogin(req, res, { formError: 'Ваш обліковий запис тимчасово деактивовано адміністратором.', formData });
  }

  const isValidPassword = await verifyPassword(user, req.body.password);
  if (!isValidPassword) {
    return renderLogin(req, res, { formError: 'Невірний пароль. Спробуйте ще раз.', formData });
  }

  req.session.authUser = buildSessionUser(user);
  await saveSession(req);
  return res.redirect('/dashboard');
}));

router.get('/register', guestOnly, asyncHandler(async (req, res) => {
  await renderRegister(req, res);
}));

router.post('/register', guestOnly, [
  body('fullName')
    .trim()
    .isLength({ min: 5, max: 255 }).withMessage('Вкажіть ПІБ довжиною від 5 до 255 символів.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Вкажіть корпоративний email.')
    .bail()
    .isEmail().withMessage('Вкажіть коректний email.')
    .bail()
    .custom((value) => isCorporateEmail(value)).withMessage('Реєстрація доступна лише для адрес @nfcntu.ukr.education.'),
  body('password')
    .isLength({ min: 8 }).withMessage('Пароль має містити щонайменше 8 символів.'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password).withMessage('Підтвердження пароля не збігається.'),
  body('role')
    .isIn([ROLES.CUSTOMER, ROLES.PERFORMER]).withMessage('Оберіть роль замовника або виконавця.'),
  body('specialtyId')
    .notEmpty().withMessage('Оберіть спеціальність.')
    .bail()
    .isInt({ min: 1 }).withMessage('Некоректна спеціальність.'),
  body('academicGroupId')
    .notEmpty().withMessage('Оберіть групу.')
    .bail()
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
    email: req.body.email,
    phone: req.body.phone,
    role: req.body.role,
    specialtyId: req.body.specialtyId,
    academicGroupId: req.body.academicGroupId,
    bio: req.body.bio
  };

  if (!result.isEmpty()) {
    return renderRegister(req, res, { errors: firstErrors(result), formData });
  }

  const existingUser = await findUserByEmail(req.body.email);
  if (existingUser) {
    return renderRegister(req, res, { formError: 'Користувач із таким email уже зареєстрований.', formData });
  }

  const group = await getAcademicGroupById(req.body.academicGroupId);
  if (!group || Number(group.specialty_id) !== Number(req.body.specialtyId)) {
    return renderRegister(req, res, { formError: 'Обрана група не відповідає зазначеній спеціальності.', formData });
  }

  const user = await createUser({
    fullName: req.body.fullName,
    email: normalizeEmail(req.body.email),
    password: req.body.password,
    phone: req.body.phone,
    role: req.body.role,
    specialtyId: Number(req.body.specialtyId),
    academicGroupId: Number(req.body.academicGroupId),
    bio: req.body.bio
  });

  req.session.authUser = buildSessionUser(user);
  await saveSession(req);
  setFlash(req, 'success', 'Реєстрацію завершено. Ласкаво просимо до платформи!');
  return res.redirect('/dashboard');
}));

router.post('/logout', asyncHandler(async (req, res) => {
  await new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  res.clearCookie('connect.sid');
  return res.redirect('/');
}));

module.exports = router;
