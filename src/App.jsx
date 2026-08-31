import { useEffect, useMemo, useState } from 'react';
import settingsConfig from '../config/settings.json';
import commoditiesConfig from '../config/commodities.json';
import sourcesConfig from '../config/sources.json';

const COMMODITIES = ['COPPER', 'ALUMINUM', 'TIN', 'FERRO_ALLOY', 'MOLYBDENUM'];
const EMPTY_STATUS = {
  lastUpdated: null, nextScheduledRun: null, agentStatus: 'NOT_RUN', telegramStatus: 'NOT_CONFIGURED', sourceStats: [],
  runStats: { fetched: 0, relevant: 0, analyzed: 0, sent: 0, failed: 0 }
};
const EMPTY_SUMMARIES = COMMODITIES.map((commodity) => ({ commodity, overallMarketBias: 'Unclear', procurementRisk: 'UNCLEAR', supplySignal: 'UNCLEAR', demandSignal: 'UNCLEAR', inventorySignal: 'UNCLEAR', mainDriver: 'Insufficient Data' }));

const formatKst = (value, withDate = true) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: withDate ? 'numeric' : undefined, month: withDate ? '2-digit' : undefined,
    day: withDate ? '2-digit' : undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(value)).replace(',', '') + ' KST';
};

const todayKst = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const displayCommodity = (value) => value?.replace('_', ' ') || '—';
const tone = (value) => String(value || 'UNCLEAR').toLowerCase().replace('_', '-');

async function getJson(file, fallback) {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status}`);
    return await response.json();
  } catch {
    return fallback;
  }
}

function StatusPill({ label, value }) {
  return <div className="status-item"><span>{label}</span><strong className={`status-dot ${tone(value)}`}>{value || '—'}</strong></div>;
}

function Header({ status, activeView, onView }) {
  return <>
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark"><span /></div>
        <div><p className="eyebrow">INDUSTRIAL METALS / LIVE INTELLIGENCE</p><h1>METALS INTELLIGENCE <em>AGENT</em></h1></div>
      </div>
      <div className="topbar-status">
        <StatusPill label="AGENT" value={status.agentStatus} />
        <StatusPill label="TELEGRAM" value={status.telegramStatus} />
      </div>
    </header>
    <nav className="navline">
      <div className="navtabs">
        <button className={activeView === 'intelligence' ? 'active' : ''} onClick={() => onView('intelligence')}>Intelligence</button>
        <button className={activeView === 'settings' ? 'active' : ''} onClick={() => onView('settings')}>Settings & Sources</button>
      </div>
      <div className="run-clock"><span>LAST UPDATE</span>{formatKst(status.lastUpdated)}<i /> <span>NEXT RUN</span>{formatKst(status.nextScheduledRun)}</div>
    </nav>
  </>;
}

function CommodityCards({ articles, summaries }) {
  const today = todayKst(new Date());
  return <section className="commodity-grid">
    {COMMODITIES.map((commodity, index) => {
      const items = articles.filter((item) => item.commodity === commodity && todayKst(item.publishedAt || item.fetchedAt) === today);
      const summary = summaries.find((item) => item.commodity === commodity) || EMPTY_SUMMARIES[index];
      const latest = [...items].sort((a, b) => Date.parse(b.publishedAt || b.fetchedAt) - Date.parse(a.publishedAt || a.fetchedAt))[0];
      return <article className="commodity-card" key={commodity} style={{ '--delay': `${index * 45}ms` }}>
        <div className="card-head"><span className={`metal-index metal-${index}`}>0{index + 1}</span><h3>{displayCommodity(commodity)}</h3><span className={`bias-chip ${tone(summary.overallMarketBias)}`}>{summary.overallMarketBias}</span></div>
        <div className="metric-row"><div><strong>{items.length}</strong><span>TODAY</span></div><div><strong className="high-text">{items.filter((item) => item.importance === 'HIGH').length}</strong><span>HIGH</span></div><div><strong>{items.filter((item) => item.importance === 'MEDIUM').length}</strong><span>MEDIUM</span></div></div>
        <div className="direction-counts"><span><b className="bullish">{items.filter((item) => item.marketImpact === 'Bullish').length}</b> BULLISH</span><span><b className="bearish">{items.filter((item) => item.marketImpact === 'Bearish').length}</b> BEARISH</span></div>
        <div className="split-stats"><span>Supply <b>{summary.supplySignal}</b></span><span>Procurement <b className={tone(summary.procurementRisk)}>{summary.procurementRisk}</b></span></div>
        <div className="card-foot"><span>LAST SIGNAL</span><b>{latest ? formatKst(latest.publishedAt || latest.fetchedAt, false) : 'NO DATA'}</b></div>
      </article>;
    })}
  </section>;
}

function SignalBoard({ summaries }) {
  return <section className="panel signal-panel">
    <div className="panel-title"><div><p className="eyebrow">CROSS-MARKET VIEW</p><h2>Market Signal Board</h2></div><span className="method-note">Evidence-weighted / Conflicts resolve to Unclear</span></div>
    <div className="signal-table">
      <div className="signal-row header"><span>Commodity</span><span>Market Bias</span><span>Supply</span><span>Demand</span><span>Inventory</span><span>Procurement Risk</span></div>
      {COMMODITIES.map((commodity) => {
        const item = summaries.find((entry) => entry.commodity === commodity) || EMPTY_SUMMARIES[0];
        return <div className="signal-row" key={commodity}>
          <strong>{displayCommodity(commodity)}</strong>
          <span><i className={`signal-light ${tone(item.overallMarketBias)}`} />{item.overallMarketBias}</span>
          <span>{item.supplySignal}</span><span>{item.demandSignal}</span><span>{item.inventorySignal}</span>
          <span className={`risk-label ${tone(item.procurementRisk)}`}>{item.procurementRisk}</span>
        </div>;
      })}
    </div>
  </section>;
}

const FILTERS = [
  ['commodity', 'All commodities'], ['importance', 'All importance'], ['marketImpact', 'All market impact'],
  ['procurementImpact', 'All procurement'], ['category', 'All categories'], ['region', 'All regions'], ['source', 'All sources'], ['analysisSource', 'All analysis sources']
];

function NewsTable({ articles, onSelect }) {
  const [filters, setFilters] = useState(Object.fromEntries(FILTERS.map(([key]) => [key, 'ALL'])));
  const options = useMemo(() => ({
    commodity: COMMODITIES,
    importance: ['HIGH', 'MEDIUM', 'LOW'],
    marketImpact: ['Bullish', 'Bearish', 'Neutral', 'Unclear'],
    procurementImpact: ['NEGATIVE', 'POSITIVE', 'NEUTRAL', 'UNCLEAR'],
    category: [...new Set(articles.flatMap((item) => item.categories || []))].sort(),
    region: [...new Set(articles.flatMap((item) => item.regions || []))].sort(),
    source: [...new Set(articles.map((item) => item.source))].sort(),
    analysisSource: ['RULE', 'CODEX']
  }), [articles]);
  const filtered = useMemo(() => articles.filter((item) =>
    (filters.commodity === 'ALL' || item.commodity === filters.commodity)
    && (filters.importance === 'ALL' || item.importance === filters.importance)
    && (filters.marketImpact === 'ALL' || item.marketImpact === filters.marketImpact)
    && (filters.procurementImpact === 'ALL' || item.procurementImpact === filters.procurementImpact)
    && (filters.category === 'ALL' || item.categories?.includes(filters.category))
    && (filters.region === 'ALL' || item.regions?.includes(filters.region))
    && (filters.source === 'ALL' || item.source === filters.source)
    && (filters.analysisSource === 'ALL' || (item.analysisSource || 'RULE') === filters.analysisSource)
  ), [articles, filters]);

  return <section className="panel news-panel">
    <div className="panel-title"><div><p className="eyebrow">PRIORITIZED EVENT STREAM</p><h2>Latest Intelligence</h2></div><div className="record-count"><b>{filtered.length}</b> / {articles.length} records</div></div>
    <div className="filters">{FILTERS.map(([key, label]) => <label key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><select value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}><option value="ALL">{label}</option>{options[key].map((option) => <option key={option}>{option}</option>)}</select></label>)}</div>
    <div className="table-scroll"><table><thead><tr><th>Time</th><th>Commodity</th><th>Sub Commodity</th><th>Importance</th><th>Market</th><th>Procurement</th><th>Category</th><th>Region</th><th>Title</th><th>Source</th><th>Analysis Source</th><th>Sent</th></tr></thead>
      <tbody>{filtered.length ? filtered.map((item) => <tr key={item.id} onClick={() => onSelect(item)}>
        <td className="mono">{formatKst(item.publishedAt || item.fetchedAt, false)}</td>
        <td><b>{displayCommodity(item.commodity)}</b></td><td className="mono">{item.subCommodity || '—'}</td>
        <td><span className={`importance ${tone(item.importance)}`}>{item.importance}</span></td>
        <td><span className={`impact ${tone(item.marketImpact)}`}>{item.marketImpact}</span></td>
        <td><span className={`impact ${tone(item.procurementImpact)}`}>{item.procurementImpact}</span></td>
        <td className="categories">{item.categories?.slice(0, 2).join(' · ')}</td>
        <td>{item.regions?.slice(0, 2).join(', ') || '—'}</td><td className="headline"><b>{item.titleKo || item.title}</b></td><td>{item.source}</td>
        <td><span className={`analysis-source ${tone(item.analysisSource || 'RULE')}`}>{item.analysisSource || 'RULE'}</span></td>
        <td><span className={item.sent ? 'sent yes' : 'sent'}>{item.sent ? 'SENT' : '—'}</span></td>
      </tr>) : <tr><td colSpan="12" className="empty-state">No intelligence matches the current filters.</td></tr>}</tbody></table></div>
  </section>;
}

function ArticleDrawer({ article, onClose }) {
  if (!article) return null;
  const field = (label, value, className = '') => <div className="detail-field"><span>{label}</span><b className={className}>{value || '확인 불가'}</b></div>;
  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="drawer"><button className="drawer-close" onClick={onClose}>×</button><p className="eyebrow">EVENT INTELLIGENCE / {article.analysisSource || 'RULE'}</p><h2>{article.titleKo || article.title}</h2>
      <div className="drawer-badges"><span className={`importance ${tone(article.importance)}`}>{article.importance}</span><span>{displayCommodity(article.commodity)}{article.subCommodity ? ` / ${article.subCommodity}` : ''}</span><span>{article.confidence} CONFIDENCE</span></div>
      <section><h3>Original Information</h3>{field('Original title', article.title)}{field('Source', article.source)}{field('Published', formatKst(article.publishedAt))}<a className="source-link" href={article.url} target="_blank" rel="noreferrer">Open original source ↗</a></section>
      <section><h3>Intelligence Analysis</h3><p className="summary-copy">{article.summaryKo}</p><div className="two-col">{field('Market impact', article.marketImpact, tone(article.marketImpact))}{field('Procurement', article.procurementImpact, tone(article.procurementImpact))}{field('Time horizon', article.timeHorizon)}{field('Priority', article.priority)}</div>
        <div className="reason"><span>MARKET RATIONALE</span><p>{article.impactReasonKo}</p></div><div className="reason"><span>PROCUREMENT RATIONALE</span><p>{article.procurementReasonKo}</p></div>
      </section>
      <section><h3>Classification</h3><div className="tag-cloud">{[...(article.categories || []), ...(article.signals || [])].map((item) => <span key={item}>{item}</span>)}</div>{field('Regions', article.regions?.join(', '))}{field('Companies', article.companies?.join(', '))}</section>
    </aside>
  </div>;
}

function SettingsPanel({ status }) {
  const downloadConfig = () => {
    const payload = { exportedAt: new Date().toISOString(), settings: settingsConfig, commodities: commoditiesConfig, sources: sourcesConfig };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'metals-intelligence-config.json'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <main className="settings-layout">
    <section className="settings-hero"><p className="eyebrow">READ-ONLY REPOSITORY CONFIG</p><h2>Agent Settings</h2><p>이 화면은 현재 빌드에 포함된 설정을 표시합니다. 변경하려면 내보낸 JSON을 참고해 repository의 <code>config/*.json</code>을 수정하세요.</p><button className="primary-action" onClick={downloadConfig}>Export Config JSON</button></section>
    <section className="settings-grid"><article className="panel"><h3>Runtime policy</h3>{Object.entries(settingsConfig).filter(([, value]) => !Array.isArray(value) && typeof value !== 'object').map(([key, value]) => <div className="setting-line" key={key}><span>{key}</span><b>{String(value)}</b></div>)}</article>
      <article className="panel"><h3>Configured sources</h3>{sourcesConfig.sources.map((source) => <div className="source-line" key={source.name}><i className={source.enabled ? 'online' : ''} /><div><b>{source.name}</b><span>{source.language.toUpperCase()} · {source.type.toUpperCase()}</span></div></div>)}</article>
      <article className="panel"><h3>Latest source health</h3>{status.sourceStats?.length ? status.sourceStats.map((source) => <div className="setting-line" key={source.name}><span>{source.name}</span><b className={tone(source.status)}>{source.status} · {source.count}</b></div>) : <p className="muted">Run the agent to populate source health.</p>}</article>
      <article className="panel"><h3>Secret boundary</h3><p className="security-note">Telegram and Kakao credentials are only read by Node.js and GitHub Actions. No secret uses a <code>VITE_*</code> variable or enters the browser bundle.</p></article>
    </section>
  </main>;
}

export default function App() {
  const [activeView, setActiveView] = useState('intelligence');
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [articles, setArticles] = useState([]);
  const [summaries, setSummaries] = useState(EMPTY_SUMMARIES);
  const [selected, setSelected] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const loadDashboard = () => Promise.all([
      getJson('latest-news.json', { items: [] }), getJson('status.json', EMPTY_STATUS), getJson('market-summary.json', { summaries: EMPTY_SUMMARIES })
    ]).then(([news, nextStatus, market]) => {
      if (!active) return;
      setArticles(news.items || []); setStatus(nextStatus); setSummaries(market.summaries || EMPTY_SUMMARIES); setLoaded(true);
    });
    void loadDashboard();
    const timer = setInterval(loadDashboard, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return <div className="app-shell"><Header status={status} activeView={activeView} onView={setActiveView} />
    {activeView === 'settings' ? <SettingsPanel status={status} /> : <main className={`dashboard ${loaded ? 'loaded' : ''}`}>
      <section className="page-intro"><div><p className="eyebrow">TRADING + PROCUREMENT COMMAND VIEW</p><h2>Signal quality over news quantity.</h2></div><div className="run-summary"><span><b>{status.runStats?.fetched || 0}</b> FETCHED</span><span><b>{status.runStats?.relevant || 0}</b> RELEVANT</span><span><b>{status.runStats?.sent || 0}</b> SENT</span></div></section>
      <CommodityCards articles={articles} summaries={summaries} /><SignalBoard summaries={summaries} /><NewsTable articles={articles} onSelect={setSelected} />
    </main>}
    <footer><span>METALS INTELLIGENCE AGENT / KST</span><span>Uncertain evidence is intentionally classified as Unclear.</span></footer>
    <ArticleDrawer article={selected} onClose={() => setSelected(null)} />
  </div>;
}
