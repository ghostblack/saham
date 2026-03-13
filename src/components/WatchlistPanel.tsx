"use client"

import React, { useState, useMemo } from "react"
import { Eye, Trash2, TrendingUp, TrendingDown, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function WatchlistPanel({
  watchlist,
  watchlistData,
  watchlistLoading,
  fetchWatchlistQuotes,
  removeFromWatchlist
}: any) {
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc' | null}>({ key: 'ticker', direction: 'asc' })

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'desc'
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc'
    else if (sortConfig.key === key && sortConfig.direction === 'asc') direction = null
    setSortConfig({ key, direction })
  }

  const sortedWatchlist = useMemo(() => {
    let items = watchlist.map((w: any) => {
      const liveData = watchlistData.find((d: any) => d.ticker === w.ticker)
      const currentPrice = liveData ? liveData.currentPrice : w.entryPrice
      const pl = ((currentPrice - w.entryPrice) / (w.entryPrice || 1)) * 100
      return { ...w, currentPrice, pl }
    })

    if (sortConfig.direction !== null) {
      items.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return items
  }, [watchlist, watchlistData, sortConfig])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={10} className="ml-1 opacity-20" />
    if (sortConfig.direction === 'asc') return <ArrowUp size={10} className="ml-1 text-primary" />
    if (sortConfig.direction === 'desc') return <ArrowDown size={10} className="ml-1 text-primary" />
    return <ArrowUpDown size={10} className="ml-1 opacity-20" />
  }

  return (
    <div className="space-y-8 pb-10 border-t border-border/40 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black tracking-tighter text-foreground font-serif italic text-primary">Tactical Watchlist</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">Portfolio Surveillance</p>
        </div>
        <button 
          onClick={fetchWatchlistQuotes} 
          disabled={watchlistLoading}
          className="h-9 px-4 text-[9px] font-black uppercase tracking-[0.2em] bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={cn("h-3 w-3", watchlistLoading && "animate-spin")} />
          Sync Quotes
        </button>
      </div>

      <div className="border border-border/60 bg-white">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/5 border-b border-border/80">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead 
                    className="h-10 text-[9px] font-black uppercase tracking-widest py-0 px-6 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40"
                    onClick={() => handleSort('ticker')}
                >
                    <div className="flex items-center justify-between">Instrument <SortIcon column="ticker" /></div>
                </TableHead>
                <TableHead 
                    className="h-10 text-[9px] font-black uppercase tracking-widest py-0 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40 px-6"
                    onClick={() => handleSort('entryPrice')}
                >
                    <div className="flex items-center justify-between">Entry <SortIcon column="entryPrice" /></div>
                </TableHead>
                <TableHead 
                    className="h-10 text-[9px] font-black uppercase tracking-widest py-0 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40 px-6"
                    onClick={() => handleSort('currentPrice')}
                >
                    <div className="flex items-center justify-between">Market <SortIcon column="currentPrice" /></div>
                </TableHead>
                <TableHead 
                    className="h-10 text-[9px] font-black uppercase tracking-widest py-0 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40 px-6"
                    onClick={() => handleSort('pl')}
                >
                    <div className="flex items-center justify-between">P/L <SortIcon column="pl" /></div>
                </TableHead>
                <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest py-0 text-right px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedWatchlist.length > 0 ? (
                sortedWatchlist.map((item: any) => {
                  const isGain = item.pl >= 0

                  return (
                    <TableRow key={item.ticker} className="border-b border-border/40 group transition-all hover:bg-muted/5">
                      <TableCell className="px-6 py-2 border-r border-border/40">
                        <Link href={`/stock/${item.ticker}`} className="font-black text-foreground text-[13px] hover:text-primary transition-colors block tracking-tighter hover:underline">
                          {item.ticker}
                        </Link>
                      </TableCell>
                      <TableCell className="font-bold text-muted-foreground font-mono text-[12px] tabular-nums px-6 border-r border-border/40">
                        {item.entryPrice.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="py-2 px-6 border-r border-border/40">
                         <span className="font-black text-foreground font-mono text-[12px] tabular-nums">
                           {item.currentPrice.toLocaleString('id-ID')}
                         </span>
                      </TableCell>
                      <TableCell className="py-2 px-6 border-r border-border/40">
                        <span 
                          className={cn(
                            "font-black font-mono text-[11px] tabular-nums",
                            isGain ? "text-emerald-600" : "text-rose-600"
                          )}
                        >
                          {isGain ? "+" : ""}{item.pl.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right px-6 py-2">
                        <button
                          onClick={() => removeFromWatchlist(item.ticker)}
                          className="text-muted-foreground/20 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                   <TableCell colSpan={5} className="py-16 text-center">
                      <p className="font-black text-muted-foreground/20 text-[10px] tracking-widest uppercase italic">No assets under active surveillance</p>
                   </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
