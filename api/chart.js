// api/chart.js — Historical chart data sin CORS
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { sym, range = '1mo', interval = '1d' } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
  const data = await r.json();
  const result = data?.chart?.result?.[0];
  if (!result) return res.status(404).json({ error: 'no data' });

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const points = timestamps
    .map((t, i) => ({ date: new Date(t * 1000).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }), close: closes[i] }))
    .filter(p => p.close != null);

  // Multi-period performance
  const meta = result.meta || {};
  const valid = closes.filter(x => x != null);
  const perf = valid.length >= 2 ? ((valid[valid.length-1] - valid[0]) / valid[0]) * 100 : null;

  res.json({ sym, range, interval, points, perf, meta: { price: meta.regularMarketPrice, currency: meta.currency, name: meta.longName || meta.shortName } });
}
