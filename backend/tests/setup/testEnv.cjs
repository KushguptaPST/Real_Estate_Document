// Jest setupFiles hook — runs before any test module (and therefore before any
// PrismaClient) is loaded. Forces every test run onto an isolated database and
// refuses to start if that database is not clearly a throwaway test database.
const fs = require('node:fs');
const path = require('node:path');

function readTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const localFile = path.resolve(__dirname, '../../.env.test.local');
  if (fs.existsSync(localFile)) {
    const line = fs
      .readFileSync(localFile, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('DATABASE_URL='));
    if (line) return line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '');
  }
  return null;
}

const url = readTestDatabaseUrl();
if (!url) {
  throw new Error(
    'Refusing to run tests: set TEST_DATABASE_URL or create backend/.env.test.local with DATABASE_URL=<..._test database>',
  );
}

const dbName = new URL(url).pathname.replace(/^\//, '');
if (!/_test$/.test(dbName)) {
  throw new Error(`Refusing to run tests against database "${dbName}" — test database names must end in "_test"`);
}

// The app currently creates one PrismaClient (pool) per module; cap each pool so a
// full in-band run stays well under the server's max_connections.
const testUrl = new URL(url);
if (!testUrl.searchParams.has('connection_limit')) testUrl.searchParams.set('connection_limit', '1');

// Prisma's .env loader never overrides variables that are already set.
process.env.DATABASE_URL = testUrl.toString();
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-0123456789abcdef0123456789abcdef';
process.env.ENABLE_DEMO_LOGIN = 'false';
process.env.GEMINI_API_KEY = '';
process.env.RESEND_API_KEY = '';
process.env.EMAIL_DRIVER = 'resend';
// Never touch live providers from tests (dev .env may configure ImageKit, Twilio, Stripe...).
process.env.STORAGE_DRIVER = 'local';
for (const name of [
  'IMAGEKIT_PRIVATE_KEY', 'IMAGEKIT_PUBLIC_KEY', 'SENDGRID_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
  'STRIPE_SECRET_KEY', 'ANTHROPIC_API_KEY', 'WEBHOOK_SECRET', 'EMAIL_WEBHOOK_SECRET', 'INBOUND_WEBHOOK_SECRET',
]) {
  process.env[name] = '';
}
