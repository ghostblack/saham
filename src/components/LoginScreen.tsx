"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ShieldCheck, Zap, Lock } from "lucide-react"

export function LoginScreen({
  loginUsername,
  setLoginUsername,
  loginPassword,
  setLoginPassword,
  loginError,
  handleLogin
}: any) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 selection:bg-primary/10">
      {/* Soft Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute top-[15%] left-[10%] h-[30%] w-[30%] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[15%] right-[10%] h-[30%] w-[30%] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <Card className="z-10 w-full max-w-md border-border bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] rounded-[2rem] overflow-hidden">
        <CardHeader className="flex flex-col items-center space-y-4 pb-8 pt-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted/30 p-1 ring-1 ring-border shadow-sm overflow-hidden group">
            <img 
               src="https://ik.imagekit.io/gambarid/Carisaham/WhatsApp%20Image%202026-03-10%20at%2004.00.08.jpeg" 
               alt="Nexus Stock" 
               className="h-full w-full object-cover rounded-2xl group-hover:scale-110 transition-transform duration-500"
            />
          </div>
          <div className="text-center">
            <CardTitle className="text-3xl font-black tracking-tight text-foreground font-serif italic">
              carisaham.net
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground/40 mt-1">
              Private Terminal
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-10 pb-12">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Identifier</label>
              </div>
              <Input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Username"
                className="h-14 rounded-2xl bg-muted/20 border-border/50 text-sm font-semibold focus-visible:ring-primary/20 placeholder:text-muted-foreground/30"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Authorization Key</label>
              </div>
              <div className="relative">
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 rounded-2xl bg-muted/20 border-border/50 text-sm font-semibold focus-visible:ring-primary/20 placeholder:text-muted-foreground/30"
                  required
                />
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20" />
              </div>
            </div>
            {loginError && (
              <div className="rounded-xl bg-red-50 p-4 text-center text-xs font-bold text-red-500 border border-red-100 animate-in fade-in zoom-in duration-300">
                {loginError}
              </div>
            )}
            <Button type="submit" className="h-14 w-full rounded-2xl bg-primary font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.98] text-sm">
              Enter Terminal
            </Button>
          </form>
          
          <div className="mt-10 flex items-center justify-between px-2 pt-8 border-t border-border/50">
            <div className="flex items-center gap-1.5 grayscale opacity-40">
              <ShieldCheck className="h-4 w-4 text-foreground" />
              <span className="text-[9px] font-black uppercase tracking-widest text-foreground">Verified</span>
            </div>
            <div className="flex items-center gap-1.5 grayscale opacity-40">
              <Zap className="h-4 w-4 text-foreground" />
              <span className="text-[9px] font-black uppercase tracking-widest text-foreground">Optimized</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <p className="fixed bottom-8 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/20 pointer-events-none">
        Secure Access Protocol © 2026
      </p>
    </div>
  )
}
