const { waitForDatabase } = require('../src/db');
const { runMigrations, seedDatabase } = require('../src/db/bootstrap');

(async () => {
  await waitForDatabase();
  await runMigrations();
  await seedDatabase(true);
  console.log('Seed-дані успішно підготовлено.');
  process.exit(0);
})().catch((error) => {
  console.error('Помилка підготовки seed-даних:', error);
  process.exit(1);
});
