// api/fundamentals.js — Datos fundamentales de cualquier valor via FMP
const FMP_KEY = process.env.FMP_KEY || '0dlNvzu7ctox9bmTSJuIpU29QCO5lLUm';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');
  if(req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { sym } = req.query;
  if(!sym) return res.status(400).json({ error: 'sym required' });

  try {
    const [profileRes, ratiosRes, quoteRes] = await Promise.allSettled([
      fetch(`https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(sym)}?apikey=${FMP_KEY}`),
      fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${encodeURIComponent(sym)}?apikey=${FMP_KEY}`),
      fetch(`https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(sym)}?apikey=${FMP_KEY}`)
    ]);

    let profile = {}, ratios = {}, quote = {};

    if(profileRes.status === 'fulfilled' && profileRes.value.ok) {
      const d = await profileRes.value.json();
      if(Array.isArray(d) && d[0]) profile = d[0];
    }
    if(ratiosRes.status === 'fulfilled' && ratiosRes.value.ok) {
      const d = await ratiosRes.value.json();
      if(Array.isArray(d) && d[0]) ratios = d[0];
    }
    if(quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
      const d = await quoteRes.value.json();
      if(Array.isArray(d) && d[0]) quote = d[0];
    }

    res.json({
      sym,
      name: profile.companyName || sym,
      sector: profile.sector || '',
      industry: profile.industry || '',
      country: profile.country || '',
      exchange: profile.exchangeShortName || '',
      currency: profile.currency || '',
      description: profile.description || '',
      // Price data
      price: quote.price || profile.price || 0,
      pct: quote.changesPercentage || 0,
      mktCap: quote.marketCap || profile.mktCap || 0,
      mktCapL: formatCap(quote.marketCap || profile.mktCap || 0),
      // Fundamentals
      per: ratios.peRatioTTM || quote.pe || null,
      evEbitda: ratios.enterpriseValueMultipleTTM || null,
      mop: ratios.operatingProfitMarginTTM ? ratios.operatingProfitMarginTTM * 100 : null,
      mNet: ratios.netProfitMarginTTM ? ratios.netProfitMarginTTM * 100 : null,
      roe: ratios.returnOnEquityTTM ? ratios.returnOnEquityTTM * 100 : null,
      roic: ratios.returnOnInvestedCapitalTTM ? ratios.returnOnInvestedCapitalTTM * 100 : null,
      debtEq: ratios.debtEquityRatioTTM || null,
      eps: ratios.epsTTM || quote.eps || null,
      beta: profile.beta || null,
      // Growth (from profile)
      website: profile.website || '',
      image: profile.image || '',
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

function formatCap(n) {
  if(!n) return '—';
  if(n >= 1e12) return '$' + (n/1e12).toFixed(1) + 'T';
  if(n >= 1e9)  return '$' + (n/1e9).toFixed(0) + 'B';
  if(n >= 1e6)  return '$' + (n/1e6).toFixed(0) + 'M';
  return '$' + n.toLocaleString();
}
