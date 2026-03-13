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
  Users,
  LayoutDashboard,
  Search
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavigationProps {
  activeTab: string
  setActiveTab: (tab: any) => void
  isAdmin: boolean
  onLogout: () => void
  currentUser: string
}

export function Navigation({ 
  activeTab, 
  setActiveTab, 
  isAdmin, 
  onLogout,
  currentUser 
}: NavigationProps) {
  const navItems = [
    { id: 'screener_awan', label: 'Awan', icon: Rocket },
    { id: 'screener_bottom', label: 'Bottom', icon: Zap },
    { id: 'screener_turnaround', label: 'Turnaround', icon: TrendingUp },
    { id: 'watchlist', label: 'Watch', icon: Eye },
    { id: 'analysis', label: 'Trade', icon: Calculator },
    { id: 'history', label: 'Logs', icon: History },
  ]

  return (
    <>
      {/* Desktop Top Navigation (Flat Line-Based) */}
      <nav className="fixed top-12 left-0 right-0 z-20 hidden md:block border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-center">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={cn(
                  "h-10 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-r border-border first:border-l",
                  isActive 
                    ? "bg-primary/5 text-primary border-b-2 border-b-primary" 
                    : "text-muted-foreground/40 hover:bg-muted/30 hover:text-foreground"
                )}
                onClick={() => setActiveTab(item.id)}
              >
                <div className="flex items-center gap-2">
                  <item.icon className={cn("h-3 w-3", isActive ? "text-primary" : "text-muted-foreground/20")} />
                  {item.label}
                </div>
              </button>
            );
          })}
          
          {isAdmin && (
             <button
                className={cn(
                  "h-10 px-6 text-[10px] font-black uppercase tracking-widest transition-all border-r border-border",
                  activeTab === 'admin' 
                    ? "bg-primary/5 text-primary border-b-2 border-b-primary" 
                    : "text-muted-foreground/40 hover:bg-muted/30 hover:text-foreground"
                )}
                onClick={() => setActiveTab('admin')}
              >
                <div className="flex items-center gap-2">
                  <Users className={cn("h-3 w-3", activeTab === 'admin' ? "text-primary" : "text-muted-foreground/20")} />
                  Admin
                </div>
              </button>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation (Ultra-Compact Line-Based) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 block md:hidden border-t border-border bg-background/95 backdrop-blur-md pb-safe">
        <div className="grid grid-cols-5 h-14 w-full divide-x divide-border/40">
          {[
            navItems[0], // Awan
            navItems[1], // Bottom
            navItems[2], // Turnaround
            navItems[3], // Watchlist
            isAdmin ? { id: 'admin', label: 'Admin', icon: Users } : navItems[4] // Admin or Trade
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden",
                  isActive ? "text-primary bg-primary/5" : "text-muted-foreground/30"
                )}
                onClick={() => setActiveTab(item.id)}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "scale-110" : "")} />
                <span className="text-[8px] font-black uppercase tracking-tight">{item.label}</span>
                {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  )
}
