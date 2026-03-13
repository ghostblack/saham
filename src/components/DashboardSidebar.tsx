"use client"

import React from "react"
import { 
  Rocket, 
  Zap, 
  TrendingUp, 
  Eye, 
  Calculator, 
  History, 
  LogOut,
  Users
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: any) => void
  isAdmin: boolean
  onLogout: () => void
  currentUser: string
}

export function DashboardSidebar({ 
  activeTab, 
  setActiveTab, 
  isAdmin, 
  onLogout,
  currentUser 
}: SidebarProps) {
  const navItems = [
    { id: 'screener_awan', label: 'Diatas Awan', icon: Rocket, group: 'Screening' },
    { id: 'screener_bottom', label: 'Cari Bottom', icon: Zap, group: 'Screening' },
    { id: 'screener_turnaround', label: 'Turnaround', icon: TrendingUp, group: 'Screening' },
    { id: 'watchlist', label: 'Watchlist', icon: Eye, group: 'Personal' },
    { id: 'analysis', label: 'Trade Setup', icon: Calculator, group: 'Personal' },
    { id: 'history', label: 'Journal', icon: History, group: 'Personal' },
  ]

  const groupedItems = navItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {} as Record<string, typeof navItems>)

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-background transition-all">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-6 py-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <Rocket className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground font-serif italic">carisaham</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Master the Market</p>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          {Object.entries(groupedItems).map(([group, items], idx) => (
            <div key={group} className={cn("mb-8", idx === 0 && "mt-2")}>
              <h2 className="mb-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                {group}
              </h2>
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-3 rounded-xl px-4 py-6 text-sm font-semibold transition-all hover:bg-muted/50",
                        isActive ? "bg-primary/5 text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <item.icon className={cn("h-4 w-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground")} />
                      {item.label}
                      {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}

          {isAdmin && (
            <div className="mb-8">
              <h2 className="mb-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                Administration
              </h2>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 rounded-xl px-4 py-6 text-sm font-semibold transition-all hover:bg-muted/50",
                  activeTab === 'admin' ? "bg-primary/5 text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab('admin')}
              >
                <Users className={cn("h-4 w-4", activeTab === 'admin' ? "text-primary" : "text-muted-foreground/60")} />
                User Panel
                {activeTab === 'admin' && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Button>
            </div>
          )}
        </ScrollArea>

        <div className="mt-auto border-t border-border p-4 bg-muted/20">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground font-black text-background uppercase text-xs">
              {currentUser.substring(0, 2)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-foreground truncate max-w-[120px] tracking-tight">{currentUser}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{isAdmin ? "Admin" : "Trader"}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground/60 hover:bg-red-50 hover:text-red-600 transition-colors"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </aside>
  )
}
