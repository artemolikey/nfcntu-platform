const { waitForDatabase } = require('../src/db');
const { runMigrations, seedDatabase } = require('../src/db/bootstrap');

(async () => {
  await waitForDatabase();
  await runMigrations();
  await seedDatabase(true);
  console.log('Базу даних успішно підготовлено: міграції та початкові дані застосовано.');
  process.exit(0);
})().catch((error) => {
  console.error('Помилка під час підготовки бази даних:', error);
  process.exit(1);
});
