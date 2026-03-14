"use client"

import React from "react"
import { Rocket, Calculator, Plus, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Sparkline from "@/components/Sparkline"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { StockLogo } from "@/components/StockLogo"

interface StockCardProps {
  stock: any
  activeTab: string
  isSaved: boolean
  onSave: (stock: any) => void
  onAnalyze: (stock: any) => void
}

export function StockCard({ stock, activeTab, isSaved, onSave, onAnalyze }: StockCardProps) {
  const isGain = (stock.distance || 0) > 0 || 
                 (stock.gainFromCross !== undefined && stock.gainFromCross > 0) ||
                 (stock.distanceToMA20 !== undefined && stock.distanceToMA20 > 0)
  
  return (
    <Card className="group relative overflow-hidden border-border bg-white transition-all duration-300 hover:border-primary/50 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.06)] rounded-[1.5rem] border-[1.5px]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link 
              href={`/stock/${stock.ticker}`}
              className="transition-all hover:scale-110"
            >
              <StockLogo ticker={stock.ticker} size="lg" className="rounded-2xl" />
            </Link>
            <div>
              <Link href={`/stock/${stock.ticker}`} className="text-base font-black tracking-tight text-foreground hover:text-primary transition-colors block">
                {stock.ticker}
              </Link>
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">IDX: Market</p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-base font-black text-foreground leading-none">Rp {stock.price?.toLocaleString('id-ID') || "-"}</p>
            <p className={cn(
              "text-[11px] font-black uppercase mt-1.5 tracking-tight",
              isGain ? "text-emerald-500" : "text-amber-500"
            )}>
              {activeTab === 'screener_awan' ? `+${(stock.distance || 0).toFixed(2)}%` : 
               activeTab === 'screener_bottom' ? `+${(stock.gainFromCross || 0).toFixed(2)}%` : 
               activeTab === 'screener_turnaround' ? `+${(stock.distanceToMA20 || 0).toFixed(2)}%` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl bg-muted/20 p-3 border border-border/30">
            <p className="text-[9px] font-bold uppercase text-muted-foreground/40 mb-1 tracking-widest">Volume Ratio</p>
            <p className="text-xs font-black text-foreground">
              {stock.isVolumeSpike ? "BOOM 🚀" : `${(stock.volumeRatio || 0).toFixed(1)}x`}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/20 p-3 border border-border/30">
            <p className="text-[9px] font-bold uppercase text-muted-foreground/40 mb-1 tracking-widest">Algorithm Status</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                {stock.tier && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                    stock.tier === 'Emas' ? "bg-amber-100 text-amber-700 border border-amber-200" : 
                    "bg-slate-100 text-slate-600 border border-slate-200"
                  )}>
                    {stock.tier}
                  </span>
                )}
                <span className="text-[10px] font-black text-foreground truncate uppercase tracking-tighter">
                  {stock.status || "Priced In"}
                </span>
                {stock.isRocket && <Rocket size={10} className="text-primary animate-pulse" />}
              </div>
            </div>
          </div>
        </div>

        <div className="h-12 mb-6 opacity-60 group-hover:opacity-100 transition-all duration-500 group-hover:scale-[1.02]">
          <Sparkline data={stock.sparkline} color={isGain ? '#10b981' : '#f59e0b'} />
        </div>

        <div className="flex gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "flex-1 h-11 rounded-[0.9rem] text-[10px] font-black uppercase tracking-widest transition-all border border-border/50",
              isSaved ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white hover:bg-muted/30"
            )}
            onClick={() => onSave(stock)}
          >
            {isSaved ? <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
            {isSaved ? "Saved" : "Save"}
          </Button>
          <Button 
            size="sm" 
            className="flex-1 h-11 rounded-[0.9rem] bg-foreground text-background hover:bg-primary text-[10px] font-black uppercase tracking-widest shadow-lg shadow-foreground/5 hover:shadow-primary/20 transition-all border-none"
            onClick={() => onAnalyze(stock)}
          >
            <Calculator className="h-3.5 w-3.5 mr-2" />
            Quant Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
