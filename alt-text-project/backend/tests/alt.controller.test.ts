import { describe, expect, it, vi } from 'vitest';
import { suggestAlt } from '../src/controllers/alt.controller';
const body = { type: 'missing-alt', context: { pageTitle: 'Team', caption: null, surroundingText: 'Meet us' }, image: { type: 'base64', mimeType: 'image/png', value: Buffer.from('hello').toString('base64') } };
const invoke = async (requestBody: unknown) => { const json = vi.fn(); const next = vi.fn(); await suggestAlt({ body: requestBody } as any, { json } as any, next); return { json, next }; };
describe('suggestAlt controller', () => {
  it('returns a normalized suggestedAlt response', async () => { vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ response: 'A blue bicycle' }))); const r = await invoke(body); expect(r.json).toHaveBeenCalledWith({ suggestedAlt: 'A blue bicycle' }); expect(r.next).not.toHaveBeenCalled(); });
  it('rejects missing image and other issue types', async () => { const r = await invoke({ type: 'decorative', context: {} }); expect(r.next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_REQUEST' })); });
});
