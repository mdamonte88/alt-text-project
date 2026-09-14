import { describe, expect, it, vi } from 'vitest';
import { OllamaAltTextGenerator } from '../src/services/ollama.service';
const input = { buffer: Buffer.from('image'), mimeType: 'image/png' as const, context: { pageTitle: 'Team', caption: null, surroundingText: 'Meet us' } };
describe('OllamaAltTextGenerator', () => {
  it('returns the model suggestion', async () => { vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'A developer at a laptop' }))); await expect(new OllamaAltTextGenerator().generateAltText(input)).resolves.toBe('A developer at a laptop'); });
  it('returns null for malformed model output', async () => { vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 42 }))); await expect(new OllamaAltTextGenerator().generateAltText(input)).resolves.toBeNull(); });
});
