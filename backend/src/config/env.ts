import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CORS_ORIGIN: z.string().default('*'),

  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/medilocker?sslmode=disable'),

  // AI (Mistral multi-key pool with dedicated feature keys)
  MISTRAL_API_KEY: z.string().default(''),
  MISTRAL_API_KEY_2: z.string().default(''),
  MISTRAL_API_KEY_DOCUMENT_OCR: z.string().default(''),
  MISTRAL_API_KEY_MEDICINE_SCAN: z.string().default(''),
  MISTRAL_API_KEY_COMPANION: z.string().default(''),
  MISTRAL_API_KEY_VOICE_INTAKE: z.string().default(''),
  MISTRAL_API_KEY_DISEASE_PREDICTION: z.string().default(''),
  MISTRAL_API_KEY_DOUBLE_CODING: z.string().default(''),
  MISTRAL_API_KEY_CLINICAL_TRIAGE: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),

  // Cloudinary (Optional fallback to local)
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  // Supabase (Storage & Platform)
  SUPABASE_URL: z.string().default('https://mmgyamemhbecpytpibrr.supabase.co'),
  SUPABASE_KEY: z.string().default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZ3lhbWVtaGJlY3B5dHBpYnJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODk2NDg0NSwiZXhwIjoyMTA0NTQwODQ1fQ.yodOY_3vL0eOfvUdv-IWHK9ZLytyUT0-grh8P5uEcfY'),
  SUPABASE_ANON_KEY: z.string().default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZ3lhbWVtaGJlY3B5dHBpYnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NjQ4NDUsImV4cCI6MjEwNDU0MDg0NX0.zMTXIwY7bLX2R7odpSkY0YDMq8297tiJbANsFfBjwLk'),
  SUPABASE_BUCKET: z.string().default('medical-records'),

  // Redis (Optional)
  UPSTASH_REDIS_REST_URL: z.string().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(''),

  // Security & WebAuthn
  JWT_SECRET: z.string().default('medilocker-super-secret-jwt-key-change-in-production-32-chars'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  CRON_SECRET: z.string().default('medilocker-cron-secret-2026'),
  WEBAUTHN_RP_NAME: z.string().default('MediLocker'),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:5500'),

  // Email (SMTP / Google App Password)
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_SECURE: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
      return Boolean(val);
    }, z.boolean())
    .default(true),
  SMTP_USER: z.string().default('sentridibesh6@gmail.com'),
  SMTP_PASS: z.string().default('zvaovafwipyfcahm'),
  SMTP_FROM: z.string().default('MediLocker <sentridibesh6@gmail.com>'),

  // HTTP Email Relays (for Render Free Tier where SMTP ports 465/587 are blocked)
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().default('MediLocker <onboarding@resend.dev>'),
  BREVO_API_KEY: z.string().default(''),
  GMAIL_RELAY_URL: z.string().default('https://script.google.com/macros/s/AKfycbxBqSd94SVqzGw1QwVZOYgbTvblQtZApPh5Kz0pCrZe-CJqsx6rj-06QbRI4qttUEn7/exec'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

const DEFAULT_SUPABASE_URL = 'https://mmgyamemhbecpytpibrr.supabase.co';
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZ3lhbWVtaGJlY3B5dHBpYnJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODk2NDg0NSwiZXhwIjoyMTA0NTQwODQ1fQ.yodOY_3vL0eOfvUdv-IWHK9ZLytyUT0-grh8P5uEcfY';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZ3lhbWVtaGJlY3B5dHBpYnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NjQ4NDUsImV4cCI6MjEwNDU0MDg0NX0.zMTXIwY7bLX2R7odpSkY0YDMq8297tiJbANsFfBjwLk';

function isServiceRole(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload && payload.role === 'service_role';
  } catch {
    return false;
  }
}

if (!isServiceRole(parsed.data.SUPABASE_KEY)) {
  parsed.data.SUPABASE_KEY = DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
}

if (!parsed.data.SUPABASE_URL || parsed.data.SUPABASE_URL.includes('pnqubhvcvocytudlwbog')) {
  parsed.data.SUPABASE_URL = DEFAULT_SUPABASE_URL;
  parsed.data.SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;
}

export const env = parsed.data;
