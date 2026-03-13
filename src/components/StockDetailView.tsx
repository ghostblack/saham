'use client';

import React from 'react';
import dynamic from 'next/dynamic';
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });
import { Target, AlertTriangle, TrendingUp, TrendingDown, Activity, Zap, Shield, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockLogo } from '@/components/StockLogo';

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
    },
    {
      name: 'MA50',
      type: 'line',
      data: (stock.ohlcData || []).map((d, i) => ({
        x: d.x,
        y: stock.smaFullData?.['50']?.[i] || null
      }))
    }
  ];

  const finalOptions = {
    ...chartOptions,
    stroke: {
      width: [1, 1.5, 1.5, 1.5],
      colors: ['#000', '#f97316', '#10b981', '#3b82f6']
    }
  };

  const smas = [
    { name: 'MA 10', value: stock.smaValues?.['10'] || 0, color: 'text-orange-500' },
    { name: 'MA 20', value: stock.smaValues?.['20'] || 0, color: 'text-emerald-500' },
    { name: 'MA 50', value: stock.smaValues?.['50'] || 0, color: 'text-blue-500' },
    { name: 'MA 100', value: stock.smaValues?.['100'] || 0, color: 'text-amber-500' }
  ].filter(s => s.value > 0);

  // Phased Buying (Cicil Beli) Logic
  const entryPrice = stock.price;
  const support1 = Math.floor(stock.smaValues?.['10'] || entryPrice * 0.98);
  const support2 = Math.floor(stock.smaValues?.['20'] || entryPrice * 0.96);

  return (
    <div className="h-full w-full grid grid-cols-12 grid-rows-6 border-l border-border bg-background font-mono leading-none">
      
      {/* 1. TICKER SUMMARY (Top Left) */}
      <div className="col-span-3 row-span-1 border-r border-b border-border p-4 flex flex-col justify-center gap-2">
        <div className="flex items-center gap-3">
          <StockLogo ticker={stock.ticker} size="md" />
          <div className="flex flex-col">
            <span className="text-[18px] font-black tracking-tighter text-foreground leading-none">{stock.ticker}</span>
            <div className="flex items-center gap-1 mt-1">
                {stock.isRocket ? <Zap size={10} className="text-primary fill-primary" /> : <Activity size={10} className="text-muted-foreground" />}
                <span className={cn(
                    "text-[7px] font-black uppercase tracking-widest",
                    stock.isRocket ? "text-primary" : "text-muted-foreground opacity-60"
                )}>
                    {stock.isRocket ? "Rocket Signal" : "Stable Trend"}
                </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          <div className="text-[9px] font-black px-1.5 py-0.5 border border-primary text-primary uppercase tracking-widest tabular-nums">
            {stock.price.toLocaleString('id-ID')}
          </div>
          {stock.status && (
            <div className={cn(
              "text-[8px] font-black px-1.5 py-0.5 border uppercase tracking-widest",
              stock.status.includes('Beli') ? "border-emerald-500 text-emerald-500" : "border-border text-muted-foreground"
            )}>
              {stock.status}
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN TECHNICALS (Top Center) */}
      <div className="col-span-6 row-span-1 border-r border-b border-border p-4 flex items-center justify-around">
        <div className="text-center">
          <div className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Vol (10D Avg)</div>
          <div className="text-[18px] font-black tabular-nums text-foreground">{(stock.volumeRatio || 0).toFixed(2)}x</div>
        </div>
        <div className="h-8 w-px bg-border/40"></div>
        <div className="text-center">
          <div className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Tightness</div>
          <div className="text-[18px] font-black tabular-nums text-emerald-500">{((stock.tightness || 0) * 100).toFixed(2)}%</div>
        </div>
        <div className="h-8 w-px bg-border/40"></div>
        <div className="text-center">
          <div className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">MA Break</div>
          <div className="text-[18px] font-black tabular-nums text-primary">+{((stock.distance || 0) * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* 3. LOGO/STATUS (Top Right) */}
      <div className="col-span-3 row-span-1 border-b border-border p-4 flex items-center justify-center bg-muted/5">
        <StockLogo ticker={stock.ticker} size="lg" className="border-none bg-transparent" />
      </div>

      {/* 4. MAIN CHART (Center Left) */}
      <div className="col-span-9 row-span-4 border-r border-b border-border bg-black/5 relative min-h-0">
        <div className="absolute top-2 left-4 z-10 flex gap-4">
            {smas.slice(0, 3).map(sma => (
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

      {/* 5. CICIL BELI PLAN (Center Right) */}
      <div className="col-span-3 row-span-4 border-b border-border p-4 flex flex-col gap-4">
         <div className="flex items-center gap-2 mb-1">
            <Target size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground">Cicil Beli Strategy</span>
         </div>
         
         <div className="flex-1 flex flex-col gap-2.5">
             <div className="flex-1 p-3 border border-primary/20 bg-primary/5 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[7px] font-black text-primary uppercase tracking-widest">Initial :: 30%</span>
                    <span className="text-[9px] font-black text-foreground">Rp {entryPrice.toLocaleString()}</span>
                </div>
                <div className="text-[10px] font-black text-foreground uppercase tracking-tight leading-none italic">Market Price / HAKA</div>
             </div>
             
             <div className="flex-1 p-3 border border-border bg-muted/5 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Support I :: 40%</span>
                    <span className="text-[9px] font-black text-foreground">Rp {support1.toLocaleString()}</span>
                </div>
                <div className="text-[10px] font-black text-foreground uppercase tracking-tight leading-none italic">Near MA 10 Zone</div>
             </div>

             <div className="flex-1 p-3 border border-border bg-muted/5 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Support II :: 30%</span>
                    <span className="text-[9px] font-black text-foreground">Rp {support2.toLocaleString()}</span>
                </div>
                <div className="text-[10px] font-black text-foreground uppercase tracking-tight leading-none italic">Safety MA 20 Zone</div>
             </div>
         </div>

         <div className="p-3 border border-rose-500/20 bg-rose-500/5 items-start gap-2">
            <Shield size={10} className="text-rose-500 mb-1" />
            <div className="flex justify-between items-center">
                <span className="text-[7px] font-black text-rose-500 uppercase tracking-widest">Stop Loss</span>
                <span className="text-[9px] font-black text-rose-600">Rp {Math.floor(support2 * 0.98).toLocaleString()}</span>
            </div>
         </div>
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
