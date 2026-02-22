'use client'

import { useState } from 'react'
import { Send, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { buildTenantApiUrl } from '@/lib/dashboard/tenant-api'
import { CATEGORY_LABELS, PRIORITY_LABELS } from '@/lib/support/types'
import type { RequestCategory, RequestPriority } from '@/lib/support/types'

interface RequestFormProps {
  tenantSlug: string
  onCreated?: (requestId: string, shortCode: string) => void
}

const CATEGORIES: RequestCategory[] = [
  'bug', 'improvement', 'question', 'data_issue',
  'integration_issue', 'billing_question', 'other',
]

const PRIORITIES: RequestPriority[] = ['low', 'normal', 'high', 'urgent']

const PRIORITY_COLORS: Record<RequestPriority, string> = {
  low: 'text-gray-500 border-gray-300 dark:border-gray-600',
  normal: 'text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700',
  high: 'text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700',
  urgent: 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-700',
}

export function RequestForm({ tenantSlug, onCreated }: RequestFormProps) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<RequestCategory>('question')
  const [priority, setPriority] = useState<RequestPriority>('normal')
  const [description, setDescription] = useState('')
  const [pagePath, setPagePath] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) return

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(buildTenantApiUrl('/api/support', tenantSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          description: description.trim(),
          pagePath: pagePath.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Request failed (${res.status})`)
      }

      const data = await res.json()
      setSuccess(`Request ${data.shortCode} created successfully.`)
      setSubject('')
      setDescription('')
      setPagePath('')
      setPriority('normal')
      setCategory('question')
      onCreated?.(data.requestId, data.shortCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">New Support Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-[var(--brand-muted)] block mb-1.5">
              Subject
            </label>
            <Input
              placeholder="Brief summary of your issue..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-[var(--brand-muted)] block mb-1.5">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                      category === cat
                        ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                        : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-text)]',
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--brand-muted)] block mb-1.5">
                Priority
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                      priority === p
                        ? PRIORITY_COLORS[p] + ' bg-current/10 border-current'
                        : 'border-[var(--brand-border)] text-[var(--brand-muted)] hover:text-[var(--brand-text)]',
                    )}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[var(--brand-muted)] block mb-1.5">
              Description
            </label>
            <Textarea
              placeholder="Describe your issue, what you expected, and what happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={5}
              required
            />
          </div>

          {/* Optional: affected page */}
          <div>
            <label className="text-xs font-medium text-[var(--brand-muted)] block mb-1.5">
              Affected Page <span className="text-[var(--brand-muted)]">(optional)</span>
            </label>
            <Input
              placeholder="/dashboard/reports"
              value={pagePath}
              onChange={(e) => setPagePath(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 text-[10px]">
                Created
              </Badge>
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !subject.trim() || !description.trim()}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-colors',
              'bg-[var(--brand-primary)] text-white hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
