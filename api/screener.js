// api/screener.js — Screener via Yahoo Finance (sin necesidad de FMP premium)
const FMP_KEY = process.env.FMP_KEY || '0dlNvzu7ctox9bmTSJuIpU29QCO5lLUm';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');
  if(req.method === 'OPTIONS') { res.status(200).end(); return; }

  const {
    country='', sector='', exchange='',
    mktCapMin='', mktCapMax='',
    betaMin='', betaMax='',
    priceMin='', priceMax='',
    isEtf='', isFund='',
    limit=50
  } = req.query;

  // Try FMP first (may work on free plan with simpler params)
  try {
    const params = new URLSearchParams({ apikey: FMP_KEY, limit: Math.min(+limit||50, 250) });
    if(country)   params.set('country', country);
    if(sector)    params.set('sector', sector);
    if(exchange)  params.set('exchange', exchange);
    if(priceMin)  params.set('priceMoreThan', priceMin);
    if(priceMax)  params.set('priceLowerThan', priceMax);
    if(betaMin)   params.set('betaMoreThan', betaMin);
    if(betaMax)   params.set('betaLowerThan', betaMax);
    if(mktCapMin) params.set('marketCapMoreThan', String(+mktCapMin * 1e6));
    if(mktCapMax) params.set('marketCapLowerThan', String(+mktCapMax * 1e6));
    if(isEtf==='true')  params.set('isEtf', 'true');
    if(isFund==='true') params.set('isFund', 'true');

    const r = await fetch(`https://financialmodelingprep.com/api/v3/stock-screener?${params}`);
    
    if(r.ok) {
      const data = await r.json();
      if(Array.isArray(data) && data.length > 0) {
        const results = data.map(s => ({
          sym: s.symbol, n: s.companyName || s.symbol,
          exchange: s.exchangeShortName || '',
          sector: s.sector || '', industry: s.industry || '',
          country: s.country || '', price: s.price || 0,
          mktCap: s.marketCap || 0,
          mktCapL: formatCap(s.marketCap || 0),
          beta: s.beta != null ? +s.beta : null,
          isEtf: s.isEtf || false, isFund: s.isFund || false,
        }));
        return res.json({ count: results.length, results, source: 'fmp' });
      }
    }

    // Log the FMP error for debugging
    const errText = await r.text().catch(() => '');
    console.log('FMP screener error:', r.status, errText.slice(0,200));
  } catch(e) {
    console.log('FMP error:', e.message);
  }

  // Fallback: Yahoo Finance screener
  try {
    // Build Yahoo Finance screener query
    const yhParams = new URLSearchParams({
      formatted: 'false',
      lang: 'en-US',
      region: country || 'US',
      size: Math.min(+limit||50, 100),
      offset: 0,
    });

    // Map sector to Yahoo's format
    const sectorMap = {
      'Technology': 'Technology',
      'Healthcare': 'Healthcare',
      'Financial Services': 'Financial Services',
      'Consumer Cyclical': 'Consumer Cyclical',
      'Industrials': 'Industrials',
      'Communication Services': 'Communication Services',
      'Consumer Defensive': 'Consumer Defensive',
      'Energy': 'Energy',
      'Basic Materials': 'Basic Materials',
      'Real Estate': 'Real Estate',
      'Utilities': 'Utilities',
    };

    // Use Yahoo Finance v1 screener
    const filters = [];
    if(priceMin)  filters.push(`intradaymarketcap.value:[${+priceMin} TO Infinity]`);
    if(betaMin)   filters.push(`beta.value:[${betaMin} TO Infinity]`);
    if(betaMax)   filters.push(`beta.value:[0 TO ${betaMax}]`);
    if(mktCapMin) filters.push(`intradaymarketcap.value:[${+mktCapMin*1e6} TO Infinity]`);
    if(mktCapMax) filters.push(`intradaymarketcap.value:[0 TO ${+mktCapMax*1e6}]`);
    if(sector && sectorMap[sector]) filters.push(`sector.value:["${sectorMap[sector]}"]`);

    // Use Yahoo Finance screener API
    const yhUrl = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&lang=en-US&region=${country||'US'}&scrIds=most_actives&size=${Math.min(+limit||50,100)}&offset=0`;
    
    const yhRes = await fetch(yhUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' }
    });

    if(yhRes.ok) {
      const yhData = await yhRes.json();
      const quotes = yhData?.finance?.result?.[0]?.quotes || [];
      const results = quotes.map(q => ({
        sym: q.symbol,
        n: q.longName || q.shortName || q.symbol,
        exchange: q.exchange || q.fullExchangeName || '',
        sector: q.sector || '',
        industry: q.industry || '',
        country: country || 'US',
        price: q.regularMarketPrice || 0,
        mktCap: q.marketCap || 0,
        mktCapL: formatCap(q.marketCap || 0),
        beta: q.beta || null,
        isEtf: q.quoteType === 'ETF',
        isFund: q.quoteType === 'MUTUALFUND',
      }));
      if(results.length > 0) {
        return res.json({ count: results.length, results, source: 'yahoo' });
      }
    }
  } catch(e) {
    console.log('Yahoo screener error:', e.message);
  }

  // Last resort: return curated static list filtered by params
  const STATIC = [
    {sym:'AAPL',n:'Apple Inc.',exchange:'NASDAQ',sector:'Technology',country:'US',price:203,mktCap:3.4e12,mktCapL:'$3.4T',beta:1.2},
    {sym:'MSFT',n:'Microsoft Corp.',exchange:'NASDAQ',sector:'Technology',country:'US',price:415,mktCap:3.1e12,mktCapL:'$3.1T',beta:0.9},
    {sym:'NVDA',n:'NVIDIA Corp.',exchange:'NASDAQ',sector:'Technology',country:'US',price:875,mktCap:2.1e12,mktCapL:'$2.1T',beta:1.8},
    {sym:'GOOGL',n:'Alphabet Inc.',exchange:'NASDAQ',sector:'Technology',country:'US',price:178,mktCap:2.0e12,mktCapL:'$2.0T',beta:1.1},
    {sym:'AMZN',n:'Amazon.com Inc.',exchange:'NASDAQ',sector:'Consumer Cyclical',country:'US',price:196,mktCap:1.9e12,mktCapL:'$1.9T',beta:1.3},
    {sym:'META',n:'Meta Platforms',exchange:'NASDAQ',sector:'Technology',country:'US',price:580,mktCap:1.5e12,mktCapL:'$1.5T',beta:1.4},
    {sym:'TSLA',n:'Tesla Inc.',exchange:'NASDAQ',sector:'Consumer Cyclical',country:'US',price:248,mktCap:0.8e12,mktCapL:'$800B',beta:2.3},
    {sym:'JPM',n:'JPMorgan Chase',exchange:'NYSE',sector:'Financial Services',country:'US',price:238,mktCap:0.72e12,mktCapL:'$720B',beta:1.1},
    {sym:'PLTR',n:'Palantir Technologies',exchange:'NYSE',sector:'Technology',country:'US',price:89,mktCap:0.19e12,mktCapL:'$190B',beta:2.6},
    {sym:'IONQ',n:'IonQ Inc.',exchange:'NYSE',sector:'Technology',country:'US',price:35,mktCap:9.8e9,mktCapL:'$9.8B',beta:3.1},
    {sym:'ITX.MC',n:'Inditex',exchange:'BME',sector:'Consumer Cyclical',country:'ES',price:52,mktCap:0.162e12,mktCapL:'$162B',beta:0.8},
    {sym:'SAN.MC',n:'Banco Santander',exchange:'BME',sector:'Financial Services',country:'ES',price:5.2,mktCap:0.088e12,mktCapL:'$88B',beta:1.4},
    {sym:'BBVA.MC',n:'BBVA',exchange:'BME',sector:'Financial Services',country:'ES',price:12.4,mktCap:0.082e12,mktCapL:'$82B',beta:1.3},
    {sym:'ASML',n:'ASML Holding',exchange:'NASDAQ',sector:'Technology',country:'NL',price:785,mktCap:0.31e12,mktCapL:'$310B',beta:1.2},
    {sym:'SAP',n:'SAP SE',exchange:'NYSE',sector:'Technology',country:'DE',price:240,mktCap:0.29e12,mktCapL:'$290B',beta:0.9},
    {sym:'VOO',n:'Vanguard S&P 500 ETF',exchange:'NYSE',sector:'ETF',country:'US',price:520,mktCap:null,mktCapL:'ETF',beta:1.0,isEtf:true},
    {sym:'QQQ',n:'Invesco QQQ Trust',exchange:'NASDAQ',sector:'ETF',country:'US',price:463,mktCap:null,mktCapL:'ETF',beta:1.1,isEtf:true},
  ];

  let filtered = STATIC;
  if(country) filtered = filtered.filter(s => s.country === country);
  if(sector)  filtered = filtered.filter(s => s.sector === sector);
  if(exchange) filtered = filtered.filter(s => s.exchange === exchange);
  if(betaMin)  filtered = filtered.filter(s => s.beta >= +betaMin);
  if(betaMax)  filtered = filtered.filter(s => s.beta <= +betaMax);

  res.json({ count: filtered.length, results: filtered, source: 'static' });
}

function formatCap(n) {
  if(!n) return '—';
  if(n >= 1e12) return '$' + (n/1e12).toFixed(1) + 'T';
  if(n >= 1e9)  return '$' + (n/1e9).toFixed(0) + 'B';
  if(n >= 1e6)  return '$' + (n/1e6).toFixed(0) + 'M';
  return '$' + n.toLocaleString();
}
