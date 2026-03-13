'use client';

import React from 'react';
import dynamic from 'next/dynamic';
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });
import { Target, AlertTriangle, TrendingUp, TrendingDown, Activity, Zap, Shield, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StockResult {
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

interface StockDetailViewProps {
  stock: StockResult;
}

export default function StockDetailView({ stock }: StockDetailViewProps) {
  const chartOptions: any = {
    chart: {
      type: 'candlestick',
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
      fontFamily: 'inherit'
    },
    xaxis: { 
      type: 'datetime', 
      labels: { style: { colors: 'var(--text-muted)', fontSize: '8px', fontWeight: 900 } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: { 
      opposite: true,
      labels: { style: { colors: 'var(--text-muted)', fontSize: '8px', fontWeight: 900 } }
    },
    grid: { borderColor: 'rgba(var(--border-rgb), 0.1)', strokeDashArray: 0 },
    legend: { show: false },
    plotOptions: {
      candlestick: {
        colors: { upward: '#10b981', downward: '#f43f5e' },
        wick: { useFillColor: true }
      }
    },
    tooltip: { theme: 'dark' }
  };

  const series = [
    {
      name: 'Price',
      type: 'candlestick',
      data: stock.ohlcData || []
    },
    {
      name: 'MA10',
      type: 'line',
      data: (stock.ohlcData || []).map((d, i) => ({
        x: d.x,
        y: stock.smaFullData?.['10']?.[i] || null
      }))
    },
    {
      name: 'MA20',
      type: 'line',
      data: (stock.ohlcData || []).map((d, i) => ({
        x: d.x,
        y: stock.smaFullData?.['20']?.[i] || null
      }))
    }
  ];

  const finalOptions = {
    ...chartOptions,
    stroke: {
      width: [1, 1, 1],
      colors: ['#000', '#f97316', '#10b981']
    }
  };

  const smas = [
    { name: 'MA 10', value: stock.smaValues?.['10'] || 0, color: 'text-orange-500' },
    { name: 'MA 20', value: stock.smaValues?.['20'] || 0, color: 'text-emerald-500' },
    { name: 'MA 50', value: stock.smaValues?.['50'] || 0, color: 'text-amber-500' },
    { name: 'MA 100', value: stock.smaValues?.['100'] || 0, color: 'text-rose-500' }
  ].filter(s => s.value > 0).sort((a, b) => b.value - a.value);

  const entry1 = stock.isRocket ? 'HAKA (Market Buy)' : `Antri di ${smas[0]?.name || 'Support'} (~${Math.floor(smas[0]?.value || stock.price)})`;
  const entry2 = `Antri di ${smas[1]?.name || 'Support'} (~${Math.floor(smas[1]?.value || stock.price * 0.97)})`;

  return (
    <div className="h-full w-full grid grid-cols-12 grid-rows-6 border-l border-border bg-background font-mono leading-none">
      
      {/* 1. TICKER SUMMARY (Top Left) */}
      <div className="col-span-3 row-span-1 border-r border-b border-border p-4 flex flex-col justify-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[24px] font-black tracking-tighter text-foreground">{stock.ticker}</span>
          {stock.isRocket && <Zap size={14} className="text-primary animate-pulse fill-primary" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="text-[10px] font-black px-1.5 py-0.5 border border-primary text-primary uppercase tracking-widest">
            {stock.price.toLocaleString('id-ID')}
          </div>
          {stock.macdStatus && (
            <div className={cn(
              "text-[8px] font-black px-1.5 py-0.5 border uppercase tracking-widest",
              stock.macdStatus.includes('Golden') ? "border-emerald-500 text-emerald-500" : "border-border text-muted-foreground"
            )}>
              MACD: {stock.macdStatus}
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN TECHNICALS (Top Center) */}
      <div className="col-span-6 row-span-1 border-r border-b border-border p-4 flex items-center justify-around">
        <div className="text-center">
          <div className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Vol Ratio</div>
          <div className="text-[18px] font-black tabular-nums text-foreground">{(stock.volumeRatio || 0).toFixed(2)}x</div>
        </div>
        <div className="h-8 w-px bg-border/40"></div>
        <div className="text-center">
          <div className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Tightness</div>
          <div className="text-[18px] font-black tabular-nums text-emerald-500">{((stock.tightness || 0) * 100).toFixed(2)}%</div>
        </div>
        <div className="h-8 w-px bg-border/40"></div>
        <div className="text-center">
          <div className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">MA Dist</div>
          <div className="text-[18px] font-black tabular-nums text-primary">+{((stock.distance || 0) * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* 3. LOGO/STATUS (Top Right) */}
      <div className="col-span-3 row-span-1 border-b border-border p-4 flex items-center justify-center bg-muted/5">
        <div className="w-12 h-12 border border-border flex items-center justify-center text-[18px] font-black text-muted-foreground/20">
          {stock.ticker.substring(0, 2)}
        </div>
      </div>

      {/* 4. MAIN CHART (Center Left) */}
      <div className="col-span-9 row-span-4 border-r border-b border-border bg-black/5 relative min-h-0">
        <div className="absolute top-2 left-4 z-10 flex gap-4">
            {smas.slice(0, 2).map(sma => (
                <div key={sma.name} className="flex items-center gap-1.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full", sma.color.replace('text', 'bg'))}></div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{sma.name}: {Math.floor(sma.value)}</span>
                </div>
            ))}
        </div>
        <div className="h-full w-full pt-4">
          <ReactApexChart options={finalOptions} series={series} type="candlestick" height="100%" />
        </div>
      </div>

      {/* 5. TRADE PLAN (Center Right) */}
      <div className="col-span-3 row-span-4 border-b border-border p-5 flex flex-col gap-4">
         <div className="flex items-center gap-2 mb-2">
            <Target size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground">Entry Matrix</span>
         </div>
         
         <div className="space-y-3">
             <div className="p-3 border border-primary/20 bg-primary/5">
                <div className="text-[7px] font-black text-primary uppercase tracking-[0.2em] mb-1">PRIMARY LOAD :: 60%</div>
                <div className="text-[11px] font-black text-foreground uppercase tracking-tight leading-tight">{entry1}</div>
             </div>
             
             <div className="p-3 border border-border bg-muted/5">
                <div className="text-[7px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">SECONDARY :: 40%</div>
                <div className="text-[11px] font-black text-foreground uppercase tracking-tight leading-tight">{entry2}</div>
             </div>
         </div>

         {stock.isRocket && (
            <div className="mt-auto p-3 border border-amber-500/20 bg-amber-500/5 flex items-start gap-2">
               <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
               <p className="text-[8px] font-black text-amber-900/60 uppercase leading-relaxed tracking-tighter">
                  Aggressive accumulation detected. Market buy recommended for primary load.
               </p>
            </div>
         )}
      </div>

      {/* 6. MA TABLE (Bottom Left) */}
      <div className="col-span-6 row-span-1 border-r border-border p-4 flex items-center gap-8">
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-muted-foreground" />
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">MA Support Layers</span>
        </div>
        <div className="flex gap-6 overflow-x-auto scrollbar-hide">
          {smas.map(sma => (
            <div key={sma.name} className="whitespace-nowrap flex items-baseline gap-1.5">
              <span className="text-[8px] font-black text-muted-foreground uppercase">{sma.name}:</span>
              <span className="text-[10px] font-black text-foreground tabular-nums">{Math.floor(sma.value).toLocaleString('id-ID')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7. PERFORMANCE (Bottom Right) */}
      <div className="col-span-6 row-span-1 p-4 flex items-center justify-end gap-6 bg-muted/5">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-muted-foreground" />
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Asset Diagnostics</span>
        </div>
        <div className="flex gap-4 items-center">
            {stock.gainFromCross !== undefined && (
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[8px] font-black text-muted-foreground uppercase">Signal Perf:</span>
                    <span className="text-[12px] font-black text-emerald-500 tabular-nums">+{stock.gainFromCross.toFixed(1)}%</span>
                </div>
            )}
            <div className="h-4 w-px bg-border/20"></div>
            <div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-40 italic">
                Data generated at {new Date().toLocaleTimeString()}
            </div>
        </div>
      </div>

    </div>
  );
}
