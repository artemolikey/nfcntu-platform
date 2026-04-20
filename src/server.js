const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const env = require('./config/env');
const { pool } = require('./db');
const { ensureBootstrapped } = require('./db/bootstrap');
const { attachViewContext } = require('./middleware/context');
const { flashMiddleware } = require('./utils/flash');
const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const profileRoutes = require('./routes/profile.routes');
const ordersRoutes = require('./routes/orders.routes');
const adminRoutes = require('./routes/admin.routes');

function buildSessionStore() {
  if (env.isPgMem) return undefined;
  const PgStore = require('connect-pg-simple')(session);
  return new PgStore({
    pool,
    createTableIfMissing: true,
    tableName: 'user_sessions'
  });
}

async function createApp({ bootstrap = true } = {}) {
  if (bootstrap) {
    await ensureBootstrapped();
  }

  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('layout', 'layouts/main');

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(expressLayouts);
  app.use(session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: buildSessionStore(),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  }));

  app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));
  app.use('/uploads', express.static(env.uploadsDir));

  app.use(attachViewContext);
  app.use(flashMiddleware);

  app.use('/', publicRoutes);
  app.use('/auth', authRoutes);
  app.use('/dashboard', dashboardRoutes);
  app.use('/profile', profileRoutes);
  app.use('/orders', ordersRoutes);
  app.use('/admin', adminRoutes);

  app.use((req, res) => {
    if (req.accepts('html')) {
      return res.status(404).render('pages/error', {
        pageTitle: 'Сторінку не знайдено',
        statusCode: 404,
        message: 'Сторінку, яку ви шукаєте, не знайдено або її було переміщено.',
        bodyClass: 'error-page'
      });
    }
    return res.status(404).json({ error: 'Not found' });
  });

  app.use((error, req, res, next) => {
    if (req.file && req.file.path) {
      // no-op; file is intentionally preserved to avoid accidental data loss on partial failures
    }
    const statusCode = error.statusCode || 500;
    if (!env.isProduction) {
      console.error(error);
    }
    if (res.headersSent) {
      return next(error);
    }
    if (req.accepts('html')) {
      return res.status(statusCode).render('pages/error', {
        pageTitle: statusCode === 500 ? 'Помилка сервера' : 'Помилка',
        statusCode,
        message: error.message || 'Під час обробки запиту виникла помилка.',
        bodyClass: 'error-page'
      });
    }
    return res.status(statusCode).json({ error: error.message || 'Internal server error' });
  });

  return app;
}

async function startServer() {
  const app = await createApp();
  return new Promise((resolve) => {
    const server = app.listen(env.port, () => {
      console.log(`NFCNTU platform started on ${env.appUrl}`);
      resolve({ app, server });
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Не вдалося запустити сервер:', error);
    process.exit(1);
  });
}

module.exports = { createApp, startServer };
