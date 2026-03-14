'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { initializeApp } from 'firebase/app';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
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
import { IDX_TICKERS } from '@/lib/tickers';

// Modular Components
// Modular Components
import { Navigation } from '@/components/Navigation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { ResultGrid } from '@/components/ResultGrid';
import { LoginScreen } from '@/components/LoginScreen';
import { AdminPanel } from '@/components/AdminPanel';
import { WatchlistPanel } from '@/components/WatchlistPanel';
import { TradeAnalysis } from '@/components/TradeAnalysis';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Sparkles, Brain } from 'lucide-react';
import { AIAnalyst } from '@/components/AIAnalyst';

interface StockResult {
  ticker: string;
  price: number;
  volume: number;
  volumeRatio: number;
  isVolumeSpike: boolean;
  isRocket: boolean;
  tightness: number;
  distance: number;
  smaValues: Record<string, number>;
  sparkline: number[];
  bottomType?: string;
  isHammer?: boolean;
  gainFromCross?: number;
  status?: string;
  macdStatus?: string;
  smaFullData?: Record<string, number[]>;
  ohlcData?: { x: number; y: number[] }[];
}

interface WatchlistItem {
  ticker: string;
  entryPrice: number;
  entryDate: string;
}

interface AdminUser {
  id: string;
  password?: string;
  limitType?: 'subscription' | 'quota';
  validUntil?: string;
  quota?: number;
  count?: number;
}

export default function Dashboard() {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserLimitType, setCurrentUserLimitType] = useState<'subscription' | 'quota' | null>(null);
  const [currentUserUsage, setCurrentUserUsage] = useState<number>(0);
  const [currentUserQuota, setCurrentUserQuota] = useState<number>(0);
  const [currentUserValidUntil, setCurrentUserValidUntil] = useState<string>('');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authInitialized, setAuthInitialized] = useState(false);

  // Core Data State
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resultsCache, setResultsCache] = useState<Record<string, StockResult[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('screening_results_cache');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  
  const [activeTab, setActiveTab] = useState<'screener_awan' | 'screener_bottom' | 'screener_turnaround' | 'watchlist' | 'analysis' | 'history' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('active_tab');
      return (saved as any) || 'screener_awan';
    }
    return 'screener_awan';
  });

  // Watchlist & History State
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistData, setWatchlistData] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Admin State
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newLimitType, setNewLimitType] = useState<'subscription' | 'quota'>('subscription');
  const [newLimitValue, setNewLimitValue] = useState(30);

  // Trade Analysis State
  const [capital, setCapital] = useState<number>(10000000); 
  const [riskPercent, setRiskPercent] = useState<number>(2); 
  const [selectedStockForAnalysis, setSelectedStockForAnalysis] = useState<StockResult | null>(null);
  const [tradePlan, setTradePlan] = useState<any>(null);
  const [showAIAnalyst, setShowAIAnalyst] = useState(false);

  // Utility functions
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    console.log(`[Toast] ${type}: ${message}`);
  };

  const getTickSize = (price: number) => {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    return 25;
  };

  // Auth Effects
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        const username = user.email.split('@')[0];
        setCurrentUser(username);
        setIsLoggedIn(true);
      } else {
        setCurrentUser('');
        setIsLoggedIn(false);
      }
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      let email = loginUsername.trim();
      if (!email.includes('@')) email = `${email}@nexus.stock`;
      await signInWithEmailAndPassword(auth, email, loginPassword);
    } catch (err: any) {
      setLoginError(err.code === 'auth/invalid-credential' ? 'Invalid username or password.' : `Login Failed: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setResults([]);
      setWatchlist([]);
      setHistory([]);
    } catch (err) {
      console.error('Failed to logout', err);
    }
  };

  // Sync Logic
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    const settingsDoc = doc(db, `users/${currentUser}/settings/user_settings`);
    const unsubSettings = onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.capital) setCapital(data.capital);
        if (data.riskPercent) setRiskPercent(data.riskPercent);
      }
    });

    const watchlistCol = collection(db, `users/${currentUser}/watchlist`);
    const unsubWatchlist = onSnapshot(watchlistCol, (snapshot) => {
      setWatchlist(snapshot.docs.map(doc => doc.data() as WatchlistItem));
    });

    const historyCol = collection(db, `users/${currentUser}/history`);
    const historyQuery = query(historyCol, orderBy('timestamp', 'desc'));
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    let unsubAdmin = () => { };
    if (currentUser === 'admin') {
      unsubAdmin = onSnapshot(doc(db, 'system/users'), (snapshot) => {
        if (snapshot.exists()) {
          const accounts = snapshot.data().accounts || {};
          setAdminUsers(Object.keys(accounts).map(key => ({ id: key, ...accounts[key] })));
        }
      });
    }

    let unsubLimits = onSnapshot(doc(db, 'system/users'), (snapshot) => {
      if (snapshot.exists() && currentUser !== 'admin') {
        const me = snapshot.data().accounts?.[currentUser];
        if (me) {
          setCurrentUserLimitType(me.limitType || 'subscription');
          setCurrentUserQuota(me.quota || 0);
          setCurrentUserValidUntil(me.validUntil || '');
        }
      }
    });

    return () => { unsubSettings(); unsubWatchlist(); unsubHistory(); unsubAdmin(); unsubLimits(); };
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser === 'admin' || !currentUserLimitType) return;
    const isSub = currentUserLimitType === 'subscription';
    const unsubUsage = onSnapshot(doc(db, `users/${currentUser}/usage/${isSub ? 'daily' : 'total'}`), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (isSub) {
          const today = new Date().toISOString().split('T')[0];
          setCurrentUserUsage(data.date === today ? (data.count || 0) : 0);
        } else {
          setCurrentUserUsage(data.count || 0);
        }
      }
    });
    return () => unsubUsage();
  }, [currentUser, currentUserLimitType]);

  // Strategy Results Sync
  const screeningStrategy = activeTab === 'screener_bottom' ? 'membumi' : activeTab === 'screener_turnaround' ? 'turnaround' : 'diatas_awan';

  useEffect(() => {
    const cachedResults = resultsCache[screeningStrategy] || [];
    setResults(cachedResults);
    setCached(cachedResults.length > 0);

    const unsubResults = onSnapshot(doc(db, 'system', `screening_results_${screeningStrategy}`), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const freshResults = data.results || [];
        setResults(freshResults);
        setResultsCache(prev => ({ ...prev, [screeningStrategy]: freshResults }));
        setCached(true);
        setCacheTimestamp(data.timestamp || Date.now());
      }
    });

    sessionStorage.setItem('active_tab', activeTab);
    return () => unsubResults();
  }, [activeTab, screeningStrategy]);

  useEffect(() => {
    sessionStorage.setItem('screening_results_cache', JSON.stringify(resultsCache));
  }, [resultsCache]);

  // Business Actions
  const calculateTradePlan = (stock: StockResult) => {
    let entry = stock.price;
    let strategy: 'HAKA' | 'ANTRI' = stock.isVolumeSpike ? 'HAKA' : 'ANTRI';
    if (stock.isVolumeSpike) entry = stock.price + getTickSize(stock.price);
    else {
      const mas = Object.values(stock.smaValues).filter(v => v <= stock.price);
      if (mas.length > 0) entry = Math.max(...mas);
    }

    const sl = stock.smaValues['20'] * 0.995;
    const tp = entry + (entry - sl) * 2;
    const riskAmount = capital * (riskPercent / 100);
    const riskPerShare = entry - sl;
    if (riskPerShare <= 0) return;

    let lots = Math.floor(riskAmount / (riskPerShare * 100));
    const maxValue = capital * 0.25;
    if (lots * 100 * entry > maxValue) lots = Math.floor(maxValue / (entry * 100));
    if (lots < 1) lots = 1;

    setTradePlan({
      ticker: stock.ticker, entry, sl, tp, lots,
      totalValue: lots * 100 * entry,
      maxLoss: lots * 100 * (entry - sl),
      potentialProfit: lots * 100 * (tp - entry),
      rrRatio: (tp - entry) / (entry - sl),
      strategy
    });
  };

  const executeTrade = async () => {
    if (!tradePlan || !selectedStockForAnalysis) return;
    try {
      await addDoc(collection(db, `users/${currentUser}/history`), { ...tradePlan, timestamp: new Date().toISOString(), type: 'BUY' });
      await addToWatchlist(selectedStockForAnalysis);
      showToast('Trade executed!', 'success');
      setActiveTab('watchlist');
    } catch (err) { showToast('Failed to execute trade', 'error'); }
  };

  const fetchWatchlistQuotes = async () => {
    if (watchlist.length === 0) return;
    setWatchlistLoading(true);
    try {
      const symbols = watchlist.map(w => w.ticker).join(',');
      const response = await fetch(`/api/watchlist?symbols=${symbols}`);
      const data = await response.json();
      setWatchlistData(data.results);
    } catch (err) { console.error('Failed to fetch quotes'); }
    finally { setWatchlistLoading(false); }
  };

  const addToWatchlist = async (stock: StockResult) => {
    const tickerRef = doc(db, `users/${currentUser}/watchlist/${stock.ticker}`);
    if ((await getDoc(tickerRef)).exists()) return;
    await setDoc(tickerRef, { ticker: stock.ticker, entryPrice: stock.price, entryDate: new Date().toISOString().split('T')[0] });
    showToast(`${stock.ticker} added`, 'success');
  };

  const removeFromWatchlist = async (ticker: string) => {
    await deleteDoc(doc(db, `users/${currentUser}/watchlist/${ticker}`));
  };

  // Admin Actions
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const secondaryApp = initializeApp(auth.app.options, 'SecondaryApp');
      const sAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(sAuth, `${newUsername}@nexus.stock`, newPassword);
      await signOut(sAuth);

      const usersRef = doc(db, 'system/users');
      const accounts = (await getDoc(usersRef)).data()?.accounts || {};
      let validUntil = '', quota = 0;
      if (newLimitType === 'subscription') {
        const d = new Date(); d.setDate(d.getDate() + newLimitValue);
        validUntil = d.toISOString().split('T')[0];
      } else quota = newLimitValue;

      accounts[newUsername] = { password: newPassword, limitType: newLimitType, validUntil, quota };
      await setDoc(usersRef, { accounts }, { merge: true });
      setNewUsername(''); setNewPassword('');
      showToast('User added', 'success');
    } catch (err: any) { showToast('Failed: ' + err.message, 'error'); }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === 'admin') return;
    const accounts = (await getDoc(doc(db, 'system/users'))).data()?.accounts || {};
    delete accounts[username];
    await setDoc(doc(db, 'system/users'), { accounts });
    showToast('User deleted', 'success');
  };

  if (!authInitialized) return <div className="flex h-screen items-center justify-center bg-background"><div className="animate-pulse text-orange-600 font-bold tracking-widest uppercase">System Initializing...</div></div>;

  if (!isLoggedIn) return (
    <LoginScreen 
      loginUsername={loginUsername} setLoginUsername={setLoginUsername}
      loginPassword={loginPassword} setLoginPassword={setLoginPassword}
      loginError={loginError} handleLogin={handleLogin}
    />
  );

  const userUsageInfo = currentUser === 'admin' ? 'Master Access' : 
    currentUserLimitType === 'subscription' ? `${Math.max(0, 3 - currentUserUsage)} Hits Left` :
    `${Math.max(0, currentUserQuota - currentUserUsage)} Quota Left`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader 
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        currentUser={currentUser} userUsageInfo={userUsageInfo}
        onLogout={handleLogout}
      />

      <Navigation 
        activeTab={activeTab} setActiveTab={setActiveTab} 
        isAdmin={currentUser === 'admin'} 
        onLogout={handleLogout} currentUser={currentUser} 
      />
      
      <main className="transition-all pt-24 pb-20 md:pb-10">
        <div className="p-2 md:p-6 max-w-[1600px] mx-auto border-x border-border/20 min-h-screen bg-card/10">
          {activeTab.startsWith('screener') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black tracking-tighter text-foreground font-serif italic text-primary">Market Discovery</h2>
                  <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-50">
                    {activeTab === 'screener_awan' && "Awan Tiered: Emas & Silver (All MAs Breakout)"}
                    {activeTab === 'screener_bottom' && "Bottoming: Reversal Trend (MA 10 & 20 Cross)"}
                    {activeTab === 'screener_turnaround' && "Turnaround: Follow the Trend (Retest MA 20)"}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 border border-border/60 bg-muted/5 text-muted-foreground font-bold text-[8px] uppercase tracking-widest">
                      <RefreshCw className="h-2 w-2 animate-spin opacity-40 text-primary" />
                      Sync: {cacheTimestamp ? new Date(cacheTimestamp).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowAIAnalyst(true)}
                    className="flex items-center gap-2 px-3 py-1.5 border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-black text-[10px] uppercase tracking-widest transition-all group"
                  >
                    <Sparkles className="h-3 w-3 animate-pulse group-hover:scale-110 transition-transform" />
                    AI Analyst
                  </button>
                </div>
              </div>

              <ResultGrid 
                results={results} loading={loading} activeTab={activeTab}
                isSaved={(ticker: string) => !!watchlist.find(w => w.ticker === ticker)}
                onSave={addToWatchlist}
                onAnalyze={(stock: any) => { setSelectedStockForAnalysis(stock); calculateTradePlan(stock); setActiveTab('analysis'); }}
                searchQuery={searchQuery}
              />
            </div>
          )}

          {activeTab === 'watchlist' && (
            <WatchlistPanel 
              watchlist={watchlist} watchlistData={watchlistData} watchlistLoading={watchlistLoading}
              fetchWatchlistQuotes={fetchWatchlistQuotes} removeFromWatchlist={removeFromWatchlist}
            />
          )}

          {activeTab === 'admin' && currentUser === 'admin' && (
            <AdminPanel 
              adminUsers={adminUsers} newUsername={newUsername} setNewUsername={setNewUsername}
              newPassword={newPassword} setNewPassword={setNewPassword}
              newLimitType={newLimitType} setNewLimitType={setNewLimitType}
              newLimitValue={newLimitValue} setNewLimitValue={setNewLimitValue}
              handleAddUser={handleAddUser} handleDeleteUser={handleDeleteUser}
            />
          )}

          {activeTab === 'analysis' && (
            <TradeAnalysis 
              capital={capital} setCapital={setCapital}
              riskPercent={riskPercent} setRiskPercent={setRiskPercent}
              selectedStockForAnalysis={selectedStockForAnalysis}
              tradePlan={tradePlan} calculateTradePlan={calculateTradePlan}
              executeTrade={executeTrade}
            />
          )}
        </div>
      </main>

      {showAIAnalyst && (
        <AIAnalyst 
          results={results} 
          activeTab={activeTab} 
          onClose={() => setShowAIAnalyst(false)} 
        />
      )}
    </div>
  );
}
