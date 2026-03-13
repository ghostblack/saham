'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ChevronLeft, RefreshCw, AlertCircle } from 'lucide-react';
import StockDetailView, { StockResult } from '@/components/StockDetailView';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Mini-Header */}
      <nav className="h-10 px-4 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          <Link 
            href="/" 
            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors"
          >
            <ChevronLeft size={14} />
            Dashboard
          </Link>
          <div className="h-4 w-px bg-border/40"></div>
          <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
            Analysis <span className="text-primary opacity-40">::</span> {ticker}
          </h1>
        </div>

        <button 
          onClick={fetchStockDetail}
          disabled={loading}
          className="h-7 px-3 flex items-center gap-2 bg-primary text-white text-[8px] font-black uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          <RefreshCw size={10} className={cn(loading && "animate-spin")} />
          Sync
        </button>
      </nav>

      <main className="flex-1 overflow-hidden">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-primary opacity-40" />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Streaming Data...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
            <AlertCircle size={32} className="text-rose-500/40 mb-4" />
            <h2 className="text-[11px] font-black uppercase tracking-widest text-foreground mb-2">Protocol Error</h2>
            <p className="text-[10px] text-muted-foreground mb-6 font-mono leading-relaxed">{error}</p>
            <button 
              onClick={fetchStockDetail}
              className="px-6 py-2 border border-primary text-primary text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
            >
              Reconnect
            </button>
          </div>
        ) : stock ? (
          <div className="h-full w-full overflow-hidden flex flex-col">
            <StockDetailView stock={stock} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
