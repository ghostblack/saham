"use client"

import React, { useState, useMemo } from "react"
import { 
  Rocket, 
  Calculator, 
  Plus, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Activity
} from "lucide-react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { StockLogo } from "@/components/StockLogo"

interface ResultTableProps {
  results: any[]
  loading: boolean
  activeTab: string
  isSaved: (ticker: string) => boolean
  onSave: (stock: any) => void
  onAnalyze: (stock: any) => void
  searchQuery: string
}

type SortConfig = {
  key: string
  direction: 'asc' | 'desc' | null
}

export function ResultTable({ 
  results, 
  loading, 
  activeTab, 
  isSaved, 
  onSave, 
  onAnalyze,
  searchQuery
}: ResultTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ticker', direction: 'asc' })

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'desc'
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc'
    } else if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = null
    }
    setSortConfig({ key, direction })
  }

  const sortedResults = useMemo(() => {
    let sortableItems = [...results].filter((r: any) => 
      r.ticker.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key]
        let bValue: any = b[sortConfig.key]

        // Special handling for nested or calculated values
        if (sortConfig.key === 'perf') {
          aValue = activeTab === 'screener_awan' ? (a.distance || 0) : (a.gainFromCross || 0)
          bValue = activeTab === 'screener_awan' ? (b.distance || 0) : (b.gainFromCross || 0)
        }
        
        if (aValue === undefined || aValue === null) return 1
        if (bValue === undefined || bValue === null) return -1

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return sortableItems
  }, [results, searchQuery, sortConfig, activeTab])

  if (loading) {
    return (
      <div className="space-y-0 mt-4 border-t border-border/60">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-10 w-full border-b border-border/40 animate-pulse bg-muted/5" />
        ))}
      </div>
    )
  }

  if (sortedResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border/60 rounded-xl mt-4 bg-muted/5">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No instruments matched your criteria</p>
      </div>
    )
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={10} className="ml-1 opacity-20" />
    if (sortConfig.direction === 'asc') return <ArrowUp size={10} className="ml-1 text-primary" />
    if (sortConfig.direction === 'desc') return <ArrowDown size={10} className="ml-1 text-primary" />
    return <ArrowUpDown size={10} className="ml-1 opacity-20" />
  }

  return (
    <div className="mt-4 mb-20 md:mb-10 max-w-full overflow-hidden">
      <div className="overflow-x-auto scrollbar-hide">
        <Table className="border-collapse">
          <TableHeader className="bg-muted/5 border-y border-border/80">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead 
                className="h-10 text-[9px] font-black uppercase tracking-widest py-0 px-4 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40"
                onClick={() => handleSort('ticker')}
              >
                <div className="flex items-center justify-between">Instrument <SortIcon column="ticker" /></div>
              </TableHead>
              <TableHead 
                className="h-10 text-[9px] font-black uppercase tracking-widest py-0 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center justify-between px-2">Price <SortIcon column="price" /></div>
              </TableHead>
              <TableHead 
                className="h-10 text-[9px] font-black uppercase tracking-widest py-0 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40"
                onClick={() => handleSort('perf')}
              >
                <div className="flex items-center justify-between px-2">Perf <SortIcon column="perf" /></div>
              </TableHead>
              <TableHead 
                className="h-10 text-[9px] font-black uppercase tracking-widest py-0 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40"
                onClick={() => handleSort('volumeRatio')}
              >
                <div className="flex items-center justify-between px-2">Vol Ratio <SortIcon column="volumeRatio" /></div>
              </TableHead>
              <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest py-0 px-4 border-r border-border/40">Technical</TableHead>
              <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest py-0 text-right px-4">Ops</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedResults.map((stock: any) => {
              const isGain = (stock.distance || 0) > 0 || (stock.gainFromCross !== undefined && stock.gainFromCross > 0)
              const saved = isSaved(stock.ticker)
              const volRatio = stock.volumeRatio || 0
              
              const price = stock.price;
              const ma20 = stock.smaValues?.['20'];
              const ma200 = stock.smaValues?.['200'];
              
              const isAboveMA20 = ma20 && price > ma20;
              const isAboveMA200 = ma200 && price > ma200;

              return (
                <TableRow key={stock.ticker} className="group border-b border-border/40 hover:bg-muted/5 transition-colors">
                  <TableCell className="px-4 py-2 border-r border-border/40">
                    <div className="flex items-center gap-2.5">
                       <StockLogo ticker={stock.ticker} size="sm" />
                       <Link 
                        href={`/stock/${stock.ticker}`} 
                        className="font-black text-foreground tracking-tighter text-[13px] hover:text-primary transition-colors hover:underline"
                      >
                        {stock.ticker}
                      </Link>
                      {stock.isRocket && <Rocket size={10} className="text-primary animate-pulse shrink-0" />}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-4 border-r border-border/40">
                    <span className="font-black text-foreground font-mono text-[12px] tabular-nums">
                      {stock.price.toLocaleString('id-ID')}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-4 border-r border-border/40">
                    <span className={cn(
                        "font-black font-mono text-[11px] tabular-nums",
                        isGain ? "text-emerald-600" : "text-amber-600"
                      )}>
                      {activeTab === 'screener_awan' ? `+${((stock.distance || 0) * 100).toFixed(1)}%` : 
                       activeTab === 'screener_bottom' ? `+${(stock.gainFromCross || 0).toFixed(1)}%` : 
                       activeTab === 'screener_turnaround' ? `+${(stock.gainFromCross || 0).toFixed(1)}%` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-4 border-r border-border/40">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-foreground font-mono text-[12px] tabular-nums">
                        {volRatio.toFixed(1)}x
                      </span>
                      {stock.isVolumeSpike && (
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" title="Volume Spike" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-4 border-r border-border/40 min-w-[120px]">
                    <div className="flex flex-wrap items-center gap-2">
                      {isAboveMA20 ? (
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">MA20 ↑</span>
                      ) : ma20 ? (
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">MA20 ↓</span>
                      ) : null}
                      
                      {isAboveMA200 && (
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">MA200 ↑</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        className={cn(
                          "transition-colors",
                          saved ? "text-emerald-600" : "text-muted-foreground/30 hover:text-primary"
                        )}
                        onClick={() => onSave(stock)}
                      >
                        {saved ? <CheckCircle2 size={13} /> : <Plus size={13} />}
                      </button>
                      <button 
                        className="text-muted-foreground/30 hover:text-primary transition-colors"
                        onClick={() => onAnalyze(stock)}
                      >
                        <Calculator size={13} />
                      </button>
                      <Link href={`/stock/${stock.ticker}`} className="text-muted-foreground/20 hover:text-primary transition-colors">
                        <ChevronRight size={13} />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
