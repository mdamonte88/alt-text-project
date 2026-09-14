import { z } from 'zod';
import { SUPPORTED_IMAGE_MIME_TYPES } from '../types/alt.types';

const contextSchema = z.object({
  pageTitle: z.string().max(2000).optional(), src: z.string().max(10000).optional(),
  caption: z.string().max(2000).nullable().optional(), surroundingText: z.string().max(10000).optional(),
}).strict();
const imageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('url'), value: z.string().url() }).strict(),
  z.object({ type: z.literal('base64'), mimeType: z.enum(SUPPORTED_IMAGE_MIME_TYPES), value: z.string().min(1) }).strict(),
]);
export const suggestAltRequestSchema = z.object({ type: z.literal('missing-alt'), context: contextSchema.default({}), image: imageSchema }).strict();
