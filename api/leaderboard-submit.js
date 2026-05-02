export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { playerName, score, difficulty, grade } = req.body ?? {};
  if (!playerName || score == null || !difficulty || !grade)
    return res.status(400).json({ error: 'Missing required fields' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey)
    return res.status(500).json({ error: 'Leaderboard not configured' });

  const response = await fetch(`${supabaseUrl}/rest/v1/leaderboard`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ player_name: playerName, score, difficulty, grade }),
  });

  if (!response.ok) {
    const text = await response.text();
    return res.status(500).json({ error: 'Failed to save score', detail: text });
  }

  return res.status(200).json({ ok: true });
}
Commit it. Then create api/leaderboard-get.js:


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey)
    return res.status(500).json({ error: 'Leaderboard not configured' });

  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  const [topRes, countRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/leaderboard?select=player_name,score,difficulty,grade,created_at&order=score.desc&limit=10`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/leaderboard?select=count`, { headers: { ...headers, 'Prefer': 'count=exact' } }),
  ]);

  if (!topRes.ok) {
    const text = await topRes.text();
    return res.status(500).json({ error: 'Failed to fetch leaderboard', detail: text });
  }

  const top10 = await topRes.json();
  const totalCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] ?? '0', 10);

  return res.status(200).json({ top10, totalCount });
}
