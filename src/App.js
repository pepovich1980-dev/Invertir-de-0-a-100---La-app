import { useState, useEffect, useRef, useCallback } from "react";

// ─── API HELPER ──────────────────────────────────────────────────────────────
const API_BASE = process.env.NODE_ENV === 'production' ? '' : '';
const API = {
  async prices(syms) {
    // syms: string or array
    const s = Array.isArray(syms) ? syms.join(',') : syms;
    const r = await fetch(`${API_BASE}/api/prices?sym=${encodeURIComponent(s)}`);
    return r.json();
  },
  async chart(sym, range = '1mo', interval = '1d') {
    const r = await fetch(`${API_BASE}/api/chart?sym=${encodeURIComponent(sym)}&range=${range}&interval=${interval}`);
    return r.json();
  }
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const DEFAULT_CATS = [
  { cat:'CASA', items:['Hipoteca / Alquiler','Comunidad / IBI / mantenimiento','Suministros','Seguro hogar','Tasas','Telecomunicaciones'] },
  { cat:'VIDA DIARIA', items:['Cesta de la compra','Servicio de limpieza','Otros vida diaria'] },
  { cat:'TRANSPORTE', items:['Combustible','Reparaciones','Lavado del coche','Aparcamiento','Transporte público','Seguro vehículo'] },
  { cat:'EDUCACIÓN', items:['Guardería / Colegio / Universidad','Actividades extraescolares','Otros educación'] },
  { cat:'SALUD', items:['Cuota del gimnasio','Seguro médico privado','Medicamentos','Veterinario / mascotas','Seguro de vida'] },
  { cat:'VACACIONES', items:['Billetes de avión','Hoteles','Comida viaje','Regalos viaje'] },
  { cat:'OCIO', items:['Restaurantes','Cuotas del equipo','Plataformas Streaming','Conciertos y fiestas','Otros ocio'] },
  { cat:'PERSONAL', items:['Ropa','Regalos','Peluquería / barbería','Libros','Otros personal'] },
  { cat:'OBLIGACIONES FINANCIERAS', items:['Obligaciones financieras','Ahorros a largo plazo','Plan de jubilación','Pagos tarjeta crédito','Impuesto renta adicional','Otras obligaciones'] },
  { cat:'PAGOS VARIOS', items:['Otros 1','Otros 2','Otros 3','Otros 4','Otros 5'] },
];

const PROFILES = [
  { id:'conservador', label:'Conservador', minScore:6,  maxScore:15,  retExp:2.0, std:3.8,  color:'#4caf7d',
    desc:'Preservación de capital. RV 0–20% / RF 80–100%. Rent. esperada 2%/año. σ ±3.8%.' },
  { id:'moderado',    label:'Moderado',    minScore:16, maxScore:27,  retExp:5.0, std:6.3,  color:'#5b9bd5',
    desc:'Equilibrio. RV 20–60% / RF 40–80%. Rent. esperada 5%/año. σ ±6.3%.' },
  { id:'dinamico',    label:'Dinámico',    minScore:28, maxScore:38,  retExp:6.0, std:8.7,  color:'#a07fd4',
    desc:'Crecimiento. RV 0–100%. Rent. esperada 6%/año. σ ±8.7%.' },
  { id:'tolerante',   label:'Tolerante',   minScore:39, maxScore:60,  retExp:8.0, std:12.0, color:'#d28a3f',
    desc:'Crecimiento máximo. RV 60–100%. Rent. esperada 8%/año. σ ±12%.' },
];

const MKT_GROUPS = {
  indices: { label:'Índices', ico:'📈', items:[
    {sym:'^IBEX',n:'IBEX 35'},{sym:'^GSPC',n:'S&P 500'},{sym:'^IXIC',n:'NASDAQ'},
    {sym:'^GDAXI',n:'DAX'},{sym:'^FCHI',n:'CAC 40'},{sym:'^FTSE',n:'FTSE 100'},
    {sym:'^N225',n:'Nikkei 225'},{sym:'^HSI',n:'Hang Seng'},
  ]},
  divisas: { label:'Divisas', ico:'💱', items:[
    {sym:'EURUSD=X',n:'EUR/USD'},{sym:'EURGBP=X',n:'EUR/GBP'},{sym:'EURJPY=X',n:'EUR/JPY'},
    {sym:'USDCHF=X',n:'USD/CHF'},{sym:'GBPUSD=X',n:'GBP/USD'},{sym:'USDJPY=X',n:'USD/JPY'},
  ]},
  materias: { label:'Materias', ico:'🛢️', items:[
    {sym:'GC=F',n:'Oro (USD/oz)'},{sym:'SI=F',n:'Plata (USD/oz)'},{sym:'CL=F',n:'Petróleo WTI'},
    {sym:'BZ=F',n:'Brent'},{sym:'NG=F',n:'Gas Natural'},{sym:'HG=F',n:'Cobre'},
    {sym:'BTC-EUR',n:'Bitcoin'},{sym:'ETH-EUR',n:'Ethereum'},
  ]},
  rf: { label:'Renta Fija', ico:'🏛️', items:[
    {sym:'^TNX',n:'US T-Note 10A',cat:'EEUU'},{sym:'^TYX',n:'US T-Bond 30A',cat:'EEUU'},
    {sym:'^IRX',n:'US T-Bill 3M',cat:'EEUU'},{sym:'ES10Y',n:'España 10A',cat:'España'},
    {sym:'DE10YB-EUR',n:'Bund 10A',cat:'Alemania'},
  ]},
};

const IDX_MEMBERS = {
  '^IBEX':  [{sym:'ITX.MC',n:'Inditex'},{sym:'SAN.MC',n:'Santander'},{sym:'BBVA.MC',n:'BBVA'},
    {sym:'IBE.MC',n:'Iberdrola'},{sym:'TEF.MC',n:'Telefónica'},{sym:'REP.MC',n:'Repsol'},
    {sym:'CABK.MC',n:'CaixaBank'},{sym:'FER.MC',n:'Ferrovial'},{sym:'ACS.MC',n:'ACS'},{sym:'AMS.MC',n:'Amadeus'}],
  '^GSPC':  [{sym:'AAPL',n:'Apple'},{sym:'MSFT',n:'Microsoft'},{sym:'NVDA',n:'NVIDIA'},
    {sym:'AMZN',n:'Amazon'},{sym:'GOOGL',n:'Alphabet'},{sym:'META',n:'Meta'},
    {sym:'TSLA',n:'Tesla'},{sym:'JPM',n:'JPMorgan'},{sym:'V',n:'Visa'},{sym:'BRK-B',n:'Berkshire'}],
  '^IXIC':  [{sym:'AAPL',n:'Apple'},{sym:'MSFT',n:'Microsoft'},{sym:'NVDA',n:'NVIDIA'},
    {sym:'AMZN',n:'Amazon'},{sym:'GOOGL',n:'Alphabet'},{sym:'META',n:'Meta'},
    {sym:'TSLA',n:'Tesla'},{sym:'AVGO',n:'Broadcom'},{sym:'ASML',n:'ASML'},{sym:'ADBE',n:'Adobe'}],
};

const SCREENER_DB = [
  {n:'Apple',t:'AAPL',geo:'US',cap:3400,capL:'$3.4T',roic:42,mop:30.7,per:32,crec:7,d:0.3,w:1.2,m:-4.1,y:14.2,sector:'Tech'},
  {n:'Microsoft',t:'MSFT',geo:'US',cap:3100,capL:'$3.1T',roic:38,mop:42.1,per:34,crec:16,d:0.5,w:0.8,m:-3.2,y:8.4,sector:'Tech'},
  {n:'NVIDIA',t:'NVDA',geo:'US',cap:2100,capL:'$2.1T',roic:55,mop:55.3,per:40,crec:122,d:-1.2,w:-3.4,m:-18.6,y:42.1,sector:'Tech'},
  {n:'Alphabet',t:'GOOGL',geo:'US',cap:2000,capL:'$2.0T',roic:28,mop:31.6,per:22,crec:11,d:0.4,w:1.1,m:-5.8,y:3.2,sector:'Tech'},
  {n:'Amazon',t:'AMZN',geo:'US',cap:1900,capL:'$1.9T',roic:18,mop:9.3,per:38,crec:11,d:0.2,w:0.9,m:-8.2,y:6.1,sector:'Consumer'},
  {n:'Meta Platforms',t:'META',geo:'US',cap:1500,capL:'$1.5T',roic:34,mop:38.1,per:26,crec:22,d:0.8,w:2.1,m:-2.4,y:22.3,sector:'Tech'},
  {n:'Tesla',t:'TSLA',geo:'US',cap:800,capL:'$800B',roic:9,mop:9.2,per:85,crec:2,d:-2.4,w:-4.8,m:-32.1,y:-38.4,sector:'EV'},
  {n:'Broadcom',t:'AVGO',geo:'US',cap:780,capL:'$780B',roic:21,mop:58.3,per:29,crec:44,d:0.6,w:1.4,m:-6.4,y:18.2,sector:'Tech'},
  {n:'Palantir',t:'PLTR',geo:'US',cap:290,capL:'$290B',roic:8,mop:14.2,per:480,crec:29,d:2.4,w:4.8,m:-18.4,y:62.4,sector:'Tech'},
  {n:'IonQ',t:'IONQ',geo:'US',cap:10,capL:'$9.8B',roic:-28,mop:-62,per:null,crec:95,d:20.1,w:18.3,m:-12.4,y:55.6,sector:'Quantum'},
  {n:'D-Wave Quantum',t:'QBTS',geo:'US',cap:3,capL:'$3.2B',roic:-35,mop:-80,per:null,crec:60,d:14.4,w:12.8,m:-8.6,y:458.0,sector:'Quantum'},
  {n:'POET Technologies',t:'POET',geo:'US',cap:1,capL:'$920M',roic:-45,mop:-88,per:null,crec:80,d:5.9,w:8.4,m:22.4,y:94.4,sector:'Photonics'},
  {n:'ASML Holding',t:'ASML',geo:'EU',cap:280,capL:'$280B',roic:45,mop:32.4,per:34,crec:14,d:0.6,w:1.2,m:-8.4,y:8.4,sector:'Semis'},
  {n:'SAP SE',t:'SAP',geo:'EU',cap:240,capL:'$240B',roic:22,mop:22.8,per:40,crec:8,d:0.4,w:0.8,m:-2.4,y:18.6,sector:'Software'},
  {n:'Novo Nordisk',t:'NVO',geo:'EU',cap:420,capL:'$420B',roic:42,mop:34.8,per:22,crec:22,d:-0.4,w:-0.8,m:-6.4,y:-28.4,sector:'Salud'},
  {n:'Inditex',t:'ITX.MC',geo:'ES',cap:135,capL:'$135B',roic:35,mop:22.4,per:24,crec:10,d:0.4,w:0.8,m:-1.2,y:8.4,sector:'Retail'},
  {n:'Santander',t:'SAN.MC',geo:'ES',cap:80,capL:'$80B',roic:12,mop:34.0,per:7,crec:8,d:0.6,w:1.4,m:2.8,y:32.4,sector:'Banca'},
  {n:'BBVA',t:'BBVA.MC',geo:'ES',cap:75,capL:'$75B',roic:13,mop:36.2,per:8,crec:9,d:0.8,w:2.1,m:4.2,y:44.8,sector:'Banca'},
  {n:'Iberdrola',t:'IBE.MC',geo:'ES',cap:85,capL:'$85B',roic:8,mop:18.6,per:20,crec:7,d:0.2,w:0.6,m:1.8,y:12.4,sector:'Utilities'},
  {n:'Lucid Group',t:'LCID',geo:'US',cap:3,capL:'$2.9B',roic:-55,mop:-180,per:null,crec:-30,d:12.0,w:8.4,m:-18.6,y:-68.0,sector:'EV'},
  {n:'Rivian',t:'RIVN',geo:'US',cap:20,capL:'$19.8B',roic:-28,mop:-80,per:null,crec:8,d:1.7,w:1.6,m:-8.2,y:-18.0,sector:'EV'},
  {n:'Vanguard S&P 500',t:'VOO',geo:'US',cap:null,capL:'ETF',roic:null,mop:null,per:null,crec:null,d:0.3,w:0.8,m:-4.2,y:8.4,sector:'ETF'},
];

const RD_STOCKS = [
  { s:'AI/COMPUTACIÓN',      t:'NVDA',  n:'NVIDIA',            score:82, hype:95, cat:'Semis',      d:1.2, w:3.4, m1:8.2,  m3:22.1, m12:89.4 },
  { s:'AI/COMPUTACIÓN',      t:'PLTR',  n:'Palantir',          score:74, hype:82, cat:'AI Software', d:2.1, w:4.8, m1:-8.4, m3:15.2, m12:62.4 },
  { s:'AI/COMPUTACIÓN',      t:'SMCI',  n:'SuperMicro',        score:61, hype:70, cat:'AI Infra',    d:3.2, w:6.1, m1:18.4, m3:-12.4, m12:28.4 },
  { s:'QUANTUM/FOTÓNICA',    t:'IONQ',  n:'IonQ',              score:72, hype:88, cat:'Quantum',     d:4.5, w:9.2, m1:-6.4, m3:28.4, m12:55.6 },
  { s:'QUANTUM/FOTÓNICA',    t:'QBTS',  n:'D-Wave Quantum',    score:68, hype:84, cat:'Quantum',     d:14.4,w:28.4,m1:42.4, m3:88.4, m12:458.0 },
  { s:'QUANTUM/FOTÓNICA',    t:'RGTI',  n:'Rigetti Computing', score:62, hype:78, cat:'Quantum',     d:5.0, w:9.2, m1:-15.3,m3:42.4, m12:545.0 },
  { s:'QUANTUM/FOTÓNICA',    t:'POET',  n:'POET Technologies', score:58, hype:72, cat:'Photonics',   d:5.9, w:8.4, m1:22.4, m3:44.4, m12:94.4 },
  { s:'EV/CLEAN ENERGY',     t:'LCID',  n:'Lucid Group',       score:44, hype:52, cat:'EV',          d:12.0,w:18.4,m1:-8.4, m3:-22.4,m12:-68.0 },
  { s:'EV/CLEAN ENERGY',     t:'RIVN',  n:'Rivian Automotive', score:48, hype:58, cat:'EV',          d:1.7, w:3.2, m1:-8.2, m3:-15.4,m12:-18.0 },
  { s:'EV/CLEAN ENERGY',     t:'CHPT',  n:'ChargePoint',       score:32, hype:38, cat:'EV Infra',    d:9.0, w:12.4,m1:-18.4,m3:-32.4,m12:-64.0 },
  { s:'BANCA ESPAÑOLA',      t:'SAN.MC',n:'Santander',         score:68, hype:42, cat:'Banca',       d:0.8, w:2.4, m1:4.2,  m3:8.8,  m12:32.4 },
  { s:'BANCA ESPAÑOLA',      t:'BBVA.MC',n:'BBVA',             score:72, hype:44, cat:'Banca',       d:1.2, w:2.8, m1:6.4,  m3:12.4, m12:44.8 },
  { s:'INSURTECH/FINTECH',   t:'EVER',  n:'EverQuote',         score:66, hype:68, cat:'InsurTech',   d:1.8, w:4.6, m1:12.3, m3:28.4, m12:41.0 },
  { s:'INSURTECH/FINTECH',   t:'AFRM',  n:'Affirm Holdings',   score:54, hype:64, cat:'BNPL',        d:3.2, w:6.4, m1:-12.4,m3:-8.4, m12:22.4 },
  { s:'BIOTECNOLOGÍA',       t:'MRNA',  n:'Moderna',           score:48, hype:52, cat:'Biotech',     d:-1.4,w:-2.8,m1:-8.4, m3:-18.4,m12:-44.4 },
  { s:'BIOTECNOLOGÍA',       t:'NVAX',  n:'Novavax',           score:44, hype:56, cat:'Biotech',     d:4.8, w:8.4, m1:28.4, m3:42.4, m12:-22.4 },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fE = n => n == null ? '—' : '€' + Number(n).toLocaleString('es-ES', {minimumFractionDigits:0, maximumFractionDigits:0});
const f2 = n => n == null ? '—' : Number(n).toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2});
const fPct = (n, decimals=2) => n == null ? '—' : (n >= 0 ? '+' : '') + Number(n).toFixed(decimals) + '%';
const pctColor = n => n == null ? 'var(--text2)' : n >= 0 ? 'var(--green)' : 'var(--red)';
const escH = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function simpleHash(s) { let h=0; for(let i=0;i<s.length;i++) h=Math.imul(31,h)+s.charCodeAt(i)|0; return (h>>>0).toString(36); }
function userStorageKey(u) { return 'fa_ud_'+simpleHash(String(u.id)+'|'+u.pass); }

function calcTechSignal(sym, freq='d1') {
  const seed = sym.split('').reduce((a,c) => a+c.charCodeAt(0), 0);
  const freqMap = {h1:0, d1:1, w1:2, mo1:3};
  const fi = freqMap[freq] || 1;
  const rng = i => { const x=Math.sin((seed+i*37+fi*17)*9999); return x-Math.floor(x); };
  const inds = ['RSI','MACD','BB','EMA','Stoch','ADX','CCI'];
  const scores = inds.map((_,i) => Math.max(-1, Math.min(1, (rng(i+1)*2-1)*0.7)));
  const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
  let signal, label, color;
  if(avg>0.5){signal='STRONG_BUY';label='Compra Fuerte';color='var(--green)';}
  else if(avg>0.15){signal='BUY';label='Compra';color='#7ccc9f';}
  else if(avg>-0.15){signal='NEUTRAL';label='Neutral';color='var(--text2)';}
  else if(avg>-0.5){signal='SELL';label='Venta';color='#e07a7a';}
  else{signal='STRONG_SELL';label='Venta Fuerte';color='var(--red)';}
  return {signal, label, color, score:avg, breakdown:inds.map((n,i)=>({n, v:scores[i]}))};
}

function genBD() {
  const d = {}; const today = new Date();
  for(let y=2023; y<=today.getFullYear(); y++) {
    d[y] = {}; const maxM = y < today.getFullYear() ? 11 : today.getMonth();
    for(let m=0; m<=maxM; m++) {
      const cats = {};
      DEFAULT_CATS.forEach(cat => cat.items.forEach(item => {
        cats[item] = { p: Math.round(100+Math.random()*400), r: Math.round(100+Math.random()*450) };
      }));
      d[y][m] = { cats, ingP: 5000, ingR: Math.round(5000+(Math.random()-.5)*600) };
    }
  }
  return d;
}

const DEMO_USER = {
  id:1, email:'demo@finanzas.com', pass:'demo123', name:'Usuario Demo',
  titulares:[
    {id:'t1',nombre:'Padre',tipo:'individual'},
    {id:'t2',nombre:'Madre',tipo:'individual'},
    {id:'t3',nombre:'Hijo 1',tipo:'individual'},
    {id:'t4',nombre:'Compartido Padres',tipo:'compartido',miembros:[{id:'t1',pct:50},{id:'t2',pct:50}]},
  ],
  profileId:'dinamico', profileScore:32,
  customCats: JSON.parse(JSON.stringify(DEFAULT_CATS)),
  bd: genBD(),
  inv:[
    {id:1,nombre:'Vanguard S&P 500 ETF',ticker:'VOO',tipo:'ETF',titularId:'t1',qty:10,pC:380,pA:427,fecha:'2023-03-15',abierta:true,entidad:'Renta4'},
    {id:2,nombre:'Apple Inc',ticker:'AAPL',tipo:'Acción',titularId:'t2',qty:15,pC:168,pA:189,fecha:'2023-06-01',abierta:true,entidad:'Interactive Brokers'},
    {id:3,nombre:'NVIDIA',ticker:'NVDA',tipo:'Acción',titularId:'t1',qty:8,pC:480,pA:850,fecha:'2024-01-10',abierta:true,entidad:'Renta4'},
    {id:4,nombre:'Amundi MSCI World',ticker:'CW8',tipo:'Fondo',titularId:'t4',qty:100,pC:315,pA:342,fecha:'2022-11-20',abierta:true,entidad:'Renta4'},
  ],
  loans:[
    {id:1,nombre:'Hipoteca Vivienda',titularId:'t4',capital:180000,pendiente:142000,cuota:820,tipo:2.1,inicio:'2018-05-01',fin:'2048-05-01',tipoP:'hipoteca'},
  ],
  saldo:12400,
  watchlists:[{id:'wl1',name:'Principal',items:[]}],
};

const LS = {
  users: () => { try { return JSON.parse(localStorage.getItem('fa_idx_full')||'null') || [DEMO_USER]; } catch(e) { return [DEMO_USER]; } },
  saveUsers: idx => { try { localStorage.setItem('fa_idx_full', JSON.stringify(idx)); } catch(e) {} },
  session: () => { try { return JSON.parse(sessionStorage.getItem('fa_sess')||'null'); } catch(e) { return null; } },
  saveSession: u => { try { sessionStorage.setItem('fa_sess', JSON.stringify(u)); } catch(e) {} },
  clearSession: () => { try { sessionStorage.removeItem('fa_sess'); } catch(e) {} },
  loadUser: u => { try { const r=localStorage.getItem(userStorageKey(u)); return r?JSON.parse(r):null; } catch(e) { return null; } },
  saveUserData: u => { try { localStorage.setItem(userStorageKey(u), JSON.stringify(u)); } catch(e) {} },
};

function persist(u) {
  LS.saveUserData(u); LS.saveSession(u);
  const idx = LS.users().filter(x => x.id !== u.id);
  LS.saveUsers([...idx, {id:u.id,email:u.email,name:u.name,pass:u.pass}]);
}

// ─── PRICE CACHE ─────────────────────────────────────────────────────────────
const PRICE_CACHE = {};
const PRICE_LOADING = new Set();

async function fetchPrice(sym, name) {
  if(PRICE_LOADING.has(sym)) return;
  if(PRICE_CACHE[sym] && Date.now()-PRICE_CACHE[sym].ts < 300000) return;
  PRICE_LOADING.add(sym);
  try {
    const d = await API.prices(sym);
    if(d?.price > 0) PRICE_CACHE[sym] = {...d, ts:Date.now()};
  } catch(e) {}
  PRICE_LOADING.delete(sym);
}

async function fetchPrices(syms) {
  const toFetch = syms.filter(s => !PRICE_CACHE[s] || Date.now()-PRICE_CACHE[s].ts > 300000);
  if(!toFetch.length) return;
  toFetch.forEach(s => PRICE_LOADING.add(s));
  try {
    const d = await API.prices(toFetch);
    if(typeof d === 'object') {
      Object.entries(d).forEach(([s,v]) => { if(v?.price>0) PRICE_CACHE[s]={...v,ts:Date.now()}; });
    }
  } catch(e) {}
  toFetch.forEach(s => PRICE_LOADING.delete(s));
}

// ─── SVG CHART HELPERS ────────────────────────────────────────────────────────
function MiniChart({ points, color = 'var(--green)' }) {
  if(!points?.length) return null;
  const W=80, H=28;
  const vals = points.map(p=>p.close).filter(Boolean);
  if(vals.length < 2) return null;
  const hi=Math.max(...vals), lo=Math.min(...vals), rng=hi-lo||hi*0.02;
  const py = v => H-(H*(v-lo)/rng);
  const px = i => W*i/(vals.length-1);
  const pts = vals.map((v,i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const up = vals[vals.length-1] >= vals[0];
  const c = up ? '#4caf7d' : '#e05252';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:80,height:28,display:'block'}}>
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function BigChart({ points, loading }) {
  if(loading) return <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)',fontSize:13}}>⏳ Cargando...</div>;
  if(!points?.length) return <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)',fontSize:12}}>Sin datos</div>;
  const W=340, H=160, pad=8, padt=18;
  const vals = points.map(p=>p.close).filter(Boolean);
  if(vals.length < 2) return null;
  const hi=Math.max(...vals), lo=Math.min(...vals), rng=hi-lo||hi*0.02;
  const up = vals[vals.length-1] >= vals[0];
  const col = up ? '#4caf7d' : '#e05252';
  const colF = up ? 'rgba(76,175,125,0.12)' : 'rgba(224,82,82,0.12)';
  const py = v => padt + ((H-padt-pad)*(1-(v-lo)/rng));
  const px = i => (W-pad*2)*i/Math.max(1,vals.length-1)+pad;
  const pts = vals.map((v,i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const ap = `M${pad},${H-pad} L${vals.map((v,i)=>`${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' L')} L${px(vals.length-1).toFixed(1)},${H-pad} Z`;
  const step = Math.max(1,Math.floor(points.length/4));
  const xLabels = points.filter((_,i)=>i%step===0||i===points.length-1).map((p,i,arr) => {
    const xi = i===0?0:points.length-1-(arr.length-1-i)*step;
    return <text key={i} x={px(xi).toFixed(0)} y={H+8} fill="var(--text2)" fontSize={7.5} textAnchor="middle">{p.date}</text>;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H+12}`} style={{width:'100%',height:190,display:'block'}}>
      <path d={ap} fill={colF}/>
      <polyline points={pts} fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round"/>
      <text x={pad} y={padt-3} fill="var(--text2)" fontSize={7.5} fontFamily="monospace">{hi.toFixed(2)}</text>
      <text x={pad} y={H-pad-2} fill="var(--text2)" fontSize={7.5} fontFamily="monospace">{lo.toFixed(2)}</text>
      {xLabels}
    </svg>
  );
}

function TechView({ sym }) {
  const freqs = [['h1','1H'],['d1','1D'],['w1','1S'],['mo1','1M']];
  return (
    <div style={{marginTop:8}}>
      {freqs.map(([fk,fl]) => {
        const ts = calcTechSignal(sym, fk);
        const barW = Math.round((ts.score+1)/2*100);
        return (
          <div key={fk} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:11,color:'var(--text2)',fontWeight:600}}>{fl}</span>
              <span style={{fontSize:12,fontWeight:700,color:ts.color}}>{ts.label}</span>
            </div>
            <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden',marginBottom:5}}>
              <div style={{height:'100%',width:`${barW}%`,background:ts.color,borderRadius:3}}/>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {ts.breakdown.map(b => {
                const bc = b.v>0.15?'var(--green)':b.v<-0.15?'var(--red)':'var(--text2)';
                const bl = b.v>0.5?'▲▲':b.v>0.15?'▲':b.v<-0.5?'▼▼':b.v<-0.15?'▼':'—';
                return <span key={b.n} style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'var(--bg3)',color:bc,border:'1px solid var(--border)',fontFamily:'monospace'}}>{b.n} {bl}</span>;
              })}
            </div>
          </div>
        );
      })}
      <div style={{fontSize:9,color:'var(--text2)',marginTop:4}}>⚠ Señales algorítmicas orientativas</div>
    </div>
  );
}

// ─── CHART MODAL ─────────────────────────────────────────────────────────────
function ChartModal({ sym, name, onClose, onWatchlist, isInWL }) {
  const [viewMode, setViewMode] = useState('chart');
  const [range, setRange] = useState('1mo');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [perfData, setPerfData] = useState({});
  const [perfLoading, setPerfLoading] = useState(true);
  const cached = PRICE_CACHE[sym];
  const members = IDX_MEMBERS[sym] || null;

  useEffect(() => {
    setLoading(true);
    API.chart(sym, range).then(d => {
      setChartData(d?.points || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sym, range]);

  useEffect(() => {
    const periods = [
      {k:'1d',range:'5d',interval:'1d'},{k:'1w',range:'1mo',interval:'1d'},
      {k:'1mo',range:'1mo',interval:'1d'},{k:'3mo',range:'3mo',interval:'1wk'},
      {k:'ytd',range:'ytd',interval:'1mo'},{k:'1y',range:'1y',interval:'1mo'},
      {k:'3y',range:'3y',interval:'3mo'},{k:'5y',range:'5y',interval:'3mo'},
    ];
    Promise.allSettled(periods.map(p =>
      API.chart(sym, p.range, p.interval).then(d => ({k:p.k, v:d?.perf}))
    )).then(results => {
      const pd = {};
      results.forEach(r => { if(r.status==='fulfilled'&&r.value) pd[r.value.k]=r.value.v; });
      setPerfData(pd);
      setPerfLoading(false);
    });
  }, [sym]);

  const ranges = [['1d','1D'],['5d','5D'],['1mo','1M'],['3mo','3M'],['6mo','6M'],['1y','1A'],['5y','5A']];
  const perfRows = [['1D',perfData['1d']],['1S',perfData['1w']],['1M',perfData['1mo']],['3M',perfData['3mo']],['YTD',perfData['ytd']],['1A',perfData['1y']],['3A',perfData['3y']],['5A',perfData['5y']]];

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:12}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="card" style={{width:'100%',maxWidth:500,maxHeight:'92vh',overflowY:'auto',padding:16}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:18,fontWeight:800,color:'var(--gold)',fontFamily:'monospace'}}>{sym}</span>
              <span style={{fontSize:11,color:'var(--text2)'}}>{name}</span>
            </div>
            {cached && <div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:4}}>
              <span style={{fontSize:22,fontWeight:800,fontFamily:'monospace'}}>{cached.price>999?cached.price.toLocaleString('es-ES',{maximumFractionDigits:0}):cached.price.toFixed(2)}{cached.currency&&cached.currency!=='USD'?' '+cached.currency:''}</span>
              {cached.pct!=null && <span style={{fontSize:13,fontWeight:700,padding:'2px 7px',borderRadius:6,background:cached.pct>=0?'rgba(76,175,125,.15)':'rgba(224,82,82,.15)',color:pctColor(cached.pct),fontFamily:'monospace'}}>{fPct(cached.pct)}</span>}
            </div>}
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button onClick={()=>onWatchlist(sym,name)} style={{background:isInWL?'rgba(210,138,63,.2)':'var(--bg3)',border:`1px solid ${isInWL?'var(--gold)':'var(--border)'}`,borderRadius:8,padding:'6px 9px',fontSize:14,cursor:'pointer'}} title={isInWL?'Quitar de Watchlist':'Añadir a Watchlist'}>{isInWL?'⭐':'☆'}</button>
            <button className="bo" onClick={onClose} style={{padding:'6px 10px',fontSize:14}}>✕</button>
          </div>
        </div>

        {/* View toggle */}
        <div style={{display:'flex',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,padding:2,marginBottom:10,gap:2}}>
          {[['chart','📊 Gráfico'],['perf','📈 Rendimiento'],['tech','🔬 Técnico'],...(members?[['members','📋 Valores']]:[])]
            .map(([id,l]) => <button key={id} className={viewMode===id?'ba':'bo'} onClick={()=>setViewMode(id)} style={{flex:1,padding:'6px 4px',fontSize:11,fontWeight:700,border:'none',borderRadius:7}}>{l}</button>)}
        </div>

        {/* Chart view */}
        {viewMode==='chart' && <>
          <div style={{display:'flex',gap:3,marginBottom:8,flexWrap:'wrap'}}>
            {ranges.map(([r,l]) => <button key={r} className={range===r?'ba':'bo'} onClick={()=>setRange(r)} style={{fontSize:11,padding:'4px 8px',minWidth:34}}>{l}</button>)}
          </div>
          <div style={{background:'var(--bg3)',borderRadius:9,padding:8,minHeight:190}}>
            <BigChart points={chartData} loading={loading}/>
          </div>
        </>}

        {/* Perf view */}
        {viewMode==='perf' && <div style={{background:'var(--bg3)',borderRadius:9,padding:12}}>
          <div style={{fontSize:10,color:'var(--gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:10}}>Rendimiento en distintos plazos</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
            {perfRows.map(([l,v]) => <div key={l} style={{background:'var(--card)',borderRadius:8,padding:'8px 6px',textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--text2)',marginBottom:3,textTransform:'uppercase'}}>{l}</div>
              <div style={{fontSize:13,fontWeight:800,fontFamily:'monospace',color:v==null?'var(--text2)':pctColor(v)}}>{v==null?'—':fPct(v,1)}</div>
            </div>)}
          </div>
          {perfLoading && <div style={{textAlign:'center',color:'var(--text2)',fontSize:11,marginTop:8}}>⏳ Calculando rendimientos...</div>}
        </div>}

        {/* Tech view */}
        {viewMode==='tech' && <TechView sym={sym}/>}

        {/* Members view */}
        {viewMode==='members' && members && <div style={{background:'var(--bg3)',borderRadius:9,overflow:'hidden'}}>
          <div style={{padding:'10px 12px',fontSize:10,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.04em',fontWeight:600,borderBottom:'1px solid var(--border)'}}>Principales valores del índice</div>
          {members.map((m,i) => {
            const mc = PRICE_CACHE[m.sym];
            return <div key={m.sym} onClick={()=>{onClose(); setTimeout(()=>{},100);}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 12px',borderBottom:i<members.length-1?'1px solid rgba(74,53,32,.25)':'none',cursor:'pointer',transition:'background .12s'}} onMouseOver={e=>e.currentTarget.style.background='rgba(210,138,63,.05)'} onMouseOut={e=>e.currentTarget.style.background=''}>
              <div>
                <div style={{fontSize:12,fontWeight:600}}>{m.n}</div>
                <div style={{fontSize:10,color:'var(--text2)',fontFamily:'monospace'}}>{m.sym}</div>
              </div>
              <div style={{textAlign:'right'}}>
                {mc ? <>
                  <div style={{fontSize:13,fontWeight:700,fontFamily:'monospace'}}>{mc.price>999?mc.price.toLocaleString('es-ES',{maximumFractionDigits:0}):mc.price.toFixed(2)}</div>
                  {mc.pct!=null && <div style={{fontSize:11,color:pctColor(mc.pct),fontFamily:'monospace'}}>{fPct(mc.pct)}</div>}
                </> : <span style={{color:'var(--text2)',fontSize:11}}>—</span>}
              </div>
            </div>;
          })}
        </div>}

        <div style={{fontSize:9,color:'var(--text2)',marginTop:8,textAlign:'center'}}>Precios en tiempo real · Yahoo Finance via Vercel · No es asesoramiento · Renta 4</div>
      </div>
    </div>
  );
}

// ─── TAB MERCADOS ─────────────────────────────────────────────────────────────
function TabMercados({ user, onUpdateUser }) {
  const [group, setGroup] = useState('indices');
  const [techMode, setTechMode] = useState(false);
  const [chart, setChart] = useState(null); // {sym, name}
  const [tick, setTick] = useState(0);

  const items = MKT_GROUPS[group]?.items || [];

  useEffect(() => {
    const syms = items.map(i=>i.sym);
    fetchPrices(syms).then(() => setTick(t=>t+1));
  }, [group]);

  const isInWL = sym => (user?.watchlists||[]).some(wl=>(wl.items||[]).some(w=>w.sym===sym));

  const handleWatchlist = (sym, name) => {
    const u2 = JSON.parse(JSON.stringify(user));
    if(!u2.watchlists) u2.watchlists = [{id:'wl1',name:'Principal',items:[]}];
    const wl = u2.watchlists[0];
    if(wl.items.find(i=>i.sym===sym)) { wl.items = wl.items.filter(i=>i.sym!==sym); }
    else { wl.items.push({sym,name,added:new Date().toISOString().slice(0,10)}); }
    persist(u2); onUpdateUser(u2);
  };

  return (
    <div>
      {chart && <ChartModal sym={chart.sym} name={chart.name} onClose={()=>setChart(null)} onWatchlist={handleWatchlist} isInWL={isInWL(chart.sym)}/>}

      {/* Group selector + tech toggle */}
      <div style={{display:'flex',gap:5,marginBottom:10,overflowX:'auto',scrollbarWidth:'none',alignItems:'center'}}>
        <div style={{display:'flex',gap:4,flex:1,overflowX:'auto',scrollbarWidth:'none'}}>
          {Object.entries(MKT_GROUPS).map(([k,g]) => (
            <button key={k} className={group===k?'ba':'bo'} onClick={()=>{setGroup(k);setTechMode(false);}} style={{flexShrink:0,padding:'5px 9px',fontSize:11}}>{g.ico} {g.label}</button>
          ))}
        </div>
        <button className={techMode?'ba':'bo'} onClick={()=>setTechMode(t=>!t)} style={{flexShrink:0,padding:'5px 10px',fontSize:11,fontWeight:700}} title="Vista técnica">🔬{techMode?' ON':''}</button>
        <button className="bo" onClick={()=>fetchPrices(items.map(i=>i.sym)).then(()=>setTick(t=>t+1))} style={{flexShrink:0,padding:'5px 9px',fontSize:12}}>🔄</button>
      </div>

      {/* Items list */}
      <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r)',overflow:'hidden',marginBottom:10}}>
        {items.map((item,i) => {
          const d = PRICE_CACHE[item.sym];
          const loading = PRICE_LOADING.has(item.sym);
          const inWL = isInWL(item.sym);
          const ts = techMode ? calcTechSignal(item.sym,'d1') : null;

          return (
            <div key={item.sym} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderBottom:i<items.length-1?'1px solid rgba(74,53,32,.25)':'none'}}>
              {/* Name → opens chart */}
              <div onClick={()=>setChart({sym:item.sym,name:item.n})} style={{cursor:'pointer',flex:1,minWidth:0,paddingRight:8}} onMouseOver={e=>e.currentTarget.parentElement.style.background='rgba(210,138,63,.04)'} onMouseOut={e=>e.currentTarget.parentElement.style.background=''}>
                <div style={{fontWeight:600,fontSize:13}}>{item.n}{item.cat && <span style={{fontSize:10,color:'var(--text2)',fontWeight:400}}> {item.cat}</span>}</div>
                {IDX_MEMBERS[item.sym] && <div style={{fontSize:9,color:'var(--text2)'}}>📋 ver miembros al abrir</div>}
              </div>
              {/* Price or tech signal */}
              <div style={{textAlign:'right',flexShrink:0,marginRight:8}}>
                {techMode && ts ? (
                  <span style={{fontSize:11,fontWeight:700,color:ts.color}}>{ts.label}</span>
                ) : loading ? (
                  <span style={{color:'var(--text2)',fontSize:11}}>⏳</span>
                ) : d ? (
                  <>
                    <span style={{fontWeight:700,fontFamily:'monospace'}}>{d.price>9999?d.price.toLocaleString('es-ES',{maximumFractionDigits:0}):d.price.toFixed(2)}</span>
                    {d.pct!=null && <span style={{fontSize:11,color:pctColor(d.pct)}}> {fPct(d.pct)}</span>}
                  </>
                ) : <span style={{color:'var(--text2)',fontSize:11}}>—</span>}
              </div>
              {/* Star */}
              <button onClick={()=>handleWatchlist(item.sym,item.n)} style={{background:inWL?'rgba(210,138,63,.2)':'var(--bg3)',border:`1px solid ${inWL?'var(--gold)':'var(--border)'}`,borderRadius:6,padding:'4px 7px',fontSize:13,cursor:'pointer',flexShrink:0}}>{inWL?'⭐':'☆'}</button>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:9,color:'var(--text2)',textAlign:'center'}}>Precios en tiempo real vía Vercel · Toca el nombre para gráfico · 🔬 activa vista técnica</div>
    </div>
  );
}

// ─── TAB WATCHLIST ────────────────────────────────────────────────────────────
function TabWatchlist({ user, onUpdateUser }) {
  const [activeWLId, setActiveWLId] = useState(null);
  const [ticker, setTicker] = useState('');
  const [chart, setChart] = useState(null);
  const [tick, setTick] = useState(0);

  const wls = user?.watchlists || [{id:'wl1',name:'Principal',items:[]}];
  const activeWL = wls.find(w=>w.id===activeWLId) || wls[0] || {id:'wl1',name:'Principal',items:[]};
  const items = activeWL.items || [];

  useEffect(() => {
    if(items.length) fetchPrices(items.map(i=>i.sym)).then(()=>setTick(t=>t+1));
  }, [activeWLId, user]);

  const removeFromWL = sym => {
    const u2=JSON.parse(JSON.stringify(user));
    const wl=u2.watchlists?.find(w=>w.id===activeWL.id);
    if(wl) wl.items=wl.items.filter(i=>i.sym!==sym);
    persist(u2); onUpdateUser(u2);
  };

  const addTicker = () => {
    if(!ticker.trim()) return;
    const sym=ticker.trim().toUpperCase();
    const u2=JSON.parse(JSON.stringify(user));
    if(!u2.watchlists) u2.watchlists=[{id:'wl1',name:'Principal',items:[]}];
    const wl=u2.watchlists.find(w=>w.id===activeWL.id)||u2.watchlists[0];
    if(!wl.items.find(i=>i.sym===sym)) wl.items.push({sym,name:sym,added:new Date().toISOString().slice(0,10)});
    persist(u2); onUpdateUser(u2); setTicker('');
  };

  const createWL = () => {
    const name=prompt('Nombre de la nueva watchlist:');
    if(!name) return;
    const u2=JSON.parse(JSON.stringify(user));
    if(!u2.watchlists) u2.watchlists=[{id:'wl1',name:'Principal',items:[]}];
    const newId='wl'+Date.now();
    u2.watchlists.push({id:newId,name,items:[]});
    persist(u2); onUpdateUser(u2); setActiveWLId(newId);
  };

  return (
    <div>
      {chart && <ChartModal sym={chart.sym} name={chart.name} onClose={()=>setChart(null)} onWatchlist={(s,n)=>{}} isInWL={true}/>}

      {/* WL tabs */}
      <div style={{display:'flex',gap:6,marginBottom:10,overflowX:'auto',scrollbarWidth:'none'}}>
        {wls.map(w=><button key={w.id} className={w.id===activeWL.id?'ba':'bo'} onClick={()=>setActiveWLId(w.id)} style={{flexShrink:0,padding:'6px 11px',fontSize:11,fontWeight:700}}>{w.name} <span style={{opacity:.7,fontSize:10}}>{(w.items||[]).length}</span></button>)}
        <button className="bo" onClick={createWL} style={{flexShrink:0,padding:'6px 10px',fontSize:11}}>+ Nueva</button>
      </div>

      {/* Add ticker */}
      <div style={{display:'flex',gap:7,marginBottom:12}}>
        <input value={ticker} onChange={e=>setTicker(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTicker()} placeholder="Ticker (AAPL, ITX.MC, BTC-EUR...)" style={{flex:1,fontSize:13}}/>
        <button className="ba" onClick={addTicker} style={{whiteSpace:'nowrap',padding:'8px 12px',fontSize:12}}>+ Añadir</button>
        <button className="bo" onClick={()=>fetchPrices(items.map(i=>i.sym)).then(()=>setTick(t=>t+1))} style={{padding:'8px 10px',fontSize:12}}>🔄</button>
      </div>

      {items.length===0 ? (
        <div style={{textAlign:'center',color:'var(--text2)',padding:32,fontSize:13}}>
          <div style={{fontSize:32,marginBottom:8}}>⭐</div>
          Esta watchlist está vacía.<br/>
          <span style={{fontSize:11}}>Añade tickers o pulsa ⭐ en cualquier activo</span>
        </div>
      ) : (
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r)',overflow:'hidden'}}>
          {items.map((w,i) => {
            const d=PRICE_CACHE[w.sym];
            return (
              <div key={w.sym} onClick={()=>setChart({sym:w.sym,name:w.name})} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 13px',borderBottom:i<items.length-1?'1px solid rgba(74,53,32,.28)':'none',cursor:'pointer',transition:'background .12s'}} onMouseOver={e=>e.currentTarget.style.background='rgba(210,138,63,.05)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--gold)'}}>{w.sym}</div>
                  <div style={{fontSize:10,color:'var(--text2)'}}>{w.name}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{textAlign:'right'}}>
                    {d ? <>
                      <span style={{fontWeight:700,fontFamily:'monospace'}}>{d.price>999?d.price.toLocaleString('es-ES',{maximumFractionDigits:0}):d.price.toFixed(2)}</span>
                      {d.pct!=null && <span style={{fontSize:11,color:pctColor(d.pct),fontFamily:'monospace'}}> {fPct(d.pct)}</span>}
                    </> : <span style={{color:'var(--text2)',fontSize:11}}>—</span>}
                  </div>
                  <button className="bd" onClick={e=>{e.stopPropagation();removeFromWL(w.sym);}} style={{padding:'3px 7px',fontSize:11}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TAB SCREENER ─────────────────────────────────────────────────────────────
function TabScreener({ user }) {
  const [chart, setChart] = useState(null);
  const [filters, setFilters] = useState({geo:'',sector:'',sort:'cap',q:'',techMin:'',perfPeriod:'m',perfMin:'',roicMin:'',perMax:'',crecMin:''});
  const setF = (k,v) => setFilters(f=>({...f,[k]:v}));

  const sectors = [...new Set(SCREENER_DB.map(s=>s.sector))].sort();
  const geos = [...new Set(SCREENER_DB.map(s=>s.geo))].sort();

  let list = SCREENER_DB.filter(s => {
    if(filters.geo && s.geo!==filters.geo) return false;
    if(filters.sector && s.sector!==filters.sector) return false;
    if(filters.q){const ql=filters.q.toLowerCase();if(!s.n.toLowerCase().includes(ql)&&!s.t.toLowerCase().includes(ql))return false;}
    if(filters.roicMin!==''&&(s.roic==null||s.roic<+filters.roicMin)) return false;
    if(filters.perMax!==''&&s.per!=null&&s.per>+filters.perMax) return false;
    if(filters.crecMin!==''&&(s.crec==null||s.crec<+filters.crecMin)) return false;
    const pv={d:s.d,w:s.w,m:s.m,y:s.y}[filters.perfPeriod]??null;
    if(filters.perfMin!==''&&(pv==null||pv<+filters.perfMin)) return false;
    if(filters.techMin){
      const ts=calcTechSignal(s.t,'d1');
      const sigMap={STRONG_BUY:2,BUY:1,NEUTRAL:0,SELL:-1,STRONG_SELL:-2};
      const minMap={STRONG_BUY:2,BUY:1,NEUTRAL:0};
      if(!ts||sigMap[ts.signal]<(minMap[filters.techMin]??-99)) return false;
    }
    return true;
  });

  if(filters.sort==='cap') list.sort((a,b)=>(b.cap||0)-(a.cap||0));
  else if(filters.sort==='roic') list.sort((a,b)=>(b.roic??-999)-(a.roic??-999));
  else if(filters.sort==='crec') list.sort((a,b)=>(b.crec??-999)-(a.crec??-999));
  else if(filters.sort==='per') list.sort((a,b)=>(a.per??9999)-(b.per??9999));
  else if(filters.sort==='perf') list.sort((a,b)=>{const av={d:a.d,w:a.w,m:a.m,y:a.y}[filters.perfPeriod]??-999;const bv={d:b.d,w:b.w,m:b.m,y:b.y}[filters.perfPeriod]??-999;return bv-av;});

  const colFn=(v,good,bad)=>v==null?'var(--text2)':v>=good?'var(--green)':v<=bad?'var(--red)':'var(--gold)';
  const pctCell=v=>v==null?'—':<span style={{color:pctColor(v),fontFamily:'monospace'}}>{fPct(v,1)}</span>;

  return (
    <div>
      {chart && <ChartModal sym={chart.sym} name={chart.name} onClose={()=>setChart(null)} onWatchlist={()=>{}} isInWL={false}/>}

      {/* Search */}
      <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
        <input placeholder="Empresa o ticker..." value={filters.q} onChange={e=>setF('q',e.target.value)} style={{flex:1,minWidth:100,fontSize:12}}/>
        <select onChange={e=>setF('geo',e.target.value)} value={filters.geo} style={{fontSize:11}}>
          <option value="">🌍 Todos</option>
          {geos.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <select onChange={e=>setF('sector',e.target.value)} value={filters.sector} style={{fontSize:11}}>
          <option value="">📂 Sector</option>
          {sectors.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Filters */}
      <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 12px',marginBottom:10}}>
        <div style={{fontSize:10,color:'var(--gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:8}}>Filtros</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
          {[['ROIC% mín','roicMin'],['PER máx','perMax'],['Crec% mín','crecMin'],['% perf mín','perfMin']].map(([l,k])=>(
            <div key={k} style={{flex:'1 1 70px'}}>
              <div style={{fontSize:9,color:'var(--text2)',marginBottom:3}}>{l}</div>
              <input type="number" value={filters[k]} onChange={e=>setF(k,e.target.value)} placeholder="—" style={{fontSize:11,padding:'5px 8px',width:'100%'}}/>
            </div>
          ))}
          <div style={{flex:'1 1 90px'}}>
            <div style={{fontSize:9,color:'var(--text2)',marginBottom:3}}>Señal técnica</div>
            <select value={filters.techMin} onChange={e=>setF('techMin',e.target.value)} style={{fontSize:11,padding:'5px 6px',width:'100%'}}>
              <option value="">Cualquiera</option>
              <option value="NEUTRAL">Neutral+</option>
              <option value="BUY">Compra+</option>
              <option value="STRONG_BUY">Compra Fuerte</option>
            </select>
          </div>
          <div style={{flex:'1 1 70px'}}>
            <div style={{fontSize:9,color:'var(--text2)',marginBottom:3}}>Periodo perf</div>
            <select value={filters.perfPeriod} onChange={e=>setF('perfPeriod',e.target.value)} style={{fontSize:11,padding:'5px 6px',width:'100%'}}>
              <option value="d">1D</option><option value="w">1S</option>
              <option value="m">1M</option><option value="y">1A</option>
            </select>
          </div>
          <div style={{flex:'1 1 90px'}}>
            <div style={{fontSize:9,color:'var(--text2)',marginBottom:3}}>Ordenar por</div>
            <select value={filters.sort} onChange={e=>setF('sort',e.target.value)} style={{fontSize:11,padding:'5px 6px',width:'100%'}}>
              <option value="cap">Cap.</option><option value="roic">ROIC%</option>
              <option value="crec">Crec%</option><option value="per">PER</option>
              <option value="perf">Perf</option>
            </select>
          </div>
          <button className="bo" onClick={()=>setFilters({geo:'',sector:'',sort:'cap',q:'',techMin:'',perfPeriod:'m',perfMin:'',roicMin:'',perMax:'',crecMin:''})} style={{padding:'5px 8px',fontSize:11,alignSelf:'flex-end'}}>✕ Reset</button>
        </div>
      </div>

      <div style={{fontSize:10,color:'var(--text2)',marginBottom:6}}>{list.length} empresa{list.length!==1?'s':''} encontrada{list.length!==1?'s':''}</div>

      {/* Table */}
      <div className="ov" style={{marginBottom:8}}>
        <table style={{minWidth:620}}>
          <thead><tr>
            <th>Empresa</th><th>Cap</th><th title="ROIC">ROIC%</th><th title="Margen Op">MOp%</th>
            <th>PER</th><th>Crec%</th><th>1D</th><th>1M</th><th>1A</th><th>Señal</th><th></th>
          </tr></thead>
          <tbody>
            {list.map(s=>{
              const ts=calcTechSignal(s.t,'d1');
              return (
                <tr key={s.t} onClick={()=>setChart({sym:s.t,name:s.n})} style={{cursor:'pointer'}} onMouseOver={e=>e.currentTarget.style.background='rgba(210,138,63,.04)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td><div style={{fontWeight:600,fontSize:12}}>{s.n}</div><div style={{fontSize:10,color:'var(--accent)',fontFamily:'monospace'}}>{s.t} <span style={{color:'var(--text2)'}}>{s.geo}</span></div></td>
                  <td style={{fontSize:11,color:'var(--text2)',whiteSpace:'nowrap'}}>{s.capL}</td>
                  <td style={{fontWeight:700,fontFamily:'monospace',fontSize:11,color:colFn(s.roic,15,0)}}>{s.roic!=null?s.roic+'%':'—'}</td>
                  <td style={{fontFamily:'monospace',fontSize:11,color:colFn(s.mop,15,0)}}>{s.mop!=null?s.mop.toFixed(1)+'%':'—'}</td>
                  <td style={{fontFamily:'monospace',fontSize:11,color:s.per==null?'var(--text2)':s.per<20?'var(--green)':s.per>50?'var(--red)':'var(--gold)'}}>{s.per??'—'}</td>
                  <td style={{fontWeight:700,fontFamily:'monospace',fontSize:11,color:colFn(s.crec,20,0)}}>{s.crec!=null?(s.crec>0?'+':'')+s.crec+'%':'—'}</td>
                  <td>{pctCell(s.d)}</td><td>{pctCell(s.m)}</td><td>{pctCell(s.y)}</td>
                  <td><span style={{fontSize:10,fontWeight:700,color:ts?.color||'var(--text2)',whiteSpace:'nowrap'}}>{ts?.label||'—'}</span></td>
                  <td onClick={e=>e.stopPropagation()}><button style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:5,padding:'3px 6px',fontSize:12,cursor:'pointer'}}>☆</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB RADAR ────────────────────────────────────────────────────────────────
function TabRadar({ user, onUpdateUser }) {
  const [chart, setChart] = useState(null);
  const sectors = [...new Set(RD_STOCKS.map(s=>s.s))];

  const rdScore = s => s.score;
  const rdHype  = s => s.hype;
  const rdLabel = score => score>=75?{label:'🔥 Alta conv.',color:'var(--green)'}:score>=55?{label:'⚡ Media conv.',color:'var(--gold)'}:{label:'👀 Vigilar',color:'var(--text2)'};

  const handleWatchlist = (sym, name) => {
    const u2=JSON.parse(JSON.stringify(user));
    if(!u2.watchlists) u2.watchlists=[{id:'wl1',name:'Principal',items:[]}];
    const wl=u2.watchlists[0];
    if(!wl.items.find(i=>i.sym===sym)) wl.items.push({sym,name,added:new Date().toISOString().slice(0,10)});
    persist(u2); onUpdateUser(u2);
  };

  return (
    <div>
      {chart && <ChartModal sym={chart.sym} name={chart.name} onClose={()=>setChart(null)} onWatchlist={handleWatchlist} isInWL={false}/>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{fontSize:10,color:'var(--text2)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>Radar · {new Date().toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}</div>
        <button className="bo" onClick={()=>{}} style={{padding:'5px 10px',fontSize:13}} title="Ver Playbook">📖 Playbook</button>
      </div>

      {sectors.map(sec => {
        const stocks = RD_STOCKS.filter(s=>s.s===sec);
        return (
          <div key={sec} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8,paddingBottom:4,borderBottom:'1px solid var(--border)'}}>{sec}</div>
            {stocks.map(s => {
              const sc = rdScore(s);
              const lb = rdLabel(sc);
              return (
                <div key={s.t} onClick={()=>setChart({sym:s.t,name:s.n})} className="card" style={{marginBottom:10,borderLeft:`3px solid ${lb.color}`,cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13}}>{s.n}</div>
                      <div style={{fontSize:10,color:'var(--text2)'}}>{s.t} · {s.cat}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:11,fontWeight:700,color:lb.color}}>{lb.label}</div>
                        <div style={{fontSize:10,color:'var(--text2)'}}>Score {sc}/100 · Hype {rdHype(s)}</div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();handleWatchlist(s.t,s.n);}} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 7px',fontSize:13,cursor:'pointer'}}>⭐</button>
                    </div>
                  </div>
                  {/* Performance row */}
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {[['1D',s.d],['1S',s.w],['1M',s.m1],['3M',s.m3],['1A',s.m12]].map(([l,v])=>(
                      <div key={l} style={{textAlign:'center',minWidth:36}}>
                        <div style={{fontSize:8,color:'var(--text2)',textTransform:'uppercase'}}>{l}</div>
                        <div style={{fontSize:11,fontWeight:700,color:pctColor(v),fontFamily:'monospace'}}>{v!=null?fPct(v,1):'—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB CALCULADORAS ─────────────────────────────────────────────────────────
function TabCalcs() {
  const [cap, setCap] = useState(10000); const [aport, setAport] = useState(500);
  const [rent, setRent] = useState(7); const [anos, setAnos] = useState(20);

  const calcIC = () => {
    const r=rent/100/12; const n=anos*12;
    const fv = cap*Math.pow(1+r,n) + aport*((Math.pow(1+r,n)-1)/r);
    const total = cap + aport*n;
    const ganancia = fv - total;
    return { fv, total, ganancia, ratio: fv/total };
  };
  const ic = calcIC();

  return (
    <div>
      <div className="card" style={{marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>📈 Interés Compuesto</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          {[['Capital inicial (€)','cap',cap,setCap],['Aportación mensual (€)','aport',aport,setAport],
            ['Rentabilidad anual (%)','rent',rent,setRent],['Años','anos',anos,setAnos]].map(([l,k,v,set])=>(
            <div key={k}>
              <label className="lbl">{l}</label>
              <input type="number" value={v} onChange={e=>set(+e.target.value)} style={{width:'100%'}}/>
            </div>
          ))}
        </div>
        <div style={{background:'var(--bg3)',borderRadius:10,padding:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[['Capital Final',`€${Math.round(ic.fv).toLocaleString('es-ES')}`,'var(--gold)'],
            ['Total Aportado',`€${Math.round(ic.total).toLocaleString('es-ES')}`,null],
            ['Ganancia',`€${Math.round(ic.ganancia).toLocaleString('es-ES')}`,'var(--green)'],
            ['Multiplicador',`×${ic.ratio.toFixed(2)}`,null]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:'var(--text2)',marginBottom:3}}>{l}</div>
              <div style={{fontSize:16,fontWeight:800,color:c||'var(--text)',fontFamily:'monospace'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>⚡ Regla del 72</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div>
            <label className="lbl">Rentabilidad anual (%)</label>
            <input type="number" value={rent} onChange={e=>setRent(+e.target.value)} style={{width:'100%'}}/>
          </div>
          <div style={{textAlign:'center',paddingTop:20}}>
            <div style={{fontSize:10,color:'var(--text2)',marginBottom:4}}>Años para doblar</div>
            <div style={{fontSize:24,fontWeight:800,color:'var(--gold)',fontFamily:'monospace'}}>{rent>0?(72/rent).toFixed(1):'—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB HERRAMIENTAS ─────────────────────────────────────────────────────────
function TabHerramientas({ user, onUpdateUser }) {
  const [htab, setHtab] = useState('mercados');
  const tabs = [['mercados','📡 Mercados'],['watchlist','⭐ Watchlist'],['screener','🔍 Screener'],['radar','🎯 Radar'],['calculadoras','🔢 Calc']];

  return (
    <div className="sec">
      <div style={{display:'flex',gap:4,marginBottom:14,overflowX:'auto',padding:'0 0 2px',scrollbarWidth:'none'}}>
        {tabs.map(([id,l])=>(
          <button key={id} className={htab===id?'ba':'bo'} onClick={()=>setHtab(id)} style={{flexShrink:0,padding:'7px 11px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>{l}</button>
        ))}
      </div>
      {htab==='mercados'    && <TabMercados    user={user} onUpdateUser={onUpdateUser}/>}
      {htab==='watchlist'   && <TabWatchlist   user={user} onUpdateUser={onUpdateUser}/>}
      {htab==='screener'    && <TabScreener    user={user}/>}
      {htab==='radar'       && <TabRadar       user={user} onUpdateUser={onUpdateUser}/>}
      {htab==='calculadoras'&& <TabCalcs/>}
    </div>
  );
}

// ─── TAB PRESUPUESTO (simplified — full version copies logic from HTML) ───────
function TabPresupuesto({ user, onUpdateUser }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const MN = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const bd = user?.bd || {};
  const md = bd[year]?.[month] || { cats:{}, ingP:5000, ingR:5000 };
  const cats = user?.customCats || DEFAULT_CATS;

  const totalP = cats.flatMap(c=>c.items).reduce((s,it)=>s+(md.cats[it]?.p||0),0);
  const totalR = cats.flatMap(c=>c.items).reduce((s,it)=>s+(md.cats[it]?.r||0),0);
  const ahorroP = md.ingP - totalP;
  const ahorroR = md.ingR - totalR;
  const tasaAhorro = md.ingR>0 ? (ahorroR/md.ingR*100) : 0;

  const setVal = (item, field, val) => {
    const u2=JSON.parse(JSON.stringify(user));
    if(!u2.bd[year]) u2.bd[year]={};
    if(!u2.bd[year][month]) u2.bd[year][month]={cats:{},ingP:md.ingP,ingR:md.ingR};
    if(!u2.bd[year][month].cats[item]) u2.bd[year][month].cats[item]={p:0,r:0};
    u2.bd[year][month].cats[item][field]=+val||0;
    persist(u2); onUpdateUser(u2);
  };

  return (
    <div className="sec">
      {/* Nav */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button className="bo" onClick={()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);}}>‹</button>
        <span style={{fontWeight:700,fontSize:15}}>{MN[month]} {year}</span>
        <button className="bo" onClick={()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);}}>›</button>
      </div>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12}}>
        {[
          ['Ingresos Pres.',fE(md.ingP),'var(--text)'],
          ['Ingresos Real',fE(md.ingR),pctColor(md.ingR-md.ingP)],
          ['Gastos Pres.',fE(totalP),'var(--text)'],
          ['Gastos Real',fE(totalR),pctColor(totalP-totalR)],
          ['Ahorro Pres.',fE(ahorroP),pctColor(ahorroP)],
          ['Ahorro Real',fE(ahorroR),pctColor(ahorroR)],
          ['Tasa Ahorro',tasaAhorro.toFixed(1)+'%',pctColor(tasaAhorro-20)],
          ['vs Presupuesto',fPct((ahorroR-ahorroP)/Math.abs(ahorroP||1)*100,1),pctColor(ahorroR-ahorroP)],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'10px 12px'}}>
            <div style={{fontSize:10,color:'var(--text2)',marginBottom:4,textTransform:'uppercase',letterSpacing:'.03em'}}>{l}</div>
            <div style={{fontSize:18,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</div>
          </div>
        ))}
      </div>
      {/* Income inputs */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{fontWeight:700,marginBottom:10}}>💰 Ingresos</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div>
            <label className="lbl">Presupuestado</label>
            <input type="number" value={md.ingP} onChange={e=>{const u2=JSON.parse(JSON.stringify(user));if(!u2.bd[year])u2.bd[year]={};if(!u2.bd[year][month])u2.bd[year][month]={cats:{},ingP:0,ingR:0};u2.bd[year][month].ingP=+e.target.value||0;persist(u2);onUpdateUser(u2);}}/>
          </div>
          <div>
            <label className="lbl">Real</label>
            <input type="number" value={md.ingR} onChange={e=>{const u2=JSON.parse(JSON.stringify(user));if(!u2.bd[year])u2.bd[year]={};if(!u2.bd[year][month])u2.bd[year][month]={cats:{},ingP:0,ingR:0};u2.bd[year][month].ingR=+e.target.value||0;persist(u2);onUpdateUser(u2);}}/>
          </div>
        </div>
      </div>
      {/* Expense categories */}
      {cats.map(cat=>(
        <div key={cat.cat} className="card" style={{marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:'var(--gold)'}}>{cat.cat}</div>
          {cat.items.map(item=>{
            const vals = md.cats[item]||{p:0,r:0};
            const diff = vals.r - vals.p;
            return (
              <div key={item} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontSize:12,flex:1}}>{item}</span>
                  {vals.p>0&&vals.r>0&&<span style={{fontSize:10,color:pctColor(-diff),marginLeft:8}}>{diff>0?'+':''}{fE(diff)}</span>}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  <input type="number" value={vals.p||''} placeholder="Pres." onChange={e=>setVal(item,'p',e.target.value)} style={{fontSize:12}}/>
                  <input type="number" value={vals.r||''} placeholder="Real" onChange={e=>setVal(item,'r',e.target.value)} style={{fontSize:12}}/>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── TAB INVERSIONES ─────────────────────────────────────────────────────────
function TabInversiones({ user, onUpdateUser }) {
  const [chart, setChart] = useState(null);
  const [tick, setTick] = useState(0);
  const openInv = (user?.inv||[]).filter(i=>i.abierta!==false);
  const closedInv = (user?.inv||[]).filter(i=>i.abierta===false);

  useEffect(()=>{
    const tickers = openInv.map(i=>i.ticker).filter(Boolean);
    if(tickers.length) fetchPrices(tickers).then(()=>setTick(t=>t+1));
  },[]);

  const totales = openInv.reduce((acc,inv)=>{
    const live = PRICE_CACHE[inv.ticker];
    const pAct = live?.price || inv.pA || inv.pC;
    const valor = pAct * inv.qty;
    const coste = inv.pC * inv.qty;
    acc.valor += valor; acc.coste += coste;
    return acc;
  },{valor:0,coste:0});
  const pnl = totales.valor - totales.coste;
  const pnlPct = totales.coste>0 ? pnl/totales.coste*100 : 0;

  return (
    <div className="sec">
      {chart && <ChartModal sym={chart.sym} name={chart.name} onClose={()=>setChart(null)} onWatchlist={()=>{}} isInWL={false}/>}
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        {[['Valor Cartera',fE(totales.valor),'var(--gold)'],
          ['P&L Total',fE(pnl),pctColor(pnl)],
          ['Rentab.',fPct(pnlPct,1),pctColor(pnlPct)]].map(([l,v,c])=>(
          <div key={l} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'10px 12px',textAlign:'center'}}>
            <div style={{fontSize:9,color:'var(--text2)',marginBottom:4,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontSize:16,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</div>
          </div>
        ))}
      </div>
      {/* Positions */}
      <div className="card">
        <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>📊 Posiciones Abiertas <button className="bo" onClick={()=>fetchPrices(openInv.map(i=>i.ticker).filter(Boolean)).then(()=>setTick(t=>t+1))} style={{fontSize:11,padding:'3px 8px',marginLeft:8}}>🔄 Actualizar</button></div>
        {openInv.length===0 ? <div style={{color:'var(--text2)',textAlign:'center',padding:20}}>No hay posiciones abiertas</div> : (
          <div className="ov">
            <table style={{minWidth:500}}>
              <thead><tr><th>Activo</th><th>Qty</th><th>P.Coste</th><th>P.Actual</th><th>Valor</th><th>P&L</th></tr></thead>
              <tbody>
                {openInv.map(inv=>{
                  const live=PRICE_CACHE[inv.ticker];
                  const pAct=live?.price||inv.pA||inv.pC;
                  const valor=pAct*inv.qty; const coste=inv.pC*inv.qty;
                  const pnl2=valor-coste; const pnlP=coste>0?pnl2/coste*100:0;
                  return (
                    <tr key={inv.id} onClick={()=>inv.ticker&&setChart({sym:inv.ticker,name:inv.nombre})} style={{cursor:inv.ticker?'pointer':'default'}} onMouseOver={e=>e.currentTarget.style.background='rgba(210,138,63,.04)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                      <td><div style={{fontWeight:600,fontSize:12}}>{inv.nombre}</div><div style={{fontSize:10,color:'var(--accent)',fontFamily:'monospace'}}>{inv.ticker} {live?<span style={{color:pctColor(live.pct)}}>({fPct(live.pct,2)})</span>:PRICE_LOADING.has(inv.ticker)?'⏳':''}</div></td>
                      <td style={{fontFamily:'monospace'}}>{inv.qty}</td>
                      <td style={{fontFamily:'monospace'}}>{fE(inv.pC)}</td>
                      <td style={{fontFamily:'monospace',color:live?'var(--gold)':'var(--text)'}}>{fE(pAct)}{live&&<div style={{fontSize:9,color:'var(--green)'}}>⚡ live</div>}</td>
                      <td style={{fontFamily:'monospace',fontWeight:700}}>{fE(valor)}</td>
                      <td style={{fontFamily:'monospace',fontWeight:700,color:pctColor(pnl2)}}>{fE(pnl2)}<br/><span style={{fontSize:10}}>{fPct(pnlP,1)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB PATRIMONIO ───────────────────────────────────────────────────────────
function TabPatrimonio({ user }) {
  const openInv = (user?.inv||[]).filter(i=>i.abierta!==false);
  const loans = user?.loans||[];

  const valorCartera = openInv.reduce((s,i)=>{
    const live=PRICE_CACHE[i.ticker]; return s+(live?.price||i.pA||i.pC)*i.qty;
  },0);
  const deuda = loans.reduce((s,l)=>s+l.pendiente,0);
  const saldo = user?.saldo||0;
  const patrimonioNeto = valorCartera + saldo - deuda;

  const byType = openInv.reduce((acc,inv)=>{
    const k=inv.tipo||'Otro'; if(!acc[k])acc[k]=0;
    acc[k]+=(PRICE_CACHE[inv.ticker]?.price||inv.pA||inv.pC)*inv.qty;
    return acc;
  },{});

  const colors = ['#6c63ff','#00d4aa','#ffa94d','#ff6b6b','#4da6ff','#a78bfa','#34d399'];

  return (
    <div className="sec">
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12}}>
        {[['Patrimonio Neto',fE(patrimonioNeto),'var(--gold)'],
          ['Cartera Inversiones',fE(valorCartera),'var(--green)'],
          ['Saldo Líquido',fE(saldo),'var(--blue)'],
          ['Deuda Total',fE(deuda),'var(--red)']].map(([l,v,c])=>(
          <div key={l} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'12px 14px'}}>
            <div style={{fontSize:10,color:'var(--text2)',marginBottom:4,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontSize:20,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Distribución por tipo */}
      {Object.keys(byType).length>0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>🥧 Distribución por tipo</div>
          {Object.entries(byType).map(([tipo,val],i)=>(
            <div key={tipo} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:12,height:12,borderRadius:2,background:colors[i%colors.length],flexShrink:0}}/>
                <span style={{fontSize:13}}>{tipo}</span>
              </div>
              <div style={{textAlign:'right'}}>
                <span style={{fontWeight:700,fontFamily:'monospace'}}>{fE(val)}</span>
                <span style={{fontSize:10,color:'var(--text2)',marginLeft:6}}>{valorCartera>0?(val/valorCartera*100).toFixed(1):'0'}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Préstamos */}
      {loans.length>0 && (
        <div className="card">
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>🏦 Préstamos y Deudas</div>
          {loans.map(l=>(
            <div key={l.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontWeight:600,fontSize:13}}>{l.nombre}</span>
                <span style={{fontWeight:700,color:'var(--red)',fontFamily:'monospace'}}>{fE(l.pendiente)}</span>
              </div>
              <div style={{display:'flex',gap:16,fontSize:11,color:'var(--text2)'}}>
                <span>Cuota: {fE(l.cuota)}/mes</span>
                <span>Tipo: {l.tipo}%</span>
                <span>Fin: {l.fin?.slice(0,7)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  const handleLogin = () => {
    const users = LS.users();
    const u = users.find(x => x.email===email && x.pass===pass);
    if(!u) { setErr('Email o contraseña incorrectos'); return; }
    const full = LS.loadUser(u) || u;
    persist(full); onLogin(full);
  };

  const handleRegister = () => {
    if(!name||!email||!pass) { setErr('Rellena todos los campos'); return; }
    if(pass.length<4) { setErr('Contraseña mínimo 4 caracteres'); return; }
    const users=LS.users();
    if(users.find(x=>x.email===email)) { setErr('Email ya registrado'); return; }
    const u={id:Date.now(),email,pass,name,titulares:[{id:'t1',nombre:name,tipo:'individual'}],
      customCats:JSON.parse(JSON.stringify(DEFAULT_CATS)),bd:{},inv:[],loans:[],saldo:0,
      watchlists:[{id:'wl1',name:'Principal',items:[]}]};
    persist(u); onLogin(u);
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',padding:16}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:8}}>📊</div>
          <h1 style={{fontSize:22,fontWeight:800,color:'var(--gold)',marginBottom:4}}>Invertir de 0 a 100</h1>
          <p style={{fontSize:12,color:'var(--text2)'}}>Tu gestor financiero personal · Renta 4</p>
        </div>

        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:20}}>
          <div style={{display:'flex',background:'var(--bg3)',borderRadius:8,padding:3,marginBottom:16,gap:2}}>
            {['login','register'].map(m=><button key={m} className={mode===m?'ba':'bo'} onClick={()=>{setMode(m);setErr('');}} style={{flex:1,padding:'7px 4px',fontSize:12,fontWeight:700,border:'none',borderRadius:7}}>{m==='login'?'Entrar':'Registrarse'}</button>)}
          </div>

          {mode==='register' && <div style={{marginBottom:12}}>
            <label className="lbl">Nombre</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/>
          </div>}
          <div style={{marginBottom:12}}>
            <label className="lbl">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" onKeyDown={e=>e.key==='Enter'&&(mode==='login'?handleLogin():handleRegister())}/>
          </div>
          <div style={{marginBottom:16}}>
            <label className="lbl">Contraseña</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••" onKeyDown={e=>e.key==='Enter'&&(mode==='login'?handleLogin():handleRegister())}/>
          </div>

          {err && <div style={{background:'rgba(224,82,82,.1)',border:'1px solid rgba(224,82,82,.3)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'var(--red)',marginBottom:12}}>{err}</div>}

          <button className="ba" onClick={mode==='login'?handleLogin:handleRegister} style={{width:'100%',padding:'12px 0',fontSize:14,fontWeight:700}}>
            {mode==='login'?'Entrar →':'Crear cuenta →'}
          </button>

          {mode==='login' && <button onClick={()=>{const demo=LS.users().find(u=>u.email==='demo@finanzas.com')||DEMO_USER;const full=LS.loadUser(demo)||demo;persist(full);onLogin(full);}} style={{width:'100%',padding:'10px 0',fontSize:12,marginTop:8,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text2)',cursor:'pointer'}}>
            👁 Ver demo
          </button>}
        </div>
      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#12100c;--bg2:#1a1510;--bg3:#241c12;--card:#2a1f12;--border:#4a3520;
  --accent:#c03c3b;--gold:#d28a3f;--gold2:#e8a84a;
  --green:#4caf7d;--red:#e05252;--yellow:#d28a3f;--blue:#5b9bd5;--purple:#a07fd4;
  --text:#f5ede0;--text2:#a8927a;--topbar:#1e1409;--tabbar:#1a1208;
  --r:14px;--rS:8px;--gap:12px;--pad:14px;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overscroll-behavior:none;}
h1,h2,h3{font-weight:700}
input,select,textarea{background:var(--bg3);border:1px solid var(--border);border-radius:var(--rS);color:var(--text);padding:9px 12px;font-size:14px;width:100%;outline:none;font-family:inherit;}
input:focus,select:focus{border-color:var(--gold);}
label.lbl{display:block;font-size:11px;color:var(--text2);margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;}
button{cursor:pointer;font-family:inherit;font-size:13px;border-radius:var(--rS);padding:8px 14px;transition:opacity .15s;}
button.ba{background:var(--gold);color:#1a1208;border:none;font-weight:700;}
button.ba:hover{opacity:.88}
button.bo{background:var(--bg3);border:1px solid var(--border);color:var(--text);}
button.bo:hover{border-color:var(--gold);color:var(--gold);}
button.bs{background:rgba(210,138,63,.15);border:1px solid var(--gold);color:var(--gold);}
button.bd{background:rgba(224,82,82,.1);border:1px solid rgba(224,82,82,.3);color:var(--red);}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px;}
.sec{padding:14px;padding-bottom:90px;}
.sech{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
.sect{font-size:18px;font-weight:800;color:var(--gold);}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.ov{overflow-x:auto;-webkit-overflow-scrolling:touch;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th{background:var(--bg3);color:var(--text2);font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:left;white-space:nowrap;font-weight:600;position:sticky;top:0;}
td{padding:9px 10px;border-bottom:1px solid rgba(74,53,32,.2);vertical-align:top;}
tr:last-child td{border-bottom:none;}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--bg3)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
`;

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => LS.session());
  const [tab, setTab] = useState(0);

  const handleLogin = u => { setUser(u); setTab(0); };
  const handleLogout = () => { LS.clearSession(); setUser(null); };
  const handleUpdateUser = u => { setUser(u); };

  if(!user) return (
    <>
      <style>{CSS}</style>
      <LoginScreen onLogin={handleLogin}/>
    </>
  );

  const tabs = [
    {label:'💰 Presupuesto', component:<TabPresupuesto user={user} onUpdateUser={handleUpdateUser}/>},
    {label:'📈 Inversiones', component:<TabInversiones user={user} onUpdateUser={handleUpdateUser}/>},
    {label:'🏦 Patrimonio',  component:<TabPatrimonio  user={user}/>},
    {label:'🛠️ Herramientas',component:<TabHerramientas user={user} onUpdateUser={handleUpdateUser}/>},
  ];

  return (
    <>
      <style>{CSS}</style>
      {/* Top bar */}
      <div style={{position:'sticky',top:0,zIndex:100,background:'var(--topbar)',borderBottom:'1px solid var(--border)',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontWeight:800,fontSize:15,color:'var(--gold)'}}>📊 0 a 100</div>
        <div style={{fontSize:11,color:'var(--text2)'}}>{user.name}</div>
        <button className="bo" onClick={handleLogout} style={{fontSize:11,padding:'4px 10px'}}>Salir</button>
      </div>

      {/* Content */}
      <div style={{paddingBottom:70}}>
        {tabs[tab].component}
      </div>

      {/* Bottom tab bar */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'var(--tabbar)',borderTop:'1px solid var(--border)',display:'flex',zIndex:100}}>
        {tabs.map((t,i) => (
          <button key={i} onClick={()=>setTab(i)} style={{flex:1,padding:'10px 4px 12px',fontSize:10,fontWeight:700,background:'none',border:'none',borderTop:`2px solid ${tab===i?'var(--gold)':'transparent'}`,color:tab===i?'var(--gold)':'var(--text2)',borderRadius:0,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <span style={{fontSize:16}}>{t.label.split(' ')[0]}</span>
            <span>{t.label.split(' ').slice(1).join(' ')}</span>
          </button>
        ))}
      </div>
    </>
  );
}
