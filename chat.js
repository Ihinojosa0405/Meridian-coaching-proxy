/**
 * Meridian Coaching Proxy
 * Vercel serverless function — keeps the Anthropic API key server-side.
 * Deploy this backend/ folder to Vercel separately from the SCORM package.
 */

export default async function handler(req, res) {
  // CORS — allow requests from any origin (LMS iframes vary)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Simple bearer-token check — token is in SCORM bundle but Anthropic key is not
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  if (process.env.COACHING_TOKEN && token !== process.env.COACHING_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { messages, systemPrompt } = req.body ?? {};
  if (!messages || !systemPrompt) {
    return res.status(400).json({ error: 'Missing messages or systemPrompt' });
  }

  // Forward to Anthropic with the server-side API key
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  }

  // Stream the Anthropic SSE response directly back to the browser
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || res.writableEnded) break;
      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}
