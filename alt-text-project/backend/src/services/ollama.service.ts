import { env } from '../config/env';
import { buildAltPrompt } from '../prompts/alt.prompt';
import { AppError, GenerateAltInput, OllamaGenerateResponse } from '../types/alt.types';
export interface AltTextGenerator { generateAltText(input: GenerateAltInput): Promise<string | null>; }
export class OllamaAltTextGenerator implements AltTextGenerator {
  async generateAltText(input: GenerateAltInput): Promise<string | null> {
    let response: Response;
    try { response = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.OLLAMA_MODEL, prompt: buildAltPrompt(input.context), images: [input.buffer.toString('base64')], stream: false }), signal: AbortSignal.timeout(120000) }); }
    catch (e) { if (e instanceof Error && e.name === 'TimeoutError') throw new AppError(504, 'OLLAMA_TIMEOUT', 'Ollama request timed out.'); throw new AppError(502, 'OLLAMA_UNAVAILABLE', 'Ollama is unavailable.'); }
    if (!response.ok) throw new AppError(502, 'OLLAMA_UNAVAILABLE', 'Ollama is unavailable.');
    let data: OllamaGenerateResponse; try { data = await response.json() as OllamaGenerateResponse; } catch { return null; }
    if (typeof data.response !== 'string') return null;
    const alt = data.response.trim().replace(/^['"]|['"]$/g, '').trim(); return alt || null;
  }
}
export const altTextGenerator = new OllamaAltTextGenerator();
