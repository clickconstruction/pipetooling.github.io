import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { ACTIVITY_FILTERS, filterActivity, type ActivityFilter } from '../../lib/jobActivityFilter'
import {
  fetchCustomerSummaryActivity,
  type CustomerSummaryData,
  type CustomerSummaryItem,
} from '../../lib/customerSummaryActivity'
import { eventRenderMeta } from '../../lib/jobActivityEvent'
import { firstNonEmptyFieldValueSummary } from '../../lib/reportForViewFromJobLedgerRow'
import { getDispatchNoteDisplayMeta } from '../../utils/dispatchNoteDisplay'
import ReportViewModal, { type ReportForView } from '../ReportViewModal'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'

type CustomerHeaderRow = {
  name: string
  address: string | null
  contact_info: unknown
}

const filterChipStyle = (active: boolean): CSSProperties => ({
  padding: '0.25rem 0.7rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: active ? '1px solid #2563eb' : '1px solid var(--border-strong)',
  borderRadius: 999,
  background: active ? '#2563eb' : 'var(--surface)',
  color: active ? '#fff' : 'var(--text-700)',
  cursor: 'pointer',
})

const jobChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-blue-700)',
  background: 'var(--bg-blue-tint)',
  borderRadius: 4,
  padding: '0.05rem 0.35rem',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function contactStrings(contactInfo: unknown): string[] {
  if (contactInfo == null || typeof contactInfo !== 'object' || Array.isArray(contactInfo)) return []
  const out: string[] = []
  for (const v of Object.values(contactInfo as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out.push(v.trim())
  }
  return out.slice(0, 4)
}

function ItemRow({ it, onOpenReport }: { it: CustomerSummaryItem; onOpenReport: (r: ReportForView) => void }) {
  const jobChip = (
    <span style={jobChipStyle} title={`${it.jobNumberLabel}${it.jobAddress ? ` · ${it.jobAddress}` : ''}`}>
      #{it.jobNumberLabel}
      {it.jobAddress ? ` · ${it.jobAddress}` : ''}
    </span>
  )
  const inner = it.inner
  if (inner.kind === 'note') {
    const n = inner.note
    const meta = getDispatchNoteDisplayMeta(n.created_at)
    return (
      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', color: 'var(--text-muted)', marginBottom: 2 }}>
          {jobChip}
          <strong style={{ color: 'var(--text-strong)' }}>{n.author?.name?.trim() || 'Unknown'}</strong>
          <span>
            {meta.weekdayTimeChicago} · {meta.daysAgoLabel}
          </span>
        </div>
        <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap' }}>{n.body}</div>
      </li>
    )
  }
  if (inner.kind === 'report') {
    const r = inner.report
    const meta = getDispatchNoteDisplayMeta(r.created_at)
    return (
      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', borderLeft: '3px solid #6366f1', paddingLeft: '0.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', color: 'var(--text-muted)', marginBottom: 2 }}>
          {jobChip}
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#6366f1' }}>
            Report
          </span>
          <strong style={{ color: 'var(--text-strong)' }}>{r.created_by_name?.trim() || 'Unknown'}</strong>
          <span>
            {meta.weekdayTimeChicago} · {meta.daysAgoLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenReport(r)}
          aria-label={`Open report ${r.template_name} for job ${it.jobNumberLabel}`}
          style={{
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
            color: 'var(--text-gray-800)',
          }}
        >
          <strong>{r.template_name}</strong>
          {' — '}
          {firstNonEmptyFieldValueSummary(r, 160) || 'View report'}
        </button>
      </li>
    )
  }
  if (inner.kind === 'event') {
    const ev = inner.event
    const meta = eventRenderMeta(ev.type)
    const ts = getDispatchNoteDisplayMeta(ev.occurredAt)
    return (
      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', borderLeft: `3px solid ${meta.borderColor}`, paddingLeft: '0.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', color: 'var(--text-muted)', marginBottom: 2 }}>
          {jobChip}
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: meta.tagColor }}>
            {meta.tag}
          </span>
          <strong style={{ color: 'var(--text-strong)' }}>{ev.actorName?.trim() || 'System'}</strong>
          <span>
            {ts.weekdayTimeChicago} · {ts.daysAgoLabel}
          </span>
        </div>
        <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap' }}>{ev.summary}</div>
      </li>
    )
  }
  if (inner.kind === 'schedule_block') {
    const b = inner.schedule
    const ts = getDispatchNoteDisplayMeta(b.sortAt)
    return (
      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', borderLeft: '3px solid #0ea5e9', paddingLeft: '0.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', color: 'var(--text-muted)', marginBottom: 2 }}>
          {jobChip}
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#0ea5e9' }}>
            Schedule
          </span>
          <span>
            {ts.weekdayTimeChicago} · {ts.daysAgoLabel}
          </span>
        </div>
        <div style={{ color: 'var(--text-gray-800)' }}>
          {b.assigneeLabels} — {b.work_date} {b.time_start}–{b.time_end}
        </div>
        {b.note ? (
          <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap', marginTop: 4 }}>{b.note}</div>
        ) : null}
      </li>
    )
  }
  if (inner.kind === 'clock_session') {
    const c = inner.clock
    const ts = getDispatchNoteDisplayMeta(c.sortAt)
    return (
      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', borderLeft: '3px solid #16a34a', paddingLeft: '0.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', color: 'var(--text-muted)', marginBottom: 2 }}>
          {jobChip}
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#16a34a' }}>
            Clock
          </span>
          <strong style={{ color: 'var(--text-strong)' }}>{c.personName}</strong>
          <span>
            {ts.weekdayTimeChicago} · {ts.daysAgoLabel}
          </span>
        </div>
        <div style={{ color: 'var(--text-gray-800)' }}>
          {c.clockedOutAt ? 'Clocked session' : 'On the clock'}
          {c.durationHours != null ? ` · ${c.durationHours.toFixed(2)}h` : ''}
        </div>
      </li>
    )
  }
  return null
}

/**
 * Customer Summary: customer details up top, then every interaction across the
 * customer's jobs (notes, reports, schedule, clock, system events) with the
 * Job Detail filter chips and each line tagged `#job · address`.
 */
export default function CustomerSummaryModal({
  customerId,
  onClose,
}: {
  customerId: string
  onClose: () => void
}) {
  const [header, setHeader] = useState<CustomerHeaderRow | null>(null)
  const [data, setData] = useState<CustomerSummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [viewReport, setViewReport] = useState<ReportForView | null>(null)

  useEffect(() => {
    let cancelled = false
    setHeader(null)
    setData(null)
    setError(null)
    void (async () => {
      const [headerRaw, summary] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase.from('customers').select('name, address, contact_info').eq('id', customerId).maybeSingle(),
          'customer summary header',
        ).catch(() => null),
        fetchCustomerSummaryActivity(customerId),
      ])
      if (cancelled) return
      setHeader((headerRaw ?? null) as CustomerHeaderRow | null)
      setData(summary.data)
      setError(summary.error)
    })()
    return () => {
      cancelled = true
    }
  }, [customerId])

  const visibleItems = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.items
    const keep = new Set(filterActivity(data.items.map((i) => i.inner), filter))
    return data.items.filter((i) => keep.has(i.inner))
  }, [data, filter])

  const contacts = contactStrings(header?.contact_info)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1004,
        padding: '1rem',
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-summary-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          padding: '1rem',
          maxWidth: 640,
          width: '96%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="customer-summary-title" style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>
              Customer Summary
            </h2>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)', marginTop: 4 }}>
              {header?.name ?? '…'}
            </div>
            {header?.address?.trim() ? (
              <button
                type="button"
                onClick={() =>
                  openInExternalBrowser(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(header.address ?? '')}`,
                  )
                }
                style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'underline', textAlign: 'left' }}
              >
                {header.address}
              </button>
            ) : null}
            {contacts.map((c) => (
              <div key={c} style={{ fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                {c}
              </div>
            ))}
            {data ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {data.jobs.length} {data.jobs.length === 1 ? 'job' : 'jobs'}
                {data.truncated ? ' (newest shown)' : ''}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customer summary"
            style={{ flexShrink: 0, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Close
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Filter interactions">
          {ACTIVITY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              style={filterChipStyle(filter === f.value)}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {error ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{error}</p>
          ) : data == null ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading interactions…</p>
          ) : visibleItems.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No interactions{filter === 'all' ? '' : ' in this category'}.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {visibleItems.map((it, idx) => (
                <ItemRow key={`${it.jobId}-${idx}`} it={it} onOpenReport={setViewReport} />
              ))}
            </ul>
          )}
        </div>
      </div>
      {viewReport ? <ReportViewModal open report={viewReport} onClose={() => setViewReport(null)} /> : null}
    </div>
  )
}
