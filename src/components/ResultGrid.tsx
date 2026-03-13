"use client"

import React from "react"
import { ResultTable } from "./ResultTable"

export function ResultGrid({ 
  results, 
  loading, 
  activeTab, 
  isSaved, 
  onSave, 
  onAnalyze,
  searchQuery
}: any) {
  return (
    <ResultTable
      results={results}
      loading={loading}
      activeTab={activeTab}
      isSaved={isSaved}
      onSave={onSave}
      onAnalyze={onAnalyze}
      searchQuery={searchQuery}
    />
  )
}
