// api/prices.js — Proxy Yahoo Finance sin CORS
// Vercel serverless function — llamada desde el frontend
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  // Support multi-symbol: ?sym=AAPL,MSFT,^IBEX
  const symbols = sym.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  
  const results = await Promise.allSettled(
    symbols.map(async s => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=5d`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }
      });
      const data = await r.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return null;
      const price = meta.regularMarketPrice;
      const pct = meta.regularMarketChangePercent ??
        (meta.chartPreviousClose > 0 ? ((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100 : null);
      return { sym: s, price, pct, currency: meta.currency || '', name: meta.longName || meta.shortName || s };
    })
  );

  const data = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) data[symbols[i]] = r.value;
  });

  if (symbols.length === 1) {
    const single = data[symbols[0]];
    return single ? res.json(single) : res.status(404).json({ error: 'no data' });
  }
  res.json(data);
}
