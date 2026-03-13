"use client"

import React, { useState, useMemo } from "react"
import { Users, Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"

export function AdminPanel({
  adminUsers,
  newUsername,
  setNewUsername,
  newPassword,
  setNewPassword,
  newLimitType,
  setNewLimitType,
  newLimitValue,
  setNewLimitValue,
  handleAddUser,
  handleDeleteUser
}: any) {
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc' | null}>({ key: 'id', direction: 'asc' })

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'desc'
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc'
    else if (sortConfig.key === key && sortConfig.direction === 'asc') direction = null
    setSortConfig({ key, direction })
  }

  const sortedUsers = useMemo(() => {
    let items = [...adminUsers]
    if (sortConfig.direction !== null) {
      items.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return items
  }, [adminUsers, sortConfig])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={10} className="ml-1 opacity-20" />
    if (sortConfig.direction === 'asc') return <ArrowUp size={10} className="ml-1 text-primary" />
    if (sortConfig.direction === 'desc') return <ArrowDown size={10} className="ml-1 text-primary" />
    return <ArrowUpDown size={10} className="ml-1 opacity-20" />
  }

  return (
    <div className="space-y-8 pb-10 border-t border-border/40 pt-6">
      <div className="flex flex-col gap-1 px-2">
        <h2 className="text-2xl font-black tracking-tighter text-foreground font-serif italic text-primary">Administration</h2>
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">System Registry & Access Control</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-0 border border-border/60 divide-x divide-border/60">
        {/* Provisioning Form (Flat) */}
        <div className="xl:col-span-1 p-6 bg-muted/5">
          <div className="flex items-center gap-2 mb-6 text-[11px] font-black uppercase tracking-widest text-primary">
            <Plus className="h-3.5 w-3.5" />
            Provision Account
          </div>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Identity</label>
              <Input 
                 value={newUsername} 
                 onChange={(e) => setNewUsername(e.target.value)} 
                 placeholder="trader_id" 
                 className="h-9 rounded-none border border-border/60 bg-white font-semibold text-xs focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Passphrase</label>
              <Input 
                 value={newPassword} 
                 onChange={(e) => setNewPassword(e.target.value)} 
                 placeholder="Secure-Token" 
                 className="h-9 rounded-none border border-border/60 bg-white font-semibold text-xs focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Type</label>
                <select 
                  value={newLimitType}
                  onChange={(e) => setNewLimitType(e.target.value as any)}
                  className="w-full border border-border/60 bg-white h-9 px-2 text-[11px] font-black uppercase tracking-tight focus:ring-1 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="subscription">Subscription</option>
                  <option value="quota">Quota</option>
                </select>
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Value</label>
                <Input 
                   type="number"
                   value={newLimitValue} 
                   onChange={(e) => setNewLimitValue(Number(e.target.value))} 
                   className="h-9 rounded-none border border-border/60 bg-white font-semibold text-xs"
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-9 rounded-none bg-primary font-black uppercase tracking-widest text-[10px] hover:bg-primary/90 transition-all">
              Commit Entry
            </Button>
          </form>
        </div>

        {/* Registry Table (Flat) */}
        <div className="xl:col-span-3">
          <div className="flex items-center justify-between p-4 border-b border-border/60 bg-muted/5">
            <div className="text-[11px] font-black uppercase tracking-widest">Member Registry</div>
            <div className="text-[9px] font-black text-muted-foreground/60 border border-border/40 px-2 py-0.5 uppercase">
              {adminUsers.length} Recorded
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/5 border-b border-border/80">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead 
                    className="h-10 text-[9px] font-black uppercase tracking-widest py-0 px-6 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center justify-between">Entity <SortIcon column="id" /></div>
                  </TableHead>
                  <TableHead 
                    className="h-10 text-[9px] font-black uppercase tracking-widest py-0 cursor-pointer hover:bg-muted/10 transition-colors border-r border-border/40 px-6"
                    onClick={() => handleSort('limitType')}
                  >
                    <div className="flex items-center justify-between">Access <SortIcon column="limitType" /></div>
                  </TableHead>
                  <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest py-0 text-right px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((u: any) => (
                  <TableRow key={u.id} className="border-b border-border/40 group transition-all hover:bg-muted/5">
                    <TableCell className="px-6 py-2 border-r border-border/40">
                      <p className="font-black text-foreground text-[13px] tracking-tight">{u.id}</p>
                    </TableCell>
                    <TableCell className="py-2 px-6 border-r border-border/40">
                       <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                         {u.limitType === 'quota' ? `${u.quota} Units` : `EXP: ${u.validUntil || 'PERMANENT'}`}
                       </p>
                    </TableCell>
                    <TableCell className="text-right px-6 py-2">
                       {u.id !== 'admin' && (
                         <button 
                           onClick={() => handleDeleteUser(u.id)}
                           className="text-muted-foreground/20 hover:text-red-500 transition-colors"
                         >
                           <Trash2 size={13} />
                         </button>
                       )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
