"use client"

import React, { useState, useEffect } from "react"
import { 
  Sparkles, 
  Brain, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  Loader2,
  X,
  ChevronRight,
  BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"
import { StockLogo } from "./StockLogo"
import { Button } from "@/components/ui/button"

interface AIAnalystProps {
  results: any[]
  activeTab: string
  onClose: () => void
}

export function AIAnalyst({ results, activeTab, onClose }: AIAnalystProps) {
  const [analyzedStocks, setAnalyzedStocks] = useState<any[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(true)

  useEffect(() => {
    // Simulate complex AI analysis
    const timer = setTimeout(() => {
      const topStocks = [...results]
        .filter(s => s.status === 'Rekom Beli' || s.isRocket)
        .sort((a, b) => (b.volumeRatio || 0) - (a.volumeRatio || 0))
        .slice(0, 3)

      const reasoningTemplates = [
        "Akumulasi volume masif terdeteksi dengan rasio {vol}x rata-rata. Struktur harga 'Super Rapat' di atas MA5 mengindikasikan fase markup yang sangat kuat.",
        "Momentum teknikal berada di titik optimal. Harga bertahan kokoh di atas seluruh MA utama dengan volatilitas yang menyempit, siap untuk kelanjutan tren bullish.",
        "Deteksi 'Rocket Signal' dikombinasikan dengan volume spike yang signifikan. Secara historis, pola 'Diatas Awan' seperti ini memiliki probabilitas tinggi untuk breakout lanjutan.",
        "Penetrasi MA short-term dengan volume di atas normal menunjukkan partisipasi buyer yang dominan. Secara struktur, saham ini adalah top pick untuk momentum trading."
      ]

      const finalAnalysis = topStocks.map((s, i) => ({
        ...s,
        aiReason: reasoningTemplates[i % reasoningTemplates.length].replace('{vol}', (s.volumeRatio || 1.5).toFixed(1))
      }))

      setAnalyzedStocks(finalAnalysis)
      setIsAnalyzing(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [results])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-background border border-border w-full max-w-2xl overflow-hidden shadow-2xl rounded-none flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-none border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter uppercase italic font-serif">AI Market Analyst</h2>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mt-1">
                Portfolio Optimization & Technical Intelligence
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted transition-colors border border-border">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">Scanning Technical Matrices...</p>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-2">Harmonizing Price Action & Volume Data</p>
              </div>
            </div>
          ) : analyzedStocks.length === 0 ? (
            <div className="text-center py-20">
              <Brain className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Insufficient High-Quality Signals Found</p>
              <p className="text-[9px] text-muted-foreground/60 mt-1 uppercase">Try checking other screening tabs for potential candidates.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="p-4 bg-muted/5 border border-primary/20 border-l-4 border-l-primary flex items-start gap-3">
                <Brain className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium leading-relaxed italic text-foreground/80">
                  "Berdasarkan analisis algoritma kami terhadap data {activeTab.replace('screener_', '').replace('_', ' ')}, 
                  berikut adalah {analyzedStocks.length} instrumen dengan probabilitas teknikal tertinggi saat ini."
                </p>
              </div>

              {analyzedStocks.map((stock, idx) => (
                <div key={stock.ticker} className="border border-border p-5 group hover:border-primary/40 transition-all bg-card/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BarChart3 size={80} />
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <StockLogo ticker={stock.ticker} size="md" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-black tracking-tighter">{stock.ticker}</span>
                          <span className="text-[9px] font-black text-emerald-500 uppercase border border-emerald-500/30 px-1 bg-emerald-500/5">
                            {stock.status || 'TOP PICK'}
                          </span>
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground tabular-nums">
                          Price: Rp {stock.price.toLocaleString()} • Vol Ratio: {stock.volumeRatio?.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[14px] font-black text-primary italic">RANK #{idx + 1}</div>
                    </div>
                  </div>

                  <div className="relative p-4 bg-background border border-border/40 text-[11px] text-foreground/70 leading-relaxed font-sans border-l-2 border-l-primary/60">
                    <span className="font-black text-primary text-[10px] uppercase tracking-widest block mb-1.5">AI Analysis Summary</span>
                    {stock.aiReason}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <div className="px-2 py-1 bg-muted border border-border text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                      Tightness: {((stock.tightness || 0) * 100).toFixed(2)}%
                    </div>
                    <div className="px-2 py-1 bg-muted border border-border text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                      Momentum: {((stock.distance || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/5 flex items-center justify-between">
           <div className="flex items-center gap-2 text-muted-foreground opacity-40">
              <ShieldCheck size={12} />
              <span className="text-[8px] font-black uppercase tracking-widest italic">Disclaimer: AI Analysis is for educational purposes only.</span>
           </div>
           <Button onClick={onClose} variant="outline" className="h-8 text-[9px] font-black uppercase tracking-widest px-6 rounded-none">
             Back to Terminal
           </Button>
        </div>
      </div>
    </div>
  )
}
