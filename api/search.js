// api/search.js — Búsqueda universal via FMP + Yahoo Finance fallback
const FMP_KEY = process.env.FMP_KEY || '0dlNvzu7ctox9bmTSJuIpU29QCO5lLUm';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');
  if(req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { q, limit = 20 } = req.query;
  if(!q) return res.status(400).json({ error: 'q required' });

  try {
    // Try FMP first
    const fmpUrl = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&limit=${limit}&apikey=${FMP_KEY}`;
    const fmpRes = await fetch(fmpUrl);
    const fmpText = await fmpRes.text();
    
    let results = [];
    try {
      const fmpData = JSON.parse(fmpText);
      if(Array.isArray(fmpData) && fmpData.length > 0) {
        results = fmpData.map(r => ({
          symbol: r.symbol,
          name: r.name,
          exchangeShortName: r.exchangeShortName || r.stockExchange || '',
          type: r.type || 'stock',
        }));
      }
    } catch(e) {}

    // If FMP returns nothing, try Yahoo Finance search
    if(results.length === 0) {
      try {
        const yhUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&lang=en-US`;
        const yhRes = await fetch(yhUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        if(yhRes.ok) {
          const yhData = await yhRes.json();
          const quotes = yhData?.quotes || [];
          results = quotes
            .filter(q => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'FUND' || q.quoteType === 'INDEX'))
            .map(q => ({
              symbol: q.symbol,
              name: q.longname || q.shortname || q.symbol,
              exchangeShortName: q.exchange || q.fullExchangeName || '',
              type: q.quoteType?.toLowerCase() || 'stock',
            }));
        }
      } catch(e) {}
    }

    // If still nothing, try Yahoo autosuggest
    if(results.length === 0) {
      try {
        const yhUrl2 = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&lang=es-ES`;
        const yhRes2 = await fetch(yhUrl2, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if(yhRes2.ok) {
          const yhData2 = await yhRes2.json();
          const quotes2 = yhData2?.quotes || [];
          results = quotes2.map(q => ({
            symbol: q.symbol,
            name: q.longname || q.shortname || q.symbol,
            exchangeShortName: q.exchange || '',
            type: q.quoteType?.toLowerCase() || 'stock',
          }));
        }
      } catch(e) {}
    }

    res.json(results.slice(0, +limit));

  } catch(e) {
    res.status(500).json({ error: e.message, stack: e.stack?.slice(0,200) });
  }
}
