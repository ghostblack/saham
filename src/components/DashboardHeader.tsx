"use client"

import React from "react"
import { Search, Bell, Settings, User, LogOut } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HeaderProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  currentUser: string
  userUsageInfo: string
  onLogout: () => void
}

export function DashboardHeader({
  searchQuery,
  setSearchQuery,
  currentUser,
  userUsageInfo,
  onLogout
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/90 px-6 backdrop-blur-md">
      <div className="relative w-64 max-w-full">
        <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/30" />
        <Input
          placeholder="Search..."
          className="pl-9 h-8 w-full rounded-none border border-border/40 bg-muted/20 font-semibold text-foreground placeholder:text-muted-foreground/20 focus-visible:ring-1 focus-visible:ring-primary/10 transition-all text-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-[11px] font-black text-foreground leading-none tracking-tight">{currentUser}</p>
          <p className="text-[8px] font-black text-primary mt-0.5 uppercase tracking-widest opacity-60">{userUsageInfo}</p>
        </div>

        <button className="h-8 w-8 text-muted-foreground/40 hover:text-primary transition-all flex items-center justify-center">
          <Bell className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative h-8 w-8 bg-foreground text-background font-black uppercase text-[10px] flex items-center justify-center hover:bg-primary transition-all">
              {currentUser.substring(0, 2)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-none border border-border bg-card p-0 mt-1 shadow-none">
            <DropdownMenuLabel className="font-black text-[9px] uppercase tracking-widest text-muted-foreground p-3 border-b border-border/40">Member Access</DropdownMenuLabel>
            <DropdownMenuItem className="gap-3 cursor-pointer font-bold text-xs rounded-none py-3 px-4 transition-colors hover:bg-muted/30">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 cursor-pointer font-black text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-none py-3 px-4 transition-colors border-t border-border/40" onClick={onLogout}>
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
