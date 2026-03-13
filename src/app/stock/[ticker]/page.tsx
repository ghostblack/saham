'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ChevronLeft, RefreshCw, AlertCircle } from 'lucide-react';
import StockDetailView, { StockResult } from '@/components/StockDetailView';

export default function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const [stock, setStock] = useState<StockResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStockDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock/${ticker}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stock details');
      }
      const data = await response.json();
      setStock(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockDetail();
  }, [ticker]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-body)', color: 'var(--text-main)' }}>
      {/* Header / Nav */}
      <nav style={{ 
        background: 'white', 
        padding: '1rem 2rem', 
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link 
            href="/" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.75rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-app)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <ChevronLeft size={20} />
            Back to Dashboard
          </Link>
          <div style={{ height: '24px', width: '1px', background: 'var(--border)' }}></div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Stock Detail <span style={{ color: 'var(--primary)' }}>Analysis</span>
          </h1>
        </div>

        <button 
          onClick={fetchStockDetail}
          disabled={loading}
          style={{
            border: 'none',
            background: 'var(--primary)',
            color: 'white',
            padding: '0.6rem 1rem',
            borderRadius: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 700,
            fontSize: '0.85rem'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10rem 0', gap: '1rem' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading sophisticated market data...</p>
          </div>
        ) : error ? (
          <div style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '1.5rem', padding: '4rem', textAlign: 'center' }}>
            <AlertCircle size={48} color="var(--rose)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Oops! Something went wrong</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{error}</p>
            <button 
              onClick={fetchStockDetail}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '1rem', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        ) : stock ? (
          <div className="data-card" style={{ padding: 0, overflow: 'hidden' }}>
            <StockDetailView stock={stock} />
          </div>
        ) : null}
      </main>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
