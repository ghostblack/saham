'use client';

import React from 'react';
import dynamic from 'next/dynamic';
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });
import { Target, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

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
      height: 350,
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent'
    },
    title: { text: 'Price Action & MAs', align: 'left', style: { fontSize: '14px', color: 'var(--text-main)' } },
    xaxis: { 
      type: 'datetime', 
      labels: { style: { colors: 'var(--text-muted)', fontSize: '10px' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: { 
      tooltip: { enabled: true }, 
      labels: { style: { colors: 'var(--text-muted)', fontSize: '10px' } }
    },
    grid: { borderColor: 'var(--border)', strokeDashArray: 4 },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px' },
    plotOptions: {
      candlestick: {
        colors: { upward: '#22c55e', downward: '#ef4444' }
      }
    },
    theme: {
        mode: 'light' // Adjust based on your global theme if needed
    }
  };

  const series = [
    {
      name: 'Candlestick',
      type: 'candlestick',
      data: stock.ohlcData || []
    },
    {
      name: 'MA 10',
      type: 'line',
      data: (stock.ohlcData || []).map((d, i) => ({
        x: d.x,
        y: stock.smaFullData?.['10']?.[i] || null
      }))
    },
    {
      name: 'MA 20',
      type: 'line',
      data: (stock.ohlcData || []).map((d, i) => ({
        x: d.x,
        y: stock.smaFullData?.['20']?.[i] || null
      }))
    },
    {
      name: 'MA 50',
      type: 'line',
      data: (stock.ohlcData || []).map((d, i) => ({
        x: d.x,
        y: stock.smaFullData?.['50']?.[i] || null
      }))
    },
    {
      name: 'MA 100',
      type: 'line',
      data: (stock.ohlcData || []).map((d, i) => ({
        x: d.x,
        y: stock.smaFullData?.['100']?.[i] || null
      }))
    }
  ];

  // Override stroke colors for MAs
  const finalOptions = {
    ...chartOptions,
    stroke: {
      width: [1, 2, 2, 2, 2],
      colors: ['#000', '#f97316', '#22c55e', '#eab308', '#ef4444']
    }
  };

  // Skenario Beli Tiers
  const smas = [
    { name: 'MA 10', value: stock.smaValues?.['10'] || 0 },
    { name: 'MA 20', value: stock.smaValues?.['20'] || 0 },
    { name: 'MA 50', value: stock.smaValues?.['50'] || 0 },
    { name: 'MA 100', value: stock.smaValues?.['100'] || 0 }
  ].filter(s => s.value > 0).sort((a, b) => b.value - a.value);

  const entry1 = stock.isRocket ? 'HAKA (Market Buy)' : `Antri di ${smas[0]?.name || 'Support'} (~${Math.floor(smas[0]?.value || stock.price)})`;
  const entry2 = `Antri di ${smas[1]?.name || 'Support'} (~${Math.floor(smas[1]?.value || stock.price * 0.97)})`;
  const entry3 = `Antri di ${smas[2]?.name || 'Support'} (~${Math.floor(smas[2]?.value || stock.price * 0.95)})`;

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.5rem' }}>
          {stock.ticker.substring(0, 2)}
        </div>
        <div>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>{stock.ticker}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span className="badge badge-indigo" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>Price: {stock.price.toLocaleString('id-ID')}</span>
            {stock.isRocket && <span className="badge badge-amber" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>Rocket Status 🚀</span>}
            {stock.macdStatus && (
              <span className={`badge ${stock.macdStatus.includes('Golden') ? 'badge-emerald' : stock.macdStatus.includes('Dead') ? 'badge-rose' : 'badge-indigo'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                MACD: {stock.macdStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: '450px', marginBottom: '2rem', background: 'var(--bg-app)', borderRadius: '1.5rem', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
        <ReactApexChart options={finalOptions} series={series} type="line" height={400} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--primary-light)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.75px', fontWeight: 700 }}>
            <Target size={20} color="var(--primary)" />
            Skenario Beli (Piramida)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'white', borderRadius: '1rem', borderLeft: '5px solid var(--primary)', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIER 1 (50% Modal)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.4rem', color: 'var(--text-main)' }}>{entry1}</div>
            </div>
            <div style={{ padding: '1rem', background: 'white', borderRadius: '1rem', borderLeft: '5px solid var(--success)', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIER 2 (30% Modal)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.4rem', color: 'var(--text-main)' }}>{entry2}</div>
            </div>
            <div style={{ padding: '1rem', background: 'white', borderRadius: '1rem', borderLeft: '5px solid var(--amber)', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIER 3 (20% Modal)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.4rem', color: 'var(--text-main)' }}>{entry3}</div>
            </div>
          </div>
          {stock.isRocket && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
              <AlertTriangle size={20} color="#f97316" style={{ marginTop: '2px' }} />
              <p style={{ fontSize: '0.85rem', color: '#9a3412', margin: 0, lineHeight: 1.5 }}>
                <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '0.25rem' }}>Volume Spike Detected!</strong> 
                Disarankan untuk HAKA (beli kanan) di tier 1 agar tidak tertinggal momentum breakout. Pastikan money management tetap terjaga.
              </p>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--bg-body)', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.75px', fontWeight: 700 }}>Market Analysis Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {smas.map(sma => (
              <div key={sma.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{sma.name} Support</span>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{Math.floor(sma.value).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>MA Tightness Index</span>
              <span style={{ fontWeight: 600, fontSize: '1rem', color: ((stock.tightness || 0) < 0.05 ? 'var(--success)' : 'var(--text-main)') }}>
                {((stock.tightness || 0) * 100).toFixed(2)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nearest MA Distance</span>
              <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--primary)' }}>
                +{((stock.distance || 0) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--primary-light)', borderRadius: '1rem', color: 'var(--primary)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Relative Volume (20D)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{(stock.volumeRatio || 0).toFixed(2)}x</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Compared to 20-day average trading volume</div>
          </div>
        </div>
      </div>
    </div>
  );
}
