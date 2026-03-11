'use client';

import { useState, useEffect, useRef } from 'react';
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
  Target,
  AlertTriangle,
  History,
  Users,
  Wallet
} from 'lucide-react';
import Sparkline from '@/components/Sparkline';
import { IDX_TICKERS } from '@/lib/tickers';

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
  bottomType?: string;
  isHammer?: boolean;
  gainFromCross?: number;
  status?: string;
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
  count?: number; // optionally track their daily count
}

function AdminUserRow({ u, onDelete }: { u: AdminUser, onDelete: (username: string) => void }) {
  const [usage, setUsage] = useState<number>(0);

  useEffect(() => {
    if (u.id === 'admin') return;
    const isSub = (!u.limitType || u.limitType === 'subscription');
    const usageDocRef = doc(db, `users/${u.id}/usage/${isSub ? 'daily' : 'total'}`);
    const unsub = onSnapshot(usageDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (isSub) {
          const today = new Date().toISOString().split('T')[0];
          setUsage(data.date === today ? (data.count || 0) : 0);
        } else {
          setUsage(data.count || 0);
        }
      }
    });
    return () => unsub();
  }, [u]);

  const limitType = u.limitType || 'subscription';
  const isExpired = limitType === 'subscription' && new Date(u.validUntil || '') < new Date();

  let daysLeftText = '';
  if (limitType === 'subscription' && u.validUntil) {
    const diffTime = new Date(u.validUntil).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysLeftText = diffDays > 0 ? `${diffDays} days left` : 'Expired';
  }

  return (
    <tr key={u.id}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase' }}>
            {u.id.substring(0, 2)}
          </div>
          <div style={{ fontWeight: 700 }}>{u.id}</div>
        </div>
      </td>
      <td style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>
        {u.id === 'admin' ? '********' : u.password}
      </td>
      <td>{limitType === 'quota' ? 'Fixed Quota' : 'Time-based'}</td>
      <td>
        {u.id === 'admin' ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unlimited</span>
        ) : limitType === 'quota' ? (
          <div style={{ fontSize: '0.75rem' }}>
            Used: <strong>{usage}</strong> / {u.quota || 0}
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem' }}>
            <span style={{ fontWeight: 600 }}>{daysLeftText}</span> <br />
            <span style={{ color: 'var(--text-muted)' }}>(Today: {usage}/3 screened)</span>
          </div>
        )}
      </td>
      <td>
        {u.id === 'admin' ? (
          <span className="badge badge-indigo">System Admin</span>
        ) : limitType === 'quota' ? (
          <span className="badge badge-cyan">Quota Mode</span>
        ) : isExpired ? (
          <span className="badge badge-rose">Expired</span>
        ) : (
          <span className="badge badge-cyan">Active</span>
        )}
      </td>
      <td>
        {u.id !== 'admin' && (
          <button
            onClick={() => onDelete(u.id)}
            style={{ border: 'none', background: 'transparent', color: 'var(--rose)', cursor: 'pointer', padding: '0.25rem' }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function Home() {
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

  // Toast & Modal UI State
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; submessage?: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        // user.email will be `{username}@nexus.stock`
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
      // If user typed a raw username, append our custom domain.
      // If they typed an email (like admin@gmail.com), use it directly.
      if (!email.includes('@')) {
        email = `${email}@nexus.stock`;
      }

      await signInWithEmailAndPassword(auth, email, loginPassword);
      setLoginError('');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setLoginError('Invalid username or password.');
      } else {
        setLoginError(`Login Failed: ${err.message || err.code}`);
      }
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

  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [sortBy, setSortBy] = useState<string>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Watchlist State
  const [activeTab, setActiveTab] = useState<'screener_awan' | 'screener_swing' | 'screener_turnaround' | 'watchlist' | 'analysis' | 'history' | 'admin'>('screener_awan');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistData, setWatchlistData] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistSortBy, setWatchlistSortBy] = useState<string>('entryDate');
  const [watchlistSortOrder, setWatchlistSortOrder] = useState<'asc' | 'desc'>('desc');

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [historySortBy, setHistorySortBy] = useState<string>('timestamp');
  const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc'>('desc');

  // Admin State
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminSortBy, setAdminSortBy] = useState<string>('id');
  const [adminSortOrder, setAdminSortOrder] = useState<'asc' | 'desc'>('asc');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newLimitType, setNewLimitType] = useState<'subscription' | 'quota'>('subscription');
  const [newLimitValue, setNewLimitValue] = useState(30);

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
    if (!isLoggedIn || !currentUser) return;

    // Sync Settings (Capital, Risk)
    const settingsDoc = doc(db, `users/${currentUser}/settings/user_settings`);
    const unsubscribeSettings = onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.capital) setCapital(data.capital);
        if (data.riskPercent) setRiskPercent(data.riskPercent);
      }
    });

    // Sync Watchlist
    const watchlistCol = collection(db, `users/${currentUser}/watchlist`);
    const unsubscribeWatchlist = onSnapshot(watchlistCol, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data() as WatchlistItem);
      setWatchlist(items);
    });

    // Sync History
    const historyCol = collection(db, `users/${currentUser}/history`);
    const historyQuery = query(historyCol, orderBy('timestamp', 'desc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(items);
    });

    // Sync Admin Users if currentUser is admin
    let unsubscribeAdmin = () => { };
    if (currentUser === 'admin') {
      const usersDoc = doc(db, 'system/users');
      unsubscribeAdmin = onSnapshot(usersDoc, (snapshot) => {
        if (snapshot.exists()) {
          const accounts = snapshot.data().accounts || {};
          const mappedUsers = Object.keys(accounts).map(key => ({
            id: key,
            ...accounts[key]
          }));
          setAdminUsers(mappedUsers);
        }
      });
    }

    // Sync Current User Data (to check if they have a subscription)
    let unsubscribeCurrentUser = () => { };
    if (currentUser && currentUser !== 'admin') {
      const myDoc = doc(db, 'system/users');
      unsubscribeCurrentUser = onSnapshot(myDoc, (snapshot) => {
        if (snapshot.exists()) {
          const accounts = snapshot.data().accounts || {};
          const me = accounts[currentUser];
          if (me) {
            setCurrentUserLimitType(me.limitType || 'subscription');
            setCurrentUserQuota(me.quota || 0);
            setCurrentUserValidUntil(me.validUntil || '');
          }
        }
      });
    } else {
      setCurrentUserLimitType(null); // admin or logged out
      setCurrentUserUsage(0);
    }

    return () => {
      unsubscribeSettings();
      unsubscribeWatchlist();
      unsubscribeHistory();
      unsubscribeAdmin();
      unsubscribeCurrentUser();
    };
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser === 'admin' || !currentUserLimitType) return;

    const isSub = currentUserLimitType === 'subscription';
    const usageDocRef = doc(db, `users/${currentUser}/usage/${isSub ? 'daily' : 'total'}`);

    const unsubUsage = onSnapshot(usageDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (isSub) {
          const today = new Date().toISOString().split('T')[0];
          setCurrentUserUsage(data.date === today ? (data.count || 0) : 0);
        } else {
          setCurrentUserUsage(data.count || 0);
        }
      } else {
        setCurrentUserUsage(0);
      }
    });
    return () => unsubUsage();
  }, [currentUser, currentUserLimitType]);

  // Save Settings to Firestore when changed
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    const saveSettings = async () => {
      await setDoc(doc(db, `users/${currentUser}/settings/user_settings`), {
        capital,
        riskPercent
      }, { merge: true });
    };
    saveSettings();
  }, [capital, riskPercent, isLoggedIn, currentUser]);

  // Fetch quotes when watchlist changes or tab switches
  useEffect(() => {
    if (watchlist.length > 0 && activeTab === 'watchlist') {
      fetchWatchlistQuotes();
    }
  }, [watchlist, activeTab]);

  const screeningStrategy = activeTab === 'screener_swing' ? 'swing_mingguan' : activeTab === 'screener_turnaround' ? 'turnaround' : 'diatas_awan';

  useEffect(() => {
    setResults([]);
    setCached(false);
  }, [activeTab]);

  const calculateTradePlan = (stock: StockResult) => {
    let entry = stock.price;
    let strategy: 'HAKA' | 'ANTRI' = 'ANTRI';

    if (stock.isVolumeSpike) {
      entry = stock.price + getTickSize(stock.price);
      strategy = 'HAKA';
    } else {
      // Find nearest MA below price (MA 3, 5, 20, 50, 100, 200)
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
    if (!isLoggedIn || !currentUser) return;

    if (currentUser !== 'admin') {
      try {
        const usersRef = doc(db, 'system/users');
        const userSnap = await getDoc(usersRef);
        let me: any = null;
        if (userSnap.exists()) {
          const accounts = userSnap.data().accounts;
          me = accounts[currentUser];
        }

        if (!me) {
          showToast('User account not found or has been disabled.', 'error');
          return;
        }

        const limitType = me.limitType || 'subscription';

        if (limitType === 'subscription') {
          if (new Date(me.validUntil) < new Date()) {
            showToast('Trial/Subscription has expired. Please contact admin for monthly subscription payment.', 'error');
            return;
          }

          const today = new Date().toISOString().split('T')[0];
          const usageRef = doc(db, `users/${currentUser}/usage/daily`);
          const usageSnap = await getDoc(usageRef);

          let currentUses = 0;
          if (usageSnap.exists()) {
            const data = usageSnap.data();
            if (data.date === today) {
              currentUses = data.count || 0;
            }
          }

          if (currentUses >= 3) {
            showToast('Daily limit reached! You can only screen 3 times per day.', 'error');
            return;
          }

          await setDoc(usageRef, { date: today, count: currentUses + 1 });
        } else if (limitType === 'quota') {
          const usageRef = doc(db, `users/${currentUser}/usage/total`);
          const usageSnap = await getDoc(usageRef);

          let currentUses = 0;
          if (usageSnap.exists()) {
            currentUses = usageSnap.data().count || 0;
          }

          const maxQuota = me.quota || 0;
          if (currentUses >= maxQuota) {
            showToast(`Total screening quota (${maxQuota}) reached! Please contact admin to add more screenings.`, 'error');
            return;
          }

          await setDoc(usageRef, { count: currentUses + 1 });
        }
      } catch (err) {
        showToast('Failed to verify subscription status', 'error');
        return;
      }
    }

    setLoading(true);
    setError(null);
    const total = IDX_TICKERS.length;
    setProgress({ current: 0, total });

    try {
      if (!force) {
        // First, check for cache
        const cacheRes = await fetch(`/api/screen?strategy=${screeningStrategy}`);
        const cacheData = await cacheRes.json();
        if (cacheData.cached && cacheData.results.length > 0) {
          setResults(cacheData.results);
          setCached(true);
          setCacheTimestamp(cacheData.timestamp);
          setLoading(false);
          setProgress(null);
          return;
        }
      }

      setCached(false);
      setResults([]);
      const allResults: StockResult[] = [];
      const batchSize = 5;

      for (let i = 0; i < total; i += batchSize) {
        const batch = IDX_TICKERS.slice(i, i + batchSize);
        setProgress({ current: i, total });

        const response = await fetch('/api/screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers: batch, forceRefresh: force, strategy: screeningStrategy })
        });

        if (!response.ok) throw new Error('Failed to fetch batch');

        const data = await response.json();
        if (data.results) {
          allResults.push(...data.results);
          setResults([...allResults]); // Update UI incrementally
        }

        // Delay between batches to avoid rate limits
        if (i + batchSize < total) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setProgress({ current: total, total });

      // Save to Global Cache
      if (allResults.length > 0) {
        const ts = Date.now();
        await fetch('/api/screen', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: allResults, strategy: screeningStrategy })
        });
        setCacheTimestamp(ts);
        setCached(true);
      }
    } catch (err) {
      setError('An error occurred during screening');
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(null), 2000);
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
    const tickerRef = doc(db, `users/${currentUser}/watchlist/${stock.ticker}`);
    const snapshot = await getDoc(tickerRef);
    if (snapshot.exists()) return;

    const newItem = {
      ticker: stock.ticker,
      entryPrice: stock.price,
      entryDate: new Date().toISOString().split('T')[0]
    };
    await setDoc(tickerRef, newItem);
    showToast(`${stock.ticker} added to watchlist at ${stock.price}`, 'success');
  };

  const removeFromWatchlist = async (ticker: string) => {
    await deleteDoc(doc(db, `users/${currentUser}/watchlist/${ticker}`));
  };

  const executeTrade = async () => {
    if (!tradePlan || !selectedStockForAnalysis) return;

    try {
      // 1. Save to History
      await addDoc(collection(db, `users/${currentUser}/history`), {
        ...tradePlan,
        timestamp: new Date().toISOString(),
        type: 'BUY'
      });

      // 2. Add to Watchlist if not already there
      await addToWatchlist(selectedStockForAnalysis);

      showToast('Trade executed and recorded in History!', 'success');
      setActiveTab('watchlist');
    } catch (err) {
      showToast('Failed to execute trade', 'error');
    }
  };

  // Admin Actions
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;

    try {
      // 1. Create a secondary Firebase App specifically to register the new user without logging out Admin
      const secondaryApp = initializeApp(auth.app.options, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);

      const email = `${newUsername}@nexus.stock`;
      await createUserWithEmailAndPassword(secondaryAuth, email, newPassword);
      // Secondary auth is done, we can sign it out to clean up
      await signOut(secondaryAuth);

      // 2. Set limits and quota parameters on root App's Firestore
      const usersRef = doc(db, 'system/users');
      const docSnap = await getDoc(usersRef);
      let accounts: Record<string, Omit<AdminUser, 'id'>> = {};
      if (docSnap.exists()) accounts = docSnap.data().accounts || {};

      let validUntil = '';
      let quota = 0;

      if (newLimitType === 'subscription') {
        const validUntilDate = new Date();
        validUntilDate.setDate(validUntilDate.getDate() + newLimitValue);
        validUntil = validUntilDate.toISOString().split('T')[0];
      } else {
        quota = newLimitValue;
      }

      accounts[newUsername] = {
        password: newPassword,
        limitType: newLimitType,
        validUntil,
        quota
      };

      await setDoc(usersRef, { accounts }, { merge: true });
      setNewUsername('');
      setNewPassword('');
      showToast(`Firebase User ${newUsername} added successfully!`, 'success');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        showToast('This username is already taken in Firebase Auth.', 'error');
      } else {
        showToast('Failed to add user: ' + err.message, 'error');
      }
    }
  };

  const handleDeleteUser = async (username: string, force = false) => {
    if (username === 'admin') return showToast('Cannot delete admin', 'error');

    if (!force) {
      setConfirmModal({
        isOpen: true,
        title: `Delete User ${username}?`,
        message: `Are you sure you want to permanently delete user ${username}?`,
        submessage: `Note: The user's Firestore limits will be deleted, but you must manually delete the Firebase Auth account in the Firebase Console if you wish to wipe them entirely.`,
        onConfirm: () => {
          setConfirmModal(null);
          handleDeleteUser(username, true);
        }
      });
      return;
    }

    try {
      const usersRef = doc(db, 'system/users');
      const docSnap = await getDoc(usersRef);
      if (docSnap.exists()) {
        const accounts = docSnap.data().accounts;
        delete accounts[username];
        await setDoc(usersRef, { accounts });
        showToast(`User ${username} deleted successfully`, 'success');
      }
    } catch (err) {
      showToast('Failed to delete user data', 'error');
    }
  };

  useEffect(() => {
    // We no longer perform screening automatically on login
    // User must click the "Refresh Screen" button manually
  }, [isLoggedIn]);

  const SortIcon = ({ active, order }: { active: boolean, order: 'asc'|'desc' }) => {
    if (!active) return <span style={{opacity: 0.3, marginLeft: 4}}><TrendingUp size={12} /></span>;
    return <span style={{marginLeft: 4, color: 'var(--primary)'}}>{order === 'asc' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}</span>;
  };

  const handleSort = (key: string, currentSortBy: string, currentSortOrder: 'asc'|'desc', setSort: any, setOrder: any) => {
    if (currentSortBy === key) {
      setOrder(currentSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key);
      setOrder('desc');
    }
  };

  const sortedResults = [...results]
    .filter(r => r.ticker.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let valA: any, valB: any;
      if (sortBy === 'volume') {
        valA = a.volumeRatio || 0;
        valB = b.volumeRatio || 0;
      } else if (sortBy === 'distance') {
        valA = a.distance || 0;
        valB = b.distance || 0;
      } else if (sortBy === 'tightness') {
        valA = a.tightness || 0;
        valB = b.tightness || 0;
      } else if (sortBy === 'price') {
        valA = a.price;
        valB = b.price;
      } else if (sortBy === 'crossoverGain') {
        valA = a.gainFromCross || 0;
        valB = b.gainFromCross || 0;
      } else {
        valA = a.ticker;
        valB = b.ticker;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const sortedWatchlist = [...watchlist].sort((a, b) => {
    let valA: any, valB: any;
    const dataA = watchlistData.find(d => d.ticker === a.ticker);
    const dataB = watchlistData.find(d => d.ticker === b.ticker);
    const cpA = dataA ? dataA.currentPrice : a.entryPrice;
    const cpB = dataB ? dataB.currentPrice : b.entryPrice;
    
    if (watchlistSortBy === 'ticker') { valA = a.ticker; valB = b.ticker; }
    else if (watchlistSortBy === 'entryPrice') { valA = a.entryPrice; valB = b.entryPrice; }
    else if (watchlistSortBy === 'currentPrice') { valA = cpA; valB = cpB; }
    else if (watchlistSortBy === 'pl') { valA = ((cpA - a.entryPrice) / a.entryPrice); valB = ((cpB - b.entryPrice) / b.entryPrice); }
    else { valA = new Date(a.entryDate).getTime(); valB = new Date(b.entryDate).getTime(); }

    if (valA < valB) return watchlistSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return watchlistSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedHistory = [...history].sort((a, b) => {
    let valA: any, valB: any;
    if (historySortBy === 'ticker') { valA = a.ticker; valB = b.ticker; }
    else if (historySortBy === 'type') { valA = a.type; valB = b.type; }
    else if (historySortBy === 'entry') { valA = a.entry; valB = b.entry; }
    else if (historySortBy === 'lots') { valA = a.lots; valB = b.lots; }
    else if (historySortBy === 'totalValue') { valA = a.totalValue; valB = b.totalValue; }
    else if (historySortBy === 'rrRatio') { valA = a.rrRatio; valB = b.rrRatio; }
    else { valA = new Date(a.timestamp).getTime(); valB = new Date(b.timestamp).getTime(); }

    if (valA < valB) return historySortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return historySortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedAdminUsers = [...adminUsers].sort((a, b) => {
    let valA: any, valB: any;
    if (adminSortBy === 'limitType') { valA = a.limitType; valB = b.limitType; }
    else if (adminSortBy === 'quota') { valA = a.quota; valB = b.quota; }
    else if (adminSortBy === 'validUntil') { valA = new Date(a.validUntil || 0).getTime(); valB = new Date(b.validUntil || 0).getTime(); }
    else { valA = a.id; valB = b.id; }

    if (valA < valB) return adminSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return adminSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const spikeCount = results.filter(r => r.isVolumeSpike).length;
  const tightCount = results.filter(r => r.tightness < 0.05).length;

  if (!authInitialized) {
    return <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-dots">Loading App</div>
    </div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
        <div className="data-card" style={{ padding: '2.5rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <img
              src="https://ik.imagekit.io/gambarid/Carisaham/WhatsApp%20Image%202026-03-10%20at%2004.00.08.jpeg"
              alt="carisaham.net logo"
              style={{ width: '80px', height: '80px', borderRadius: '1.25rem', objectFit: 'cover', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.15)' }}
            />
            <span style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--primary)', fontFamily: "'Playfair Display', serif" }}>carisaham.net</span>
          </div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Login to Access Platform</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                placeholder="Enter username"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                placeholder="Enter password"
                required
              />
            </div>
            {loginError && <div style={{ color: 'var(--rose)', fontSize: '0.75rem', textAlign: 'center' }}>{loginError}</div>}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.875rem', marginTop: '0.5rem', justifyContent: 'center', fontSize: '0.875rem' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <img
            src="https://ik.imagekit.io/gambarid/Carisaham/WhatsApp%20Image%202026-03-10%20at%2004.00.08.jpeg"
            alt="Logo"
            style={{ width: '32px', height: '32px', borderRadius: '0.5rem', objectFit: 'cover' }}
          />
          <span>carisaham.net</span>
        </div>

        <nav className="nav-section">
          <div className="nav-label">General</div>
          <button
            onClick={() => setActiveTab('screener_awan')}
            className={`nav-item ${activeTab === 'screener_awan' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <Rocket size={20} />
            <span>Screener - Diatas Awan</span>
          </button>
          <button
            onClick={() => setActiveTab('screener_swing')}
            className={`nav-item ${activeTab === 'screener_swing' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <LayoutDashboard size={20} />
            <span>Screener - Swing Mingguan</span>
          </button>
          <button
            onClick={() => setActiveTab('screener_turnaround')}
            className={`nav-item ${activeTab === 'screener_turnaround' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <TrendingUp size={20} />
            <span>Screener - Turnaround</span>
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

        {currentUser === 'admin' && (
          <nav className="nav-section" style={{ marginTop: '2rem' }}>
            <div className="nav-label">Administration</div>
            <button
              onClick={() => setActiveTab('admin')}
              className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <Users size={20} />
              <span>User Panel</span>
            </button>
          </nav>
        )}
        {/* ... rest of sidebar ... */}
      </aside>

      {/* Main Content */}
      <main className="main-wrapper">
        <header className="top-bar">
          <div className="search-bar">
            <Search size={18} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Search ticker... (⌘ + F)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
            <Bell size={18} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{currentUser}</div>
                <div style={{ fontSize: '0.65rem', textTransform: 'capitalize' }}>
                  {currentUser === 'admin' ? 'Administrator' :
                    currentUserLimitType === 'subscription' ? (
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {Math.max(0, 3 - currentUserUsage)} Daily left
                      </span>
                    ) : currentUserLimitType === 'quota' ? (
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {Math.max(0, currentUserQuota - currentUserUsage)} Quota left
                      </span>
                    ) : 'Trader'
                  }
                </div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase' }}>{currentUser.substring(0, 2)}</div>
            </div>
            <button onClick={handleLogout} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-dim)', padding: '0.25rem' }}>
              <Settings size={18} /> {/* Using an icon as a proxy for logout to keep it clean, or could use an explicit logout if preferred. Just using settings icon for now */}
              <span style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>Logout</span>
            </button>
          </div>
        </header>

        <section className="content-body">
          {activeTab === 'screener_awan' || activeTab === 'screener_swing' || activeTab === 'screener_turnaround' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem' }}>Dashboard Overview</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    {activeTab === 'screener_awan' && "Market Screening: Price > SMAs + Volume Spike + Max 5% gain"}
                    {activeTab === 'screener_swing' && "Market Screening: Daily MACD Golden Cross & Breakout MA 20/10 (max 15 days ago, < 5% cross gain, < 5% daily gain)"}
                    {activeTab === 'screener_turnaround' && "Market Screening: Monthly MACD Golden Cross + Volume Accumulation + Breakout"}
                    {cached && cacheTimestamp && (
                      <span style={{ marginLeft: '1rem', color: 'var(--primary)', fontWeight: 600 }}>
                        • Last Scan: {new Date(cacheTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
                <button className="btn-primary" onClick={() => performScreening(true)} disabled={loading}>
                  {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="loading-dots">Screening</span>
                      {progress && (
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                          {progress.current} / {progress.total}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      <span>Refresh Screen</span>
                    </>
                  )}
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Matches</div>
                  <div className="stat-value">{results.length}</div>
                </div>

                {(currentUser === 'admin' || currentUserLimitType === 'subscription') && activeTab === 'screener_awan' && (
                  <>
                    <div className="stat-card">
                      <div className="stat-label">Super Tight MAs</div>
                      <div className="stat-value" style={{ color: 'var(--success)' }}>{tightCount}</div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-label">Rocket Spikes</div>
                      <div className="stat-value" style={{ color: 'var(--accent)' }}>{spikeCount}</div>
                    </div>
                  </>
                )}
              </div>

              <div className="data-card">
                <div className="card-header">
                  <h3 className="card-title">List of Screened Stocks</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {cached && <div className="badge badge-indigo">Cached Data (1h)</div>}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }} className="mobile-table-cards">
                  <table style={{ minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('ticker', sortBy, sortOrder, setSortBy, setSortOrder)} style={{cursor: 'pointer'}}>
                          Ticker <SortIcon active={sortBy === 'ticker'} order={sortOrder} />
                        </th>
                        <th onClick={() => handleSort('price', sortBy, sortOrder, setSortBy, setSortOrder)} style={{cursor: 'pointer'}}>
                          Market Price <SortIcon active={sortBy === 'price'} order={sortOrder} />
                        </th>
                        {(currentUser === 'admin' || currentUserLimitType === 'subscription') && (
                          <>
                            {activeTab !== 'screener_swing' && (
                              <th onClick={() => handleSort('volume', sortBy, sortOrder, setSortBy, setSortOrder)} style={{cursor: 'pointer'}}>
                                Ratio Volume <SortIcon active={sortBy === 'volume'} order={sortOrder} />
                              </th>
                            )}
                            {activeTab === 'screener_awan' && (
                              <>
                                <th>Status</th>
                                <th onClick={() => handleSort('tightness', sortBy, sortOrder, setSortBy, setSortOrder)} style={{cursor: 'pointer'}}>
                                  MA Tightness <SortIcon active={sortBy === 'tightness'} order={sortOrder} />
                                </th>
                                <th onClick={() => handleSort('distance', sortBy, sortOrder, setSortBy, setSortOrder)} style={{cursor: 'pointer'}}>
                                  MA Distance <SortIcon active={sortBy === 'distance'} order={sortOrder} />
                                </th>
                              </>
                            )}
                            {activeTab === 'screener_swing' && (
                              <th onClick={() => handleSort('crossoverGain', sortBy, sortOrder, setSortBy, setSortOrder)} style={{cursor: 'pointer'}}>
                                Crossover Gain <SortIcon active={sortBy === 'crossoverGain'} order={sortOrder} />
                              </th>
                            )}
                            <th>20D Evolution</th>
                          </>
                        )}
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={`skeleton-${i}`}>
                            <td data-label="Ticker">
                              <div className="ticker-cell">
                                <div className="skeleton skeleton-circle" />
                                <div style={{ flex: 1 }}>
                                  <div className="skeleton" style={{ width: '60%', marginBottom: '0.25rem' }} />
                                  <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                                </div>
                              </div>
                            </td>
                            <td data-label="Price"><div className="skeleton" style={{ width: '50px' }} /></td>
                            <td data-label="Vol"><div className="skeleton" style={{ width: '40px' }} /></td>
                            <td data-label="Tight"><div className="skeleton" style={{ width: '60px' }} /></td>
                            <td data-label="Dist"><div className="skeleton" style={{ width: '50px' }} /></td>
                            <td data-label="Spark"><div className="skeleton" style={{ width: '100px', height: '30px' }} /></td>
                            <td data-label="Action"><div className="skeleton" style={{ width: '80px', height: '30px' }} /></td>
                          </tr>
                        ))
                      ) : sortedResults.length > 0 ? (
                        sortedResults.map((stock) => (
                          <tr key={stock.ticker}>
                            <td data-label="Ticker">
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
                            <td data-label="Market Price">
                              <div style={{ fontWeight: 700 }}>{stock.price.toLocaleString('id-ID')}</div>
                            </td>
                            {(currentUser === 'admin' || currentUserLimitType === 'subscription') && (
                              <>
                                {activeTab !== 'screener_swing' && (
                                  <td data-label="Ratio Volume">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {stock.isVolumeSpike ? (
                                        <span style={{ fontWeight: 800, color: 'var(--accent)' }}>Boom 🚀</span>
                                      ) : (
                                        <span style={{ fontWeight: 600 }}>{(stock.volumeRatio || 0).toFixed(1)}x</span>
                                      )}
                                    </div>
                                  </td>
                                )}
                                {activeTab === 'screener_awan' && (
                                  <>
                                    <td data-label="Status">
                                      {stock.status && (
                                        <span className={`badge ${stock.status === 'Super Ketat' ? 'badge-amber' : 'badge-emerald'}`} style={{ fontWeight: 800 }}>
                                          {stock.status}
                                        </span>
                                      )}
                                    </td>
                                    <td data-label="MA Tightness">
                                      <span className={`badge ${(stock.tightness || 0) < 0.1 ? 'badge-cyan' : ''}`}>
                                        {((stock.tightness || 0) * 100).toFixed(1)}%
                                      </span>
                                    </td>
                                    <td data-label="MA Distance">
                                      <span className="badge badge-indigo" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                                        +{((stock.distance || 0) * 100).toFixed(2)}%
                                      </span>
                                    </td>
                                  </>
                                )}
                                {activeTab === 'screener_swing' && (
                                  <td data-label="Crossover Gain">
                                    <span className="badge badge-indigo" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                                      {stock.gainFromCross !== undefined ? `+${stock.gainFromCross.toFixed(2)}%` : '-'}
                                    </span>
                                  </td>
                                )}
                                <td data-label="20D Evolution">
                                  <Sparkline data={stock.sparkline} color={(stock.distance || 0) > 0 || (stock.gainFromCross !== undefined && stock.gainFromCross > 0) ? '#6366f1' : '#f43f5e'} />
                                </td>
                              </>
                            )}
                            <td data-label="Action">
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

                <div style={{ overflowX: 'auto' }} className="mobile-table-cards">
                  {watchlist.length > 0 ? (
                    <table style={{ minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th onClick={() => handleSort('ticker', watchlistSortBy, watchlistSortOrder, setWatchlistSortBy, setWatchlistSortOrder)} style={{cursor: 'pointer'}}>
                            Ticker <SortIcon active={watchlistSortBy === 'ticker'} order={watchlistSortOrder} />
                          </th>
                          <th onClick={() => handleSort('entryPrice', watchlistSortBy, watchlistSortOrder, setWatchlistSortBy, setWatchlistSortOrder)} style={{cursor: 'pointer'}}>
                            Entry Price (Open) <SortIcon active={watchlistSortBy === 'entryPrice'} order={watchlistSortOrder} />
                          </th>
                          <th onClick={() => handleSort('currentPrice', watchlistSortBy, watchlistSortOrder, setWatchlistSortBy, setWatchlistSortOrder)} style={{cursor: 'pointer'}}>
                            Current Price (Close) <SortIcon active={watchlistSortBy === 'currentPrice'} order={watchlistSortOrder} />
                          </th>
                          <th onClick={() => handleSort('pl', watchlistSortBy, watchlistSortOrder, setWatchlistSortBy, setWatchlistSortOrder)} style={{cursor: 'pointer'}}>
                            Profit / Loss <SortIcon active={watchlistSortBy === 'pl'} order={watchlistSortOrder} />
                          </th>
                          <th onClick={() => handleSort('entryDate', watchlistSortBy, watchlistSortOrder, setWatchlistSortBy, setWatchlistSortOrder)} style={{cursor: 'pointer'}}>
                            Added Date <SortIcon active={watchlistSortBy === 'entryDate'} order={watchlistSortOrder} />
                          </th>
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
                              <td data-label="Ticker">
                                <div className="ticker-cell">
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                    {item.ticker.substring(0, 2)}
                                  </div>
                                  <div className="ticker-name">{item.ticker}</div>
                                </div>
                              </td>
                              <td data-label="Entry Price">{item.entryPrice.toLocaleString('id-ID')}</td>
                              <td data-label="Current Price">
                                {watchlistLoading ? <div className="skeleton" style={{ width: '40px' }} /> : (
                                  <div style={{ fontWeight: 700 }}>{currentPrice.toLocaleString('id-ID')}</div>
                                )}
                              </td>
                              <td data-label="Profit / Loss">
                                <span className={`badge ${pl >= 0 ? 'badge-cyan' : 'badge-rose'}`} style={{ fontWeight: 800 }}>
                                  {pl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {pl.toFixed(2)}%
                                </span>
                              </td>
                              <td data-label="Added Date">{item.entryDate}</td>
                              <td data-label="Action">
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
                <div style={{ overflowX: 'auto' }} className="mobile-table-cards">
                  {history.length > 0 ? (
                    <table style={{ minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th onClick={() => handleSort('timestamp', historySortBy, historySortOrder, setHistorySortBy, setHistorySortOrder)} style={{cursor: 'pointer'}}>
                            Date <SortIcon active={historySortBy === 'timestamp'} order={historySortOrder} />
                          </th>
                          <th onClick={() => handleSort('ticker', historySortBy, historySortOrder, setHistorySortBy, setHistorySortOrder)} style={{cursor: 'pointer'}}>
                            Ticker <SortIcon active={historySortBy === 'ticker'} order={historySortOrder} />
                          </th>
                          <th onClick={() => handleSort('type', historySortBy, historySortOrder, setHistorySortBy, setHistorySortOrder)} style={{cursor: 'pointer'}}>
                            Type <SortIcon active={historySortBy === 'type'} order={historySortOrder} />
                          </th>
                          <th onClick={() => handleSort('entry', historySortBy, historySortOrder, setHistorySortBy, setHistorySortOrder)} style={{cursor: 'pointer'}}>
                            Entry <SortIcon active={historySortBy === 'entry'} order={historySortOrder} />
                          </th>
                          <th onClick={() => handleSort('lots', historySortBy, historySortOrder, setHistorySortBy, setHistorySortOrder)} style={{cursor: 'pointer'}}>
                            Lots <SortIcon active={historySortBy === 'lots'} order={historySortOrder} />
                          </th>
                          <th onClick={() => handleSort('totalValue', historySortBy, historySortOrder, setHistorySortBy, setHistorySortOrder)} style={{cursor: 'pointer'}}>
                            Total Value <SortIcon active={historySortBy === 'totalValue'} order={historySortOrder} />
                          </th>
                          <th>SL / TP</th>
                          <th onClick={() => handleSort('rrRatio', historySortBy, historySortOrder, setHistorySortBy, setHistorySortOrder)} style={{cursor: 'pointer'}}>
                            R:R <SortIcon active={historySortBy === 'rrRatio'} order={historySortOrder} />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((record) => (
                          <tr key={record.id}>
                            <td data-label="Date">{new Date(record.timestamp).toLocaleString('id-ID')}</td>
                            <td data-label="Ticker">
                              <div style={{ fontWeight: 700 }}>{record.ticker}</div>
                            </td>
                            <td data-label="Type">
                              <span className="badge badge-indigo">{record.type}</span>
                            </td>
                            <td data-label="Entry">{record.entry.toLocaleString('id-ID')}</td>
                            <td data-label="Lots">{record.lots}</td>
                            <td data-label="Total Value">Rp {record.totalValue.toLocaleString('id-ID')}</td>
                            <td data-label="SL / TP">
                              <div style={{ fontSize: '0.75rem' }}>
                                <div style={{ color: 'var(--accent)' }}>SL: {record.sl.toLocaleString('id-ID')}</div>
                                <div style={{ color: 'var(--success)' }}>TP: {record.tp.toLocaleString('id-ID')}</div>
                              </div>
                            </td>
                            <td data-label="R:R">{record.rrRatio?.toFixed(1)}</td>
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
          ) : activeTab === 'admin' && currentUser === 'admin' ? (
            <>
              {/* Admin Panel View */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem' }}>User Administration</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Manage trader accounts and subscription trials</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                {/* Form Add User */}
                <div className="data-card" style={{ padding: '1.5rem', height: 'fit-content' }}>
                  <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>Create New Account</h3>
                  <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Username</label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                        placeholder="e.g. joni_trader"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Password</label>
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                        placeholder="Secure password"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Limit Type</label>
                      <select
                        value={newLimitType}
                        onChange={(e) => setNewLimitType(e.target.value as 'subscription' | 'quota')}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                      >
                        <option value="subscription">Time-based Subscription</option>
                        <option value="quota">Fixed Screening Quota</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                        {newLimitType === 'subscription' ? 'Valid For (Days)' : 'Total Allowed Screenings'}
                      </label>
                      <input
                        type="number"
                        value={newLimitValue}
                        onChange={(e) => setNewLimitValue(Number(e.target.value))}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                        min="1"
                        required
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}>
                      <Plus size={16} />
                      Add User
                    </button>
                  </form>
                </div>

                {/* Users List */}
                <div className="data-card">
                  <div className="card-header">
                    <h3 className="card-title">Registered Accounts</h3>
                    <div className="badge badge-indigo">{adminUsers.length} Users</div>
                  </div>
                  <div style={{ overflowX: 'auto' }} className="mobile-table-cards">
                    <table style={{ minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th onClick={() => handleSort('id', adminSortBy, adminSortOrder, setAdminSortBy, setAdminSortOrder)} style={{cursor: 'pointer'}}>
                            Username <SortIcon active={adminSortBy === 'id'} order={adminSortOrder} />
                          </th>
                          <th>Password (Plain)</th>
                          <th onClick={() => handleSort('limitType', adminSortBy, adminSortOrder, setAdminSortBy, setAdminSortOrder)} style={{cursor: 'pointer'}}>
                            Limit Type <SortIcon active={adminSortBy === 'limitType'} order={adminSortOrder} />
                          </th>
                          <th onClick={() => handleSort('validUntil', adminSortBy, adminSortOrder, setAdminSortBy, setAdminSortOrder)} style={{cursor: 'pointer'}}>
                            Expiration / Quota <SortIcon active={adminSortBy === 'validUntil'} order={adminSortOrder} />
                          </th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((u) => (
                          <AdminUserRow key={u.id} u={u} onDelete={handleDeleteUser} />
                        ))}
                      </tbody>
                    </table>
                  </div>
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

        {/* Toast Container */}
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 9999 }}>
          {toasts.map((t) => (
            <div key={t.id} style={{
              background: t.type === 'error' ? 'var(--rose)' : t.type === 'success' ? '#10b981' : 'var(--text-main)',
              color: 'white', padding: '1rem 1.5rem', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', fontWeight: 500
            }}>
              {t.type === 'error' && <TrendingDown size={16} />}
              {t.type === 'success' && <CheckCircle2 size={16} />}
              {t.type === 'info' && <Bell size={16} />}
              {t.message}
            </div>
          ))}
        </div>

        {/* Confirm Modal */}
        {confirmModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div className="data-card" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(244,63,94,0.1)', color: 'var(--rose)', borderRadius: '50%' }}>
                  <Trash2 size={24} />
                </div>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{confirmModal.title}</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>{confirmModal.message}</p>
              {confirmModal.submessage && (
                <div style={{ padding: '0.75rem', background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--rose)', borderRadius: '0.5rem', fontSize: '0.75rem', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                  {confirmModal.submessage}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setConfirmModal(null)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: 'var(--rose)', color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Mobile Bottom Navigation */}
      {isLoggedIn && (
        <nav className="mobile-nav">
          <button
            onClick={() => setActiveTab('screener_awan')}
            className={`mobile-nav-item ${activeTab === 'screener_awan' ? 'active' : ''}`}
          >
            <Rocket size={20} />
            <span>D.Awan</span>
          </button>
          <button
            onClick={() => setActiveTab('screener_swing')}
            className={`mobile-nav-item ${activeTab === 'screener_swing' ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Swing Mingguan</span>
          </button>
          <button
            onClick={() => setActiveTab('screener_turnaround')}
            className={`mobile-nav-item ${activeTab === 'screener_turnaround' ? 'active' : ''}`}
          >
            <TrendingUp size={20} />
            <span>Tn.Rdn</span>
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`mobile-nav-item ${activeTab === 'watchlist' ? 'active' : ''}`}
          >
            <Eye size={20} />
            <span>Watchlist</span>
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`mobile-nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
          >
            <Calculator size={20} />
            <span>Setup</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`mobile-nav-item ${activeTab === 'history' ? 'active' : ''}`}
          >
            <History size={20} />
            <span>Journal</span>
          </button>
          {currentUser === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`mobile-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
            >
              <Users size={20} />
              <span>Admin</span>
            </button>
          )}
        </nav>
      )}
    </div >
  );
}
