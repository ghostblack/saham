"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"

interface StockLogoProps {
  ticker: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
}

export function StockLogo({ ticker, size = "md", className }: StockLogoProps) {
  const [error, setError] = useState(false)
  
  // Size mapping
  const sizeClasses = {
    xs: "h-4 w-4 text-[7px]",
    sm: "h-6 w-6 text-[9px]",
    md: "h-8 w-8 text-[11px]",
    lg: "h-12 w-12 text-[14px]",
    xl: "h-16 w-16 text-[18px]",
  }

  const logoUrl = `https://assets.stockbit.com/logos/companies/${ticker}.png`
  const initials = ticker.substring(0, 2).toUpperCase()

  return (
    <div 
      className={cn(
        "flex items-center justify-center shrink-0 overflow-hidden font-black border border-border/40 bg-muted/5 tracking-tighter",
        sizeClasses[size],
        className
      )}
    >
      {!error ? (
        <img
          src={logoUrl}
          alt={ticker}
          className="h-full w-full object-contain"
          onError={() => setError(true)}
        />
      ) : (
        <span className="text-muted-foreground/30 opacity-60">
          {initials}
        </span>
      )}
    </div>
  )
}
