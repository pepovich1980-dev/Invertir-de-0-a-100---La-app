// api/screener.js — Screener via FMP con filtros fundamentales
const FMP_KEY = process.env.FMP_KEY || '0dlNvzu7ctox9bmTSJuIpU29QCO5lLUm';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');
  if(req.method === 'OPTIONS') { res.status(200).end(); return; }

  const {
    country='', sector='', exchange='', industry='',
    mktCapMin='', mktCapMax='',
    betaMin='', betaMax='',
    dividendMin='', volumeMin='',
    priceMin='', priceMax='',
    isEtf='', isFund='',
    limit=50
  } = req.query;

  try {
    // Step 1: FMP stock screener (market/price/beta filters)
    const params = new URLSearchParams({ apikey: FMP_KEY, limit: Math.min(+limit||50, 250) });
    if(country)     params.set('country', country);
    if(sector)      params.set('sector', sector);
    if(industry)    params.set('industry', industry);
    if(exchange)    params.set('exchange', exchange);
    if(mktCapMin)   params.set('marketCapMoreThan', String(+mktCapMin * 1e6));
    if(mktCapMax)   params.set('marketCapLowerThan', String(+mktCapMax * 1e6));
    if(betaMin)     params.set('betaMoreThan', betaMin);
    if(betaMax)     params.set('betaLowerThan', betaMax);
    if(dividendMin) params.set('dividendMoreThan', dividendMin);
    if(volumeMin)   params.set('volumeMoreThan', volumeMin);
    if(priceMin)    params.set('priceMoreThan', priceMin);
    if(priceMax)    params.set('priceLowerThan', priceMax);
    if(isEtf==='true')  params.set('isEtf', 'true');
    if(isFund==='true') params.set('isFund', 'true');

    const r = await fetch(`https://financialmodelingprep.com/api/v3/stock-screener?${params}`);
    if(!r.ok) return res.status(r.status).json({ error: `FMP error ${r.status}` });
    const data = await r.json();
    if(!Array.isArray(data)) return res.status(500).json({ error: 'FMP returned invalid data', raw: JSON.stringify(data).slice(0,200) });

    const results = data.map(s => ({
      sym:      s.symbol,
      n:        s.companyName || s.symbol,
      exchange: s.exchangeShortName || '',
      sector:   s.sector || '',
      industry: s.industry || '',
      country:  s.country || '',
      price:    s.price || 0,
      mktCap:   s.marketCap || 0,
      mktCapL:  formatCap(s.marketCap || 0),
      beta:     s.beta != null ? +s.beta : null,
      volume:   s.volume || 0,
      lastDiv:  s.lastAnnualDividend || 0,
      isEtf:    s.isEtf || false,
      isFund:   s.isFund || false,
    }));

    res.json({ count: results.length, results });
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
