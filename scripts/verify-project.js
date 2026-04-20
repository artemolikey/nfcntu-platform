process.env.DB_CLIENT = process.env.DB_CLIENT || 'pgmem';
process.env.AUTO_SEED = process.env.AUTO_SEED || 'true';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'verify-secret';

const fs = require('fs');
const path = require('path');
const { query } = require('../src/db');
const { ensureBootstrapped } = require('../src/db/bootstrap');

const requiredFiles = [
  'src/server.js',
  'src/routes/public.routes.js',
  'src/routes/auth.routes.js',
  'src/routes/dashboard.routes.js',
  'src/routes/profile.routes.js',
  'src/routes/orders.routes.js',
  'src/routes/admin.routes.js',
  'views/layouts/main.ejs',
  'views/pages/home.ejs',
  'views/pages/dashboard.ejs',
  'views/pages/orders/show.ejs',
  'views/pages/admin/index.ejs',
  'public/assets/css/app.css',
  'public/assets/js/app.js',
  'public/assets/img/logo.png',
  'README.md'
];

(async () => {
  for (const file of requiredFiles) {
    const absolute = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(absolute)) {
      throw new Error(`Відсутній обов'язковий файл: ${file}`);
    }
  }

  await ensureBootstrapped();

  const [users, orders, reviews, files] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM users'),
    query('SELECT COUNT(*)::int AS count FROM orders'),
    query('SELECT COUNT(*)::int AS count FROM order_reviews'),
    query('SELECT COUNT(*)::int AS count FROM order_files')
  ]);

  const metrics = {
    users: users.rows[0].count,
    orders: orders.rows[0].count,
    reviews: reviews.rows[0].count,
    files: files.rows[0].count
  };

  if (metrics.users < 10 || metrics.orders < 10 || metrics.reviews < 3 || metrics.files < 2) {
    throw new Error(`Недостатньо початкових даних: ${JSON.stringify(metrics)}`);
  }

  console.log('Перевірка структури і seed-даних успішна.');
  console.log(metrics);
  process.exit(0);
})().catch((error) => {
  console.error('Перевірка не пройдена:', error);
  process.exit(1);
});
