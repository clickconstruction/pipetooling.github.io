import { useEffect, useState, type CSSProperties } from 'react'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatTallyCurrency } from '../../lib/tally/formatTallyPosted'
import { purchaseRemainder, purchaseSetAmount, purchaseToggleJob, type PurchaseDecision, type PurchaseFillInRow, type PurchaseJobOption } from '../../lib/needsYou/fillInPurchases'
import type { PurchaseFillInIo } from '../../lib/needsYou/fillInPurchasesIo'

/**
 * The purchases kind's fields on the Fill them in deck (v2.6071, punch list #178): the Sort
 * screen's picker for the holder's own charge. The jobs on the viewer's clock and schedule the
 * day the card was swiped and the day each side come as chips, read per row; one chip takes the
 * whole charge, two or more split it evenly with each amount editable and the last balancing;
 * any other job by the Assign window's search. Nothing here writes.
 */
const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0.45rem 0.6rem',
  font: 'inherit',
  fontSize: '0.875rem',
  minHeight: 36,
}
const labelStyle: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }
const blockTitle: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }

const chipStyle = (pressed: boolean): CSSProperties => ({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  padding: '0.4rem 0.65rem',
  minHeight: 40,
  borderRadius: 8,
  border: pressed ? '2px solid var(--text-link)' : '1px solid var(--border-strong)',
  background: pressed ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  textAlign: 'left',
  cursor: 'pointer',
})

export function PurchaseFields({ row, userId, decision, onChange, disabled, io }: { row: PurchaseFillInRow; userId: string | undefined; decision: PurchaseDecision; onChange: (d: PurchaseDecision) => void; disabled: boolean; io: PurchaseFillInIo }) {
  const prefixMap = useLedgerPrefixMap()
  const [dayJobs, setDayJobs] = useState<PurchaseJobOption[]>([])
  const [dayJobsLoading, setDayJobsLoading] = useState(false)
  const [dayJobsError, setDayJobsError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PurchaseJobOption[]>([])
  const [searching, setSearching] = useState(false)

  // The day's jobs, read once per row.
  useEffect(() => {
    setDayJobs([])
    setDayJobsError(null)
    setSearch('')
    setResults([])
    if (!userId || !row.swipeAtIso) return
    let cancelled = false
    setDayJobsLoading(true)
    void io.fetchDayJobs(userId, row.swipeAtIso, prefixMap).then(({ data, error }) => {
      if (cancelled) return
      setDayJobs(data)
      setDayJobsError(error)
      setDayJobsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one read per row
  }, [row.key, userId, io])

  // The search, as the Assign window runs it: three letters, then a short wait.
  useEffect(() => {
    const q = search.trim()
    if (q.length <= 2) {
      setResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      void io
        .searchJobs(q)
        .then((rows) => {
          if (cancelled) return
          setResults(rows)
          setSearching(false)
        })
        .catch(() => {
          if (cancelled) return
          setResults([])
          setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, io])

  const total = row.amount
  const picked = new Set(decision.lines.map((l) => l.jobId))
  // The chips: the day's jobs, then any job picked from a search that is not among them.
  const chips = [...dayJobs, ...Object.values(decision.jobs).filter((j) => !dayJobs.some((d) => d.id === j.id))]
  const remainder = purchaseRemainder(decision, total)
  const toggle = (job: PurchaseJobOption) => onChange(purchaseToggleJob(decision, total, job))

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-purchase-fields>
      <div>
        <div style={blockTitle}>Which job was it for?</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Your jobs from the day before the swipe through the day after. Tap two to split it.</div>
        {dayJobsLoading ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading your days…</div>
        ) : chips.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{dayJobsError ?? 'Nothing on your clock or schedule those days. Search for the job below.'}</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Your jobs those days">
            {chips.map((j) => {
              const on = picked.has(j.id)
              const line = decision.lines.find((l) => l.jobId === j.id)
              return (
                <button key={j.id} type="button" aria-pressed={on} disabled={disabled} onClick={() => toggle(j)} style={chipStyle(on)} data-purchase-chip={j.id}>
                  <span>
                    {j.main}
                    {on && decision.lines.length > 1 && line ? <span style={{ marginLeft: 8, color: 'var(--text-blue-700)' }}>{formatTallyCurrency(Math.abs(line.amount))}</span> : null}
                  </span>
                  {j.address ? <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>{j.address}</span> : null}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {decision.lines.length > 1 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.6rem', background: 'var(--bg-subtle)' }} data-purchase-split>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Split · starts even, edit any amount</div>
          {decision.lines.map((l) => {
            const job = decision.jobs[l.jobId]
            const name = job?.main ?? l.jobId.slice(0, 8)
            return (
              <div key={l.jobId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  disabled={disabled}
                  value={Math.abs(l.amount).toFixed(2)}
                  aria-label={`Amount for ${name}`}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) onChange(purchaseSetAmount(decision, total, l.jobId, v))
                  }}
                  style={{ ...inputStyle, width: 110, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
            )
          })}
          {remainder !== 0 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>{formatTallyCurrency(Math.abs(remainder))} unallocated. The amounts must add up to the charge.</div> : null}
        </div>
      ) : null}
      <label>
        <span style={labelStyle}>Another job</span>
        <input value={search} disabled={disabled} onChange={(e) => setSearch(e.target.value)} placeholder="Job number, name or address" style={inputStyle} aria-label="Another job" />
      </label>
      {search.trim().length > 2 ? (
        searching ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</div>
        ) : results.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing matches. Try the job number or the street.</div>
        ) : (
          <div style={{ display: 'grid', gap: 4 }} role="listbox" aria-label="Jobs found">
            {results.slice(0, 8).map((j) => (
              <button
                key={j.id}
                type="button"
                role="option"
                aria-selected={picked.has(j.id)}
                disabled={disabled}
                onClick={() => {
                  if (!picked.has(j.id)) toggle(j)
                  setSearch('')
                }}
                style={{ ...chipStyle(picked.has(j.id)), width: '100%' }}
                data-purchase-result={j.id}
              >
                <span>{j.main}</span>
                {j.address ? <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>{j.address}</span> : null}
              </button>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}
