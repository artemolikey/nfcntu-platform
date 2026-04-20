const { waitForDatabase } = require('../src/db');
const { runMigrations } = require('../src/db/bootstrap');

(async () => {
  await waitForDatabase();
  await runMigrations();
  console.log('Міграції успішно виконано.');
  process.exit(0);
})().catch((error) => {
  console.error('Помилка виконання міграцій:', error);
  process.exit(1);
});
