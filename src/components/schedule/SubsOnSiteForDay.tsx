/**
 * Subs on site for one day (v2.2929): on the dispatch Day tab, above the
 * crew — who is on which job by their signed work order's picked dates, plus
 * the maybes (windows with no pick yet). "Add a site visit ›" arms the hub's
 * place-a-job mode for that job so the dispatcher drops a real block on a
 * superintendent's lane.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSubOrdersForRange } from '../../lib/subs/subDispatchFetch'
import { subsOnDay, type SubDispatchOrder } from '../../lib/subs/subDispatch'

export function SubsOnSiteForDay({ dayKey }: { dayKey: string }) {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<SubDispatchOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetchSubOrdersForRange(dayKey, dayKey)
      if (cancelled) return
      setOrders(res.data)
      setError(res.error)
    })()
    return () => {
      cancelled = true
    }
  }, [dayKey])
  const { definite, maybe } = subsOnDay(orders, dayKey)
  if (error || (definite.length === 0 && maybe.length === 0)) return null
  const row = (it: (typeof definite)[number], sure: boolean) => (
    <div key={it.orderId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '0.3rem 0', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
      <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: sure ? 'var(--bg-green-tint)' : 'var(--bg-subtle)', color: sure ? 'var(--text-green-700)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
        {sure ? 'Sub' : it.span.kind === 'offered' ? 'Offer out' : 'Window'}
      </span>
      <span style={{ fontWeight: 600 }}>{it.personName}</span>
      <span style={{ color: 'var(--text-muted)' }}>{it.label}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{sure ? 'picked' : 'not picked yet'} · {it.span.start === it.span.end ? it.span.start : `${it.span.start} → ${it.span.end}`}</span>
      {sure && it.jobId ? (
        <button
          type="button"
          onClick={() => navigate(`/schedule-dispatch?placeJob=${encodeURIComponent(it.jobId!)}&hubTab=people`)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-blue-700)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          title="Place this job on a crew member's day — a real block on their lane"
        >
          Add a site visit ›
        </button>
      ) : null}
    </div>
  )
  return (
    <div data-testid="subs-on-site" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.7rem', marginBottom: '0.75rem', background: 'var(--surface)' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Subs on site · {definite.length}{maybe.length > 0 ? ` · ${maybe.length} maybe` : ''}
      </div>
      {definite.map((it) => row(it, true))}
      {maybe.map((it) => row(it, false))}
    </div>
  )
}

export default SubsOnSiteForDay
