// api/screener.js — Screener real con 50k+ valores via FMP
const FMP_KEY = process.env.FMP_KEY || '0dlNvzu7ctox9bmTSJuIpU29QCO5lLUm';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');
  if(req.method === 'OPTIONS') { res.status(200).end(); return; }

  const {
    country = '', sector = '', exchange = '',
    mktCapMin = '', mktCapMax = '',
    betaMin = '', betaMax = '',
    dividendMin = '', volumeMin = '',
    priceMin = '', priceMax = '',
    limit = 50, isEtf = '', isFund = ''
  } = req.query;

  try {
    const params = new URLSearchParams({ apikey: FMP_KEY, limit });
    if(country)     params.set('country', country);
    if(sector)      params.set('sector', sector);
    if(exchange)    params.set('exchange', exchange);
    if(mktCapMin)   params.set('marketCapMoreThan', mktCapMin);
    if(mktCapMax)   params.set('marketCapLowerThan', mktCapMax);
    if(betaMin)     params.set('betaMoreThan', betaMin);
    if(betaMax)     params.set('betaLowerThan', betaMax);
    if(dividendMin) params.set('dividendMoreThan', dividendMin);
    if(volumeMin)   params.set('volumeMoreThan', volumeMin);
    if(priceMin)    params.set('priceMoreThan', priceMin);
    if(priceMax)    params.set('priceLowerThan', priceMax);
    if(isEtf)       params.set('isEtf', isEtf);
    if(isFund)      params.set('isFund', isFund);

    const r = await fetch(`https://financialmodelingprep.com/api/v3/stock-screener?${params}`);
    const data = await r.json();

    if(!Array.isArray(data)) return res.status(500).json({ error: 'FMP error', raw: data });

    const results = data.map(s => ({
      sym: s.symbol,
      n: s.companyName || s.symbol,
      exchange: s.exchangeShortName || '',
      sector: s.sector || '',
      industry: s.industry || '',
      country: s.country || '',
      price: s.price || 0,
      mktCap: s.marketCap || 0,
      mktCapL: formatCap(s.marketCap || 0),
      beta: s.beta || null,
      volume: s.volume || 0,
      lastDivYield: s.lastAnnualDividend || 0,
      isEtf: s.isEtf || false,
      isFund: s.isFund || false,
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
