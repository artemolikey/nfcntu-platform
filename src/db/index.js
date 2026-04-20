const crypto = require('crypto');
const env = require('../config/env');

let pool;

if (env.isPgMem) {
  const { newDb, DataType } = require('pg-mem');
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  memoryDb.public.registerFunction({ name: 'gen_random_uuid', returns: DataType.uuid, implementation: () => crypto.randomUUID(), impure: true });
  memoryDb.public.registerFunction({ name: 'version', args: [], returns: DataType.text, implementation: () => 'PostgreSQL 16 (in-memory)' });
  memoryDb.public.registerFunction({ name: 'current_database', args: [], returns: DataType.text, implementation: () => 'nfcntu_platform_local' });
  const adapter = memoryDb.adapters.createPg();
  pool = new adapter.Pool();
} else {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: env.databaseUrl, ssl: env.dbSsl ? { rejectUnauthorized: false } : false });
}

async function query(text, params) { return pool.query(text, params); }

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function waitForDatabase(maxAttempts = 25, delayMs = 2000) {
  if (env.isPgMem) {
    await pool.query('SELECT 1');
    return true;
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

module.exports = { pool, query, withTransaction, waitForDatabase, isPgMem: env.isPgMem };
