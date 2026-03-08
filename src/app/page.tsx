'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Search,
  RefreshCw,
  Rocket,
  TrendingUp,
  TrendingDown,
  Settings,
  ShieldCheck,
  HelpCircle,
  Bell,
  User,
  Filter,
  Download,
  Activity,
  Zap,
  CheckCircle2,
  Eye,
  Plus,
  Trash2,
  LineChart,
  ChevronRight,
  Calculator,
  Wallet,
  Target,
  AlertTriangle,
  History
} from 'lucide-react';
import Sparkline from '@/components/Sparkline';

interface StockResult {
  ticker: string;
  price: number;
  volume: number;
  volumeRatio: number;
  isVolumeSpike: boolean;
  tightness: number;
  distance: number;
  smaValues: Record<string, number>;
  sparkline: number[];
}

interface WatchlistItem {
  ticker: string;
  entryPrice: number;
  entryDate: string;
}

export default function Home() {
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  // Watchlist State
  const [activeTab, setActiveTab] = useState<'screener' | 'watchlist' | 'analysis' | 'history'>('screener');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistData, setWatchlistData] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Trade Analysis State
  const [capital, setCapital] = useState<number>(10000000); // 10jt
  const [riskPercent, setRiskPercent] = useState<number>(2); // 2%
  const [selectedStockForAnalysis, setSelectedStockForAnalysis] = useState<StockResult | null>(null);
  const [tradePlan, setTradePlan] = useState<{
    ticker: string;
    entry: number;
    sl: number;
    tp: number;
    lots: number;
    totalValue: number;
    maxLoss: number;
    potentialProfit: number;
    rrRatio: number;
    strategy?: 'HAKA' | 'ANTRI';
  } | null>(null);

  const getTickSize = (price: number) => {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    return 25;
  };

  // Firestore Sync: Settings & Watchlist
  useEffect(() => {
    // Sync Settings (Capital, Risk)
    const settingsDoc = doc(db, 'users/default/settings/user_settings');
    const unsubscribeSettings = onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.capital) setCapital(data.capital);
        if (data.riskPercent) setRiskPercent(data.riskPercent);
      }
    });

    // Sync Watchlist
    const watchlistCol = collection(db, 'users/default/watchlist');
    const unsubscribeWatchlist = onSnapshot(watchlistCol, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data() as WatchlistItem);
      setWatchlist(items);
    });

    // Sync History
    const historyCol = collection(db, 'users/default/history');
    const historyQuery = query(historyCol, orderBy('timestamp', 'desc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(items);
    });

    return () => {
      unsubscribeSettings();
      unsubscribeWatchlist();
      unsubscribeHistory();
    };
  }, []);

  // Save Settings to Firestore when changed
  useEffect(() => {
    const saveSettings = async () => {
      await setDoc(doc(db, 'users/default/settings/user_settings'), {
        capital,
        riskPercent
      }, { merge: true });
    };
    saveSettings();
  }, [capital, riskPercent]);

  // Fetch quotes when watchlist changes or tab switches
  useEffect(() => {
    if (watchlist.length > 0 && activeTab === 'watchlist') {
      fetchWatchlistQuotes();
    }
  }, [watchlist, activeTab]);

  const calculateTradePlan = (stock: StockResult) => {
    let entry = stock.price;
    let strategy: 'HAKA' | 'ANTRI' = 'ANTRI';

    if (stock.isVolumeSpike) {
      entry = stock.price + getTickSize(stock.price);
      strategy = 'HAKA';
    } else {
      // Find nearest MA below price (MA 5, 20, 50, 100, 200)
      const mas = Object.values(stock.smaValues).filter(v => v <= stock.price);
      if (mas.length > 0) {
        entry = Math.max(...mas);
      }
      strategy = 'ANTRI';
    }

    // SL: Under MA 20
    const ma20 = stock.smaValues['20'];
    const sl = ma20 * 0.995; // 0.5% buffer below MA 20

    // TP: Maintain 1:2 R:R from calculated entry
    const tp = entry + (entry - sl) * 2;

    const riskAmount = capital * (riskPercent / 100);
    const riskPerShare = entry - sl;

    if (riskPerShare <= 0) return; // Guard

    let lots = Math.floor(riskAmount / (riskPerShare * 100)); // 1 lot = 100 shares

    // Safety check: Don't spend more than 25% of total capital on one stock
    const maxValue = capital * 0.25;
    if (lots * 100 * entry > maxValue) {
      lots = Math.floor(maxValue / (entry * 100));
    }

    if (lots < 1) lots = 1; // Minimum 1 lot

    setTradePlan({
      ticker: stock.ticker,
      entry,
      sl,
      tp,
      lots,
      totalValue: lots * 100 * entry,
      maxLoss: lots * 100 * (entry - sl),
      potentialProfit: lots * 100 * (tp - entry),
      rrRatio: (tp - entry) / (entry - sl),
      strategy
    });
  };

  const handleAnalyzeClick = (stock: StockResult) => {
    setSelectedStockForAnalysis(stock);
    calculateTradePlan(stock);
    setActiveTab('analysis');
  };

  const performScreening = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/screen${force ? '?refresh=true' : ''}`);
      const data = await response.json();
      if (data.results) {
        setResults(data.results);
        setCached(data.cached);
      } else {
        setError('Failed to fetch results');
      }
    } catch (err) {
      setError('An error occurred while screening');
    } finally {
      setLoading(false);
    }
  };

  const fetchWatchlistQuotes = async () => {
    if (watchlist.length === 0) return;
    setWatchlistLoading(true);
    try {
      const symbols = watchlist.map(w => w.ticker).join(',');
      const response = await fetch(`/api/watchlist?symbols=${symbols}`);
      const data = await response.json();
      setWatchlistData(data.results);
    } catch (err) {
      console.error('Failed to fetch watchlist quotes');
    } finally {
      setWatchlistLoading(false);
    }
  };

  const addToWatchlist = async (stock: StockResult) => {
    const tickerRef = doc(db, `users/default/watchlist/${stock.ticker}`);
    const snapshot = await getDoc(tickerRef);
    if (snapshot.exists()) return;

    const newItem = {
      ticker: stock.ticker,
      entryPrice: stock.price,
      entryDate: new Date().toISOString().split('T')[0]
    };
    await setDoc(tickerRef, newItem);
    alert(`${stock.ticker} added to watchlist at ${stock.price}`);
  };

  const removeFromWatchlist = async (ticker: string) => {
    await deleteDoc(doc(db, `users/default/watchlist/${ticker}`));
  };

  const executeTrade = async () => {
    if (!tradePlan || !selectedStockForAnalysis) return;

    try {
      // 1. Save to History
      await addDoc(collection(db, 'users/default/history'), {
        ...tradePlan,
        timestamp: new Date().toISOString(),
        type: 'BUY'
      });

      // 2. Add to Watchlist if not already there
      await addToWatchlist(selectedStockForAnalysis);

      alert('Trade executed and recorded in History!');
      setActiveTab('watchlist');
    } catch (err) {
      alert('Failed to execute trade');
    }
  };

  useEffect(() => {
    performScreening(false); // Initial load can use cache
  }, []);

  const spikeCount = results.filter(r => r.isVolumeSpike).length;
  const tightCount = results.filter(r => r.tightness < 0.05).length;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <Zap size={28} fill="currentColor" />
          <span>Nexus Stock</span>
        </div>

        <nav className="nav-section">
          <div className="nav-label">General</div>
          <button
            onClick={() => setActiveTab('screener')}
            className={`nav-item ${activeTab === 'screener' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`nav-item ${activeTab === 'watchlist' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Eye size={20} />
            <span>Watchlist</span>
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Calculator size={20} />
            <span>Trade Setup</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <History size={20} />
            <span>Journal</span>
          </button>
          <a href="#" className="nav-item">
            <Activity size={20} />
            <span>Market Data</span>
          </a>
        </nav>
        {/* ... rest of sidebar ... */}
      </aside>

      {/* Main Content */}
      <main className="main-wrapper">
        <header className="top-bar">
          <div className="search-bar">
            <Search size={18} color="var(--text-dim)" />
            <input type="text" placeholder="Search stock or strategy... (⌘ + F)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
            <Bell size={18} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>Adhik Naenggar</div>
                <div style={{ fontSize: '0.65rem' }}>Trader Pro</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>AN</div>
            </div>
          </div>
        </header>

        <section className="content-body">
          {activeTab === 'screener' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem' }}>Dashboard Overview</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Market Screening: Price &gt; SMAs + 0-3% Distance</p>
                </div>
                <button className="btn-primary" onClick={() => performScreening(true)} disabled={loading}>
                  {loading ? <span className="loading-dots">Screening</span> : <>
                    <RefreshCw size={14} />
                    <span>Refresh Screen</span>
                  </>}
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Matches</div>
                  <div className="stat-value">{results.length}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Super Tight MAs</div>
                  <div className="stat-value" style={{ color: 'var(--success)' }}>{tightCount}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Rocket Spikes</div>
                  <div className="stat-value" style={{ color: 'var(--accent)' }}>{spikeCount}</div>
                </div>
              </div>

              <div className="data-card">
                <div className="card-header">
                  <h3 className="card-title">List of Screened Stocks</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {cached && <div className="badge badge-indigo">Cached Data (1h)</div>}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ minWidth: '800px' }}>
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>Market Price</th>
                        <th>Ratio Volume</th>
                        <th>MA Tightness</th>
                        <th>MA Distance</th>
                        <th>20D Evolution</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={`skeleton-${i}`}>
                            <td>
                              <div className="ticker-cell">
                                <div className="skeleton skeleton-circle" />
                                <div style={{ flex: 1 }}>
                                  <div className="skeleton" style={{ width: '60%', marginBottom: '0.25rem' }} />
                                  <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                                </div>
                              </div>
                            </td>
                            <td><div className="skeleton" style={{ width: '50px' }} /></td>
                            <td><div className="skeleton" style={{ width: '40px' }} /></td>
                            <td><div className="skeleton" style={{ width: '60px' }} /></td>
                            <td><div className="skeleton" style={{ width: '50px' }} /></td>
                            <td><div className="skeleton" style={{ width: '100px', height: '30px' }} /></td>
                            <td><div className="skeleton" style={{ width: '80px', height: '30px' }} /></td>
                          </tr>
                        ))
                      ) : results.length > 0 ? (
                        results.map((stock) => (
                          <tr key={stock.ticker}>
                            <td>
                              <div className="ticker-cell">
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.625rem', color: 'var(--primary)' }}>
                                  {stock.ticker.substring(0, 2)}
                                </div>
                                <div>
                                  <div className="ticker-name">{stock.ticker}</div>
                                  <div className="ticker-desc">IDX Market</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{stock.price.toLocaleString('id-ID')}</div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 600 }}>{stock.volumeRatio.toFixed(1)}x</span>
                                {stock.isVolumeSpike && <Rocket size={14} color="var(--accent)" fill="var(--accent)" />}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${stock.tightness < 0.1 ? 'badge-cyan' : ''}`}>
                                {(stock.tightness * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-indigo" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                                +{(stock.distance * 100).toFixed(2)}%
                              </span>
                            </td>
                            <td>
                              <Sparkline data={stock.sparkline} color={stock.distance > 0 ? '#6366f1' : '#f43f5e'} />
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={() => addToWatchlist(stock)}
                                  className="nav-item"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', borderRadius: '0.5rem' }}
                                >
                                  {watchlist.find(w => w.ticker === stock.ticker) ? <CheckCircle2 size={12} color="var(--success)" /> : <Plus size={12} />}
                                  <span>{watchlist.find(w => w.ticker === stock.ticker) ? 'Saved' : 'Save'}</span>
                                </button>
                                <button
                                  onClick={() => handleAnalyzeClick(stock)}
                                  className="btn-primary"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer', borderRadius: '0.5rem', background: 'var(--text-main)', color: 'white' }}
                                >
                                  <Calculator size={12} />
                                  <span>Analyze</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : null}
                    </tbody>
                  </table>
                  {!loading && results.length === 0 && (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No stocks currently match the strategy criteria.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'watchlist' ? (
            <>
              {/* Watchlist View */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem' }}>My Watchlist</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tracking profit and loss for screened stocks</p>
                </div>
                <button className="btn-primary" onClick={fetchWatchlistQuotes} disabled={watchlistLoading}>
                  {watchlistLoading ? <span className="loading-dots">Updating</span> : <>
                    <RefreshCw size={14} />
                    <span>Update Prices</span>
                  </>}
                </button>
              </div>

              <div className="data-card">
                <div className="card-header">
                  <h3 className="card-title">Monitored Stocks</h3>
                  <div className="badge badge-rose">{watchlist.length} Stocks</div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  {watchlist.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Ticker</th>
                          <th>Entry Price (Open)</th>
                          <th>Current Price (Close)</th>
                          <th>Profit / Loss</th>
                          <th>Added Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {watchlist.map((item) => {
                          const liveData = watchlistData.find(d => d.ticker === item.ticker);
                          const currentPrice = liveData ? liveData.currentPrice : item.entryPrice;
                          const pl = ((currentPrice - item.entryPrice) / item.entryPrice) * 100;

                          return (
                            <tr key={item.ticker}>
                              <td>
                                <div className="ticker-cell">
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                    {item.ticker.substring(0, 2)}
                                  </div>
                                  <div className="ticker-name">{item.ticker}</div>
                                </div>
                              </td>
                              <td>{item.entryPrice.toLocaleString('id-ID')}</td>
                              <td>
                                {watchlistLoading ? <div className="skeleton" style={{ width: '40px' }} /> : (
                                  <div style={{ fontWeight: 700 }}>{currentPrice.toLocaleString('id-ID')}</div>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${pl >= 0 ? 'badge-cyan' : 'badge-rose'}`} style={{ fontWeight: 800 }}>
                                  {pl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {pl.toFixed(2)}%
                                </span>
                              </td>
                              <td>{item.entryDate}</td>
                              <td>
                                <button
                                  onClick={() => removeFromWatchlist(item.ticker)}
                                  style={{ border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                      <Eye size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>Your watchlist is empty. Add stocks from the Dashboard to start monitoring.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'history' ? (
            <>
              {/* History/Journal View */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem' }}>Trading Journal</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Cloud-synchronized record of all executed trades</p>
              </div>

              <div className="data-card">
                <div style={{ overflowX: 'auto' }}>
                  {history.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Ticker</th>
                          <th>Type</th>
                          <th>Entry</th>
                          <th>Lots</th>
                          <th>Total Value</th>
                          <th>SL / TP</th>
                          <th>R:R</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((record) => (
                          <tr key={record.id}>
                            <td>{new Date(record.timestamp).toLocaleString('id-ID')}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{record.ticker}</div>
                            </td>
                            <td>
                              <span className="badge badge-indigo">{record.type}</span>
                            </td>
                            <td>{record.entry.toLocaleString('id-ID')}</td>
                            <td>{record.lots}</td>
                            <td>Rp {record.totalValue.toLocaleString('id-ID')}</td>
                            <td>
                              <div style={{ fontSize: '0.75rem' }}>
                                <div style={{ color: 'var(--accent)' }}>SL: {record.sl.toLocaleString('id-ID')}</div>
                                <div style={{ color: 'var(--success)' }}>TP: {record.tp.toLocaleString('id-ID')}</div>
                              </div>
                            </td>
                            <td>{record.rrRatio?.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                      <History size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>Your trading journal is empty. Execute a trade setup to see records here.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Analysis View */}
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem' }}>Expert Analysis</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Risk management & Position sizing tool</p>
                  </div>

                  <div className="data-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <Wallet size={16} color="var(--primary)" />
                      Trading Capital
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Total Modal (IDR)</label>
                        <input
                          type="number"
                          value={capital}
                          onChange={(e) => setCapital(Number(e.target.value))}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem', fontWeight: 700 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Risk per Trade (%)</label>
                        <input
                          type="number"
                          value={riskPercent}
                          onChange={(e) => setRiskPercent(Number(e.target.value))}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-strong)', fontSize: '0.875rem', fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-app)', borderRadius: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Max Risk Amount</span>
                        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Rp {(capital * riskPercent / 100).toLocaleString('id-ID')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Max Allocation per Stock</span>
                        <span style={{ fontWeight: 700 }}>Rp {(capital * 0.25).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>

                  {selectedStockForAnalysis && (
                    <div className="data-card" style={{ padding: '2rem', marginTop: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Target size={20} color="var(--primary)" />
                            Setup: {selectedStockForAnalysis.ticker}
                          </h3>
                          {tradePlan?.strategy && (
                            <div className={`badge ${tradePlan.strategy === 'HAKA' ? 'badge-rose' : 'badge-cyan'}`} style={{ borderRadius: '4px', textTransform: 'uppercase' }}>
                              Strategy: {tradePlan.strategy}
                            </div>
                          )}
                        </div>
                        <button
                          className="btn-primary"
                          onClick={() => calculateTradePlan(selectedStockForAnalysis)}
                        >
                          Recalculate
                        </button>
                      </div>

                      {tradePlan && (
                        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '1rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Entry Price</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{tradePlan.entry.toLocaleString('id-ID')}</div>
                          </div>
                          <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '1rem', background: 'rgba(244, 63, 94, 0.05)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Stop Loss</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>{tradePlan.sl.toLocaleString('id-ID')}</div>
                          </div>
                          <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '1rem', background: 'rgba(16, 185, 129, 0.05)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Take Profit (1:2)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>{tradePlan.tp.toLocaleString('id-ID')}</div>
                          </div>
                          <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '1rem', background: 'var(--primary-light)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Lots to Buy</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{tradePlan.lots} Lots</div>
                            <div style={{ fontSize: '0.7rem' }}>({tradePlan.lots * 100} shares)</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ width: '400px' }}>
                  {tradePlan ? (
                    <div className="data-card" style={{ padding: '2rem', background: 'var(--text-main)', color: 'white', position: 'sticky', top: '2rem' }}>
                      <h3 style={{ color: 'white', marginBottom: '1.5rem' }}>Trade Summary</h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Investment Value</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>Rp {tradePlan.totalValue.toLocaleString('id-ID')}</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{((tradePlan.totalValue / capital) * 100).toFixed(1)}% of portfolio</div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Max Loss</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fda4af' }}>- Rp {tradePlan.maxLoss.toLocaleString('id-ID')}</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Min Profit</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6ee7b7' }}>+ Rp {tradePlan.potentialProfit.toLocaleString('id-ID')}</div>
                          </div>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                            <ShieldCheck size={14} />
                            <span>Strategy: {tradePlan.strategy === 'HAKA' ? 'Execution HAKA' : 'Execution Antri'}</span>
                          </div>
                          <p style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                            {tradePlan.strategy === 'HAKA'
                              ? 'Volume spike detected. Entry 1 tick above current price for immediate fill.'
                              : 'Normal volume. Entry at nearest MA support for optimal cost.'}
                          </p>
                        </div>

                        <button
                          className="btn-primary"
                          style={{ width: '100%', background: 'white', color: 'var(--text-main)', display: 'flex', justifyContent: 'center' }}
                          onClick={executeTrade}
                        >
                          Execute & Save to Journal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="data-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', border: '2px dashed var(--border)' }}>
                      <LineChart size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                      <p>Select a stock from the Dashboard using "Analyze" to generate a trade setup.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div >
  );
}
