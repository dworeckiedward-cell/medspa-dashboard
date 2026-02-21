'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, Search, ToggleLeft, ToggleRight, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ServiceAlias, ClientService } from '@/lib/types/domain'

interface ServiceAliasManagerProps {
  initialAliases: ServiceAlias[]
  services: ClientService[]
}

export function ServiceAliasManager({
  initialAliases,
  services,
}: ServiceAliasManagerProps) {
  const [aliases, setAliases] = useState<ServiceAlias[]>(initialAliases)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [newAlias, setNewAlias] = useState('')
  const [newServiceId, setNewServiceId] = useState('')
  const [saving, setSaving] = useState(false)

  const activeServices = services.filter((s) => s.isActive)

  const filtered = search
    ? aliases.filter(
        (a) =>
          a.aliasText.toLowerCase().includes(search.toLowerCase()) ||
          (a.serviceName ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : aliases

  const handleAdd = useCallback(async () => {
    if (!newAlias.trim() || !newServiceId) return
    setSaving(true)
    try {
      const res = await fetch('/api/service-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aliasText: newAlias.trim(), serviceId: newServiceId }),
      })
      if (res.ok) {
        const { alias } = await res.json()
        // Enrich with service name
        const svc = services.find((s) => s.id === alias.serviceId)
        setAliases((prev) => [...prev, { ...alias, serviceName: svc?.name }])
        setNewAlias('')
        setNewServiceId('')
        setAdding(false)
      }
    } finally {
      setSaving(false)
    }
  }, [newAlias, newServiceId, services])

  const handleToggle = useCallback(async (alias: ServiceAlias) => {
    const newActive = !alias.isActive
    // Optimistic update
    setAliases((prev) =>
      prev.map((a) => (a.id === alias.id ? { ...a, isActive: newActive } : a)),
    )
    await fetch(`/api/service-aliases/${alias.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: newActive }),
    })
  }, [])

  const handleDelete = useCallback(async (aliasId: string) => {
    setAliases((prev) => prev.filter((a) => a.id !== aliasId))
    await fetch(`/api/service-aliases/${aliasId}`, { method: 'DELETE' })
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Service Aliases</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-0.5">
              <Info className="h-3 w-3" />
              Map common terms to services for better attribution in reports
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding((v) => !v)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add alias
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add form */}
        {adding && (
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 space-y-2">
            <Input
              placeholder="Alias text (e.g. &quot;lip filler&quot;, &quot;tox&quot;)"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              className="h-9 text-sm"
            />
            <select
              value={newServiceId}
              onChange={(e) => setNewServiceId(e.target.value)}
              className="w-full h-9 rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 text-sm text-[var(--brand-text)]"
            >
              <option value="">Select service...</option>
              {activeServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.category ? `(${s.category})` : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="brand"
                onClick={handleAdd}
                disabled={!newAlias.trim() || !newServiceId || saving}
                className="text-xs"
              >
                {saving ? 'Saving...' : 'Save alias'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setAdding(false); setNewAlias(''); setNewServiceId('') }}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Search */}
        {aliases.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--brand-muted)]" />
            <Input
              placeholder="Filter aliases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--brand-muted)] text-center py-6">
            {aliases.length === 0
              ? 'No aliases configured yet. Add one to improve service attribution.'
              : 'No aliases match your search.'}
          </p>
        ) : (
          <div className="divide-y divide-[var(--brand-border)] rounded-lg border border-[var(--brand-border)] overflow-hidden">
            {filtered.map((alias) => (
              <div
                key={alias.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-[var(--brand-surface)]"
              >
                {/* Alias text */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--brand-text)] truncate">
                    &ldquo;{alias.aliasText}&rdquo;
                  </p>
                  <p className="text-[10px] text-[var(--brand-muted)] mt-0.5 truncate">
                    → {alias.serviceName ?? 'Unknown service'}
                  </p>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(alias)}
                  className="shrink-0 text-[var(--brand-muted)] hover:text-[var(--brand-text)] transition-colors"
                  aria-label={alias.isActive ? 'Deactivate alias' : 'Activate alias'}
                >
                  {alias.isActive ? (
                    <ToggleRight className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(alias.id)}
                  className="shrink-0 text-[var(--brand-muted)] hover:text-rose-500 transition-colors"
                  aria-label="Delete alias"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
