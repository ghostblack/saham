"use client"

import React from "react"
import { Target, Wallet, BarChart3, Calculator, Rocket, ShieldAlert, ArrowRightLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function TradeAnalysis({
  capital,
  setCapital,
  riskPercent,
  setRiskPercent,
  selectedStockForAnalysis,
  tradePlan,
  calculateTradePlan,
  executeTrade
}: any) {
  if (!selectedStockForAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/5 rounded-3xl border border-dashed border-border">
        <Target size={48} className="opacity-10 mb-4" />
        <p className="text-lg font-bold text-foreground/40 mb-1">No Active Target</p>
        <p className="text-sm">Select a stock from the terminal to begin complex analysis</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">Quantitative Setup</h2>
        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider opacity-70">Risk optimization & position sizing terminal</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-border bg-card/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black uppercase text-orange-600 tracking-tight">
              <Wallet className="h-6 w-6" />
              Capital Profile
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Portfolio Risk Parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Deployable Capital (IDR)</label>
                <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground opacity-30">RP</span>
                   <Input 
                      type="number"
                      value={capital}
                      onChange={(e) => setCapital(Number(e.target.value))}
                      className="h-14 pl-12 rounded-2xl border-border bg-muted/30 text-lg font-black font-mono focus-visible:ring-orange-600/50"
                   />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Risk Unit per Trade (%)</label>
                <div className="relative">
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground opacity-30">%</span>
                   <Input 
                      type="number"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(Number(e.target.value))}
                      className="h-14 rounded-2xl border-border bg-muted/30 text-lg font-black font-mono focus-visible:ring-orange-600/50"
                   />
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-900/50 border border-border p-8 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Max Risk Amount</span>
                <span className="text-xl font-black text-red-500 font-mono">RP {(capital * riskPercent / 100).toLocaleString('id-ID')}</span>
              </div>
              <Separator className="bg-border/30" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Max Allocation (Stock)</span>
                <span className="text-xl font-black text-foreground font-mono">RP {(capital * 0.25).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {tradePlan && (
          <Card className="border-border bg-zinc-900 border-orange-600/20 shadow-2xl shadow-orange-600/5 overflow-hidden">
             <div className="bg-orange-600 h-1 w-full" />
             <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="space-y-1">
                   <CardTitle className="text-3xl font-black tracking-tighter text-white uppercase italic">{selectedStockForAnalysis.ticker}</CardTitle>
                   <CardDescription className="text-[10px] font-black tracking-[0.3em] uppercase text-orange-600">Trading Directive</CardDescription>
                </div>
                <Badge className="rounded-xl px-4 py-1.5 bg-orange-600/10 text-orange-600 border border-orange-600/20 font-black text-xs uppercase tracking-widest">
                   {tradePlan.strategy}
                </Badge>
             </CardHeader>
             <CardContent className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 rounded-2xl bg-muted/10 border border-border/50">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Execution Entry</p>
                      <p className="text-2xl font-black text-white font-mono leading-none">{tradePlan.entry.toLocaleString('id-ID')}</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-muted/10 border border-border/50">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Target Quantity</p>
                      <p className="text-2xl font-black text-white font-mono leading-none">{tradePlan.lots} <span className="text-xs font-bold text-muted-foreground">LOTS</span></p>
                   </div>
                </div>

                <div className="space-y-4">
                    <div className="relative pt-6">
                       <div className="absolute left-0 top-0 text-[10px] font-extrabold uppercase tracking-widest text-red-500">Stop Loss (SL)</div>
                       <div className="flex justify-between items-end">
                          <span className="text-2xl font-black text-red-500/80 font-mono tracking-tight">{tradePlan.sl.toLocaleString('id-ID')}</span>
                          <span className="text-[10px] font-bold text-red-500/40 uppercase mb-1">EXIT @ FAILURE</span>
                       </div>
                       <div className="h-1.5 w-full bg-zinc-800 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-red-500 w-[15%]" />
                       </div>
                    </div>

                    <div className="relative pt-6">
                       <div className="absolute left-0 top-0 text-[10px] font-extrabold uppercase tracking-widest text-emerald-500">Take Profit (TP)</div>
                       <div className="flex justify-between items-end">
                          <span className="text-2xl font-black text-emerald-500/80 font-mono tracking-tight">{tradePlan.tp.toLocaleString('id-ID')}</span>
                          <span className="text-[10px] font-bold text-emerald-500/40 uppercase mb-1">EXIT @ SUCCESS</span>
                       </div>
                       <div className="h-1.5 w-full bg-zinc-800 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-emerald-500 w-[65%]" />
                       </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-6 rounded-3xl bg-zinc-950/50 border border-border ring-1 ring-white/5">
                   <div className="text-center">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">Potential Yield</p>
                      <p className="text-lg font-black text-emerald-500 font-mono italic tracking-tight">+Rp {tradePlan.potentialProfit.toLocaleString('id-ID')}</p>
                   </div>
                   <div className="h-10 w-[1px] bg-border/20" />
                   <div className="text-center">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">RR Efficiency</p>
                      <div className="flex items-center justify-center gap-1.5">
                         <p className="text-xl font-black text-white">1:{tradePlan.rrRatio.toFixed(1)}</p>
                         <BarChart3 className="h-4 w-4 text-orange-600" />
                      </div>
                   </div>
                </div>

                <Button 
                   onClick={executeTrade}
                   className="w-full h-14 rounded-2xl bg-orange-600 text-white font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-orange-600/10 hover:bg-orange-500 transition-all hover:scale-[1.01]"
                >
                   Lock Trade Payload
                </Button>
             </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
