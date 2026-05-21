async function safeText(res) {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return '(no body)';
  }
}

// Deploys a set of inline text files to Vercel as a production deployment.
// files: [{ file: 'index.html', data: '<string>' }]
export async function vercelDeploy({
  token,
  teamId,
  name,
  files,
  timeoutMs = 120000,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  try {
    const res = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name,
        target: 'production',
        files: files.map((f) => ({
          file: f.file,
          data: f.data,
          ...(f.encoding ? { encoding: f.encoding } : {}),
        })),
        projectSettings: {
          framework: null,
          buildCommand: null,
          outputDirectory: null,
          installCommand: null,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Vercel HTTP ${res.status}: ${await safeText(res)}`);
    }
    const json = await res.json();
    const host = json.alias?.[0] || json.url;
    return {
      id: json.id,
      url: host ? `https://${host}` : '',
      inspectorUrl: json.inspectorUrl || '',
    };
  } finally {
    clearTimeout(timer);
  }
}
