const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const rootDir = path.resolve(__dirname, '..', '..');
const storageDir = path.join(rootDir, 'storage');
const uploadsDir = path.join(storageDir, 'uploads');
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nfcntu_platform';
const dbClient = process.env.DB_CLIENT || (databaseUrl === 'memory://local' ? 'pgmem' : 'postgres');

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  databaseUrl,
  dbClient,
  isPgMem: dbClient === 'pgmem',
  dbSsl: process.env.DB_SSL === 'true',
  sessionSecret: process.env.SESSION_SECRET || 'change-this-session-secret',
  autoSeed: process.env.AUTO_SEED !== 'false',
  uploadMaxSizeMb: Number(process.env.UPLOAD_MAX_SIZE_MB || 10),
  rootDir,
  storageDir,
  uploadsDir
};
