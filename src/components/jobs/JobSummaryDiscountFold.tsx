import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { jobSummaryDiscountLeakage, type DiscountEventInput, type DiscountLeakageLine, type DiscountLeakageRowInput } from '../../lib/jobs/jobSummaryDiscounts'

const INK = '#0f7a52'
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`)

const TH: CSSProperties = { textAlign: 'left', fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.25rem 0.4rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }
const TD: CSSProperties = { padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem' }
const R: CSSProperties = { textAlign: 'right' }

/**
 * Job Summary → the discount fold (v2.3275): opened from the "− $X discounted
 * on N jobs" chip. Headline = share of revenue for the jobs in view; then the
 * same share per reason (the rows' reason chips) and per giver (the
 * discount_added trail — the events carry the dollars and the actor).
 * Fetches the events for the visible jobs (chunked) and the actors' names;
 * the math is the pure kernel.
 */
export function JobSummaryDiscountFold({ rows }: { rows: readonly DiscountLeakageRowInput[] }) {
  const jobIds = useMemo(() => rows.filter((r) => r.discountUsd > 0).map((r) => r.job.id), [rows])
  const idsKey = jobIds.join(',')
  const [events, setEvents] = useState<DiscountEventInput[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    if (jobIds.length === 0) {
      setEvents([])
      return
    }
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const all: DiscountEventInput[] = []
        for (let i = 0; i < jobIds.length; i += 200) {
          const chunk = jobIds.slice(i, i + 200)
          const data = await withSupabaseRetry(
            async () => await supabase.from('job_activity_events').select('job_id, actor_user_id, detail').eq('event_type', 'discount_added').in('job_id', chunk),
            'Job Summary discount events',
          )
          for (const e of (data ?? []) as Array<{ job_id: string; actor_user_id: string | null; detail: unknown }>) {
            all.push({ job_id: e.job_id, actor_user_id: e.actor_user_id, detail: e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail) ? (e.detail as Record<string, unknown>) : null })
          }
        }
        const actorIds = [...new Set(all.map((e) => e.actor_user_id).filter((v): v is string => !!v))]
        const nameMap = new Map<string, string>()
        if (actorIds.length > 0) {
          const users = await withSupabaseRetry(async () => await supabase.from('users').select('id, name').in('id', actorIds), 'Job Summary discount givers')
          for (const u of (users ?? []) as Array<{ id: string; name: string | null }>) nameMap.set(u.id, (u.name ?? '').trim() || 'Someone')
        }
        if (cancelled) return
        setEvents(all)
        setNames(nameMap)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey is the stable identity of jobIds
  }, [idsKey])

  const leak = useMemo(() => jobSummaryDiscountLeakage({ rows, events, actorNames: names }), [rows, events, names])
  if (leak.jobs === 0) return null
  return (
    <div data-testid="job-summary-discount-fold" style={{ marginTop: '0.5rem', padding: '0.6rem 0.8rem', border: '1px dashed #a7dcc2', borderRadius: 8, background: 'var(--bg-green-100)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <strong style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
          {money(leak.givenUsd)} given away · <span style={{ color: INK }}>{pct(leak.sharePct)}</span> of {money(leak.revenueUsd)} revenue
        </strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          this window · {leak.jobs} of {leak.jobsInView} jobs{loading ? ' · reading the trail…' : ''}
        </span>
      </div>
      {error ? <div style={{ fontSize: '0.75rem', color: 'var(--text-red-700)' }}>Couldn't read who gave them: {error}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: '0.75rem' }}>
        <Table title="Reason" lines={leak.byReason} shareHead="Of revenue" />
        {leak.byGiver.length > 0 ? <Table title="Given by" lines={leak.byGiver} shareHead="Of their billed" /> : null}
      </div>
    </div>
  )
}

function Table({ title, lines, shareHead }: { title: string; lines: DiscountLeakageLine[]; shareHead: string }) {
  const max = Math.max(...lines.map((l) => l.givenUsd), 0)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={TH}>{title}</th>
          <th style={{ ...TH, ...R }}>Jobs</th>
          <th style={{ ...TH, ...R }}>Given</th>
          <th style={{ ...TH, ...R }}>{shareHead}</th>
          <th style={{ ...TH, width: 70 }} aria-hidden />
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key}>
            <td style={TD}>{l.label}</td>
            <td style={{ ...TD, ...R }}>{l.jobs}</td>
            <td style={{ ...TD, ...R }}>{money(l.givenUsd)}</td>
            <td style={{ ...TD, ...R }}>{pct(l.sharePct)}</td>
            <td style={TD}>
              <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${max > 0 ? (l.givenUsd / max) * 100 : 0}%`, background: INK }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
