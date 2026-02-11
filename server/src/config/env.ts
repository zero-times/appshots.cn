import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Support running from monorepo root and server package directory.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://codex-api.packycode.com/v1',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.3',
  databaseUrl: process.env.DATABASE_URL || './data/appshots.db',
  jwtSecret: process.env.JWT_SECRET || 'appshots-dev-secret-do-not-use-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  adminKey: process.env.ADMIN_KEY || '',
  // SMTP
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '465', 10),
  smtpSecure: process.env.SMTP_SECURE !== 'false',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFromName: process.env.MAIL_FROM_NAME || 'Appshots',
  mailFromAddress: process.env.MAIL_FROM_ADDRESS || '',
};
