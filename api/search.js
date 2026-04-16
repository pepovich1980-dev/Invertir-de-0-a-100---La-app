// api/search.js — Búsqueda universal de valores via FMP
const FMP_KEY = process.env.FMP_KEY || '0dlNvzu7ctox9bmTSJuIpU29QCO5lLUm';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');
  if(req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { q, limit = 20 } = req.query;
  if(!q) return res.status(400).json({ error: 'q required' });

  try {
    // Search stocks, ETFs, funds, indices
    const [stocksRes, etfRes] = await Promise.allSettled([
      fetch(`https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&limit=${limit}&apikey=${FMP_KEY}`),
      fetch(`https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&limit=10&exchange=ETF&apikey=${FMP_KEY}`)
    ]);

    let results = [];
    if(stocksRes.status === 'fulfilled' && stocksRes.value.ok) {
      const data = await stocksRes.value.json();
      if(Array.isArray(data)) results = data;
    }

    res.json(results.slice(0, limit));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
