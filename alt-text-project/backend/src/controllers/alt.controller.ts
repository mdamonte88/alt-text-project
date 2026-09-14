import { NextFunction, Request, Response } from 'express';
import { suggestAltRequestSchema } from '../validators/alt.validator';
import { imageResolver } from '../services/image-resolver.service';
import { altTextGenerator } from '../services/ollama.service';
import { AppError } from '../types/alt.types';
export async function suggestAlt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const parsed = suggestAltRequestSchema.safeParse(req.body); if (!parsed.success) throw new AppError(400, 'INVALID_REQUEST', parsed.error.issues[0]?.message ?? 'Invalid request.'); const resolved = await imageResolver.resolve(parsed.data.image); const suggestedAlt = await altTextGenerator.generateAltText({ ...resolved, context: parsed.data.context }); res.json({ suggestedAlt }); }
  catch (error) { next(error); }
}
