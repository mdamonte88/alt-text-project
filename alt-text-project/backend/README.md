# Suggested Alt API

API Node.js/TypeScript que genera sugerencias de texto alternativo para issues ALT `missing-alt` usando un modelo de visión local de Ollama.

## Configuración

```bash
npm install
cp .env.example .env
# Configurar OLLAMA_MODEL con un modelo de Ollama que soporte imágenes
npm run dev
```

Variables: `PORT`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `MAX_IMAGE_SIZE_MB` e `IMAGE_FETCH_TIMEOUT_MS`.

## Endpoint

`POST /api/suggest-alt` con `Content-Type: application/json`.

```json
{
  "type": "missing-alt",
  "context": {
    "pageTitle": "Our engineering team",
    "src": "https://site.example/images/developer.jpg",
    "caption": null,
    "surroundingText": "Meet the people building our applications."
  },
  "image": {
    "type": "url",
    "value": "https://site.example/images/developer.jpg"
  }
}
```

También acepta `image.type: "base64"` con `mimeType` `image/jpeg`, `image/png` o `image/webp`. El backend resuelve los píxeles, valida tamaño/MIME y bloquea hosts locales, privados e internos al descargar URLs.

Respuesta exitosa:

```json
{ "suggestedAlt": "Developer working at a laptop in an office" }
```

Si el modelo no produce una sugerencia confiable, devuelve `{ "suggestedAlt": null }`. Los errores usan `{ "error": { "code": "...", "message": "..." } }`.

El backend no inspecciona ni modifica el DOM; conserva el contexto ALT recibido.

Scripts: `npm run dev`, `npm run build`, `npm run typecheck`, `npm test`.
