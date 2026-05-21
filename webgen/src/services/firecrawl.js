const ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '(no body)';
  }
}

// Scrapes a page through the Firecrawl API. Returns { html, markdown, metadata }.
export async function firecrawlScrape(url, apiKey, { timeoutMs = 45000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Firecrawl HTTP ${res.status}: ${await safeText(res)}`);
    }
    const json = await res.json();
    const data = json.data || json;
    return {
      html: data.html || data.rawHtml || '',
      markdown: data.markdown || '',
      metadata: data.metadata || {},
    };
  } finally {
    clearTimeout(timer);
  }
}

// Plain fetch fallback used when no Firecrawl key is configured.
export async function plainFetch(url, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; webgen/0.1; +https://localhost)',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Fetch HTTP ${res.status}`);
    return { html: await res.text(), markdown: '', metadata: {} };
  } finally {
    clearTimeout(timer);
  }
}
