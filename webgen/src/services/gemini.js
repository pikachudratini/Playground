const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '(no body)';
  }
}

// Generates a single image with a Gemini image model ("Nano Banana 2").
// Returns { base64, mime } on success.
export async function geminiImage({ apiKey, model, prompt, timeoutMs = 90000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}: ${await safeText(res)}`);
    }
    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const image = parts.find((p) => p.inlineData?.data);
    if (!image) throw new Error('Gemini returned no inline image data');
    return {
      base64: image.inlineData.data,
      mime: image.inlineData.mimeType || 'image/png',
    };
  } finally {
    clearTimeout(timer);
  }
}
