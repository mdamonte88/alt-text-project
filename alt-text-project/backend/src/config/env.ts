import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().min(1, 'OLLAMA_MODEL is required'),
  MAX_IMAGE_SIZE_MB: z.coerce.number().positive().default(10),
  IMAGE_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

export const env = envSchema.parse(process.env);
