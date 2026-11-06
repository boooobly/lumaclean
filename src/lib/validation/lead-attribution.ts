import {z} from 'zod';
import {entrySources} from '@/lib/analytics';

export const leadAttributionSchema = z.object({
  landing: z.string().max(200),
  source: z.enum(entrySources),
}).strict();
