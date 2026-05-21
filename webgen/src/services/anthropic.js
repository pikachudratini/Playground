const ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '(no body)';
  }
}

// Single-turn completion against the Claude Messages API. Returns plain text.
export async function claudeComplete({
  apiKey,
  model,
  system,
  prompt,
  maxTokens = 4096,
  timeoutMs = 120000,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Anthropic HTTP ${res.status}: ${await safeText(res)}`);
    }
    const json = await res.json();
    return (json.content || [])
      .map((block) => block.text || '')
      .join('')
      .trim();
  } finally {
    clearTimeout(timer);
  }
}

// Extracts the first fenced JSON block (or raw JSON) from a model response.
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
