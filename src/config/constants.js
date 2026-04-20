const APP_NAME = 'Платформа замовлень НФК НТУ';
const COLLEGE_NAME = 'Надвірнянський фаховий коледж НТУ';
const ALLOWED_EMAIL_DOMAIN = '@nfcntu.ukr.education';

const ROLES = {
  CUSTOMER: 'customer',
  PERFORMER: 'performer',
  ADMIN: 'admin'
};

const ROLE_LABELS = {
  [ROLES.CUSTOMER]: 'Замовник',
  [ROLES.PERFORMER]: 'Виконавець',
  [ROLES.ADMIN]: 'Адміністратор'
};

const ORDER_STATUSES = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  NEEDS_CLARIFICATION: 'needs_clarification',
  COMPLETED: 'completed'
};

const ORDER_STATUS_LABELS = {
  [ORDER_STATUSES.NEW]: 'Нове',
  [ORDER_STATUSES.IN_PROGRESS]: 'В роботі',
  [ORDER_STATUSES.NEEDS_CLARIFICATION]: 'Потребує уточнення',
  [ORDER_STATUSES.COMPLETED]: 'Завершене'
};

const LEVEL_RULES = [
  { min: 0, label: 'Новачок' },
  { min: 80, label: 'Активний виконавець' },
  { min: 200, label: 'Досвідчений виконавець' },
  { min: 400, label: 'Експерт' }
];

const REVIEW_POINTS = { 1: 8, 2: 16, 3: 24, 4: 32, 5: 40 };

module.exports = {
  APP_NAME,
  COLLEGE_NAME,
  ALLOWED_EMAIL_DOMAIN,
  ROLES,
  ROLE_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  LEVEL_RULES,
  REVIEW_POINTS
};
