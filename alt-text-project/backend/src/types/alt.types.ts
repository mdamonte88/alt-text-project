export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];
export interface AltContext { pageTitle?: string; src?: string; caption?: string | null; surroundingText?: string; }
export type ImageInput = { type: 'url'; value: string } | { type: 'base64'; mimeType: SupportedImageMimeType; value: string };
export interface SuggestAltRequest { type: 'missing-alt'; context: AltContext; image: ImageInput; }
export interface ResolvedImage { buffer: Buffer; mimeType: SupportedImageMimeType; }
export interface GenerateAltInput extends ResolvedImage { context: AltContext; }
export interface OllamaGenerateResponse { response?: unknown; }
export class AppError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) { super(message); this.name = 'AppError'; }
}
