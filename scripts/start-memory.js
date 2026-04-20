process.env.DB_CLIENT = 'pgmem';
process.env.AUTO_SEED = process.env.AUTO_SEED || 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { startServer } = require('../src/server');

startServer().catch((error) => {
  console.error('Не вдалося запустити застосунок у вбудованому режимі:', error);
  process.exit(1);
});
