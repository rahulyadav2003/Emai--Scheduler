import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// Load .env from multiple potential execution paths (root or backend directory)
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

// Fallback attempt in case no specific path was matched
dotenv.config();

// Helper to preprocess empty strings as undefined so defaults can trigger properly
const emptyToUndefined = (val: unknown) => {
  if (typeof val === 'string' && val.trim() === '') {
    return undefined;
  }
  return val;
};

const envSchema = z.object({
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().default(3001)),
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(['development', 'production', 'test']).default('development')
  ),
  FRONTEND_URL: z.preprocess(
    emptyToUndefined,
    z.string().default('http://localhost:3000')
  ),

  // PostgreSQL Database
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().default('postgresql://postgres:postgrespassword@localhost:5432/email_scheduler?schema=public')
  ),

  // Redis
  REDIS_URL: z.preprocess(emptyToUndefined, z.string().optional().default('')),
  REDIS_HOST: z.preprocess(emptyToUndefined, z.string().default('127.0.0.1')),
  REDIS_PORT: z.preprocess(emptyToUndefined, z.coerce.number().default(6379)),
  REDIS_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional().default('')),
  REDIS_TLS: z.preprocess(emptyToUndefined, z.coerce.boolean().default(false)),

  // Authentication
  JWT_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().default('default-super-secret-jwt-key-for-development-change-in-prod')
  ),
  JWT_EXPIRES_IN: z.preprocess(emptyToUndefined, z.string().default('7d')),

  // Google OAuth (Optional in dev, required in prod for live OAuth)
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional().default('')),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional().default('')),
  GOOGLE_CALLBACK_URL: z.preprocess(
    emptyToUndefined,
    z.string().default('http://localhost:3001/api/auth/google/callback')
  ),

  // Slack Integration (Optional)
  SLACK_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional().default('')),
  SLACK_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional().default('')),
  SLACK_REDIRECT_URI: z.preprocess(
    emptyToUndefined,
    z.string().default('http://localhost:3001/api/slack/callback')
  ),

  // Worker & Scheduler Configuration
  WORKER_CONCURRENCY: z.preprocess(emptyToUndefined, z.coerce.number().default(5)),
  DEFAULT_MIN_DELAY_MS: z.preprocess(emptyToUndefined, z.coerce.number().default(2000)),
  DEFAULT_HOURLY_LIMIT: z.preprocess(emptyToUndefined, z.coerce.number().default(100)),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('⚠️ Environment variables warning:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    return envSchema.parse({});
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
