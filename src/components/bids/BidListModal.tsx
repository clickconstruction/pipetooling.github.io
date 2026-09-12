import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatCurrency } from '../../lib/format'
import { PURSUIT_OUTCOME_LABELS, formatUsdShort, type PursuitOutcome, type PursuitRow } from '../../lib/bids/bidPursuit'
import type { CohortBucket } from '../../lib/bids/bidForecast'
import { bidListText, filterDrillRows, rollupByEstimator, rollupByGc, sliceWords, type CohortDrill } from '../../lib/bids/bidDrill'

/**
 * The list behind a number on Bids → Bid Costs → History & forecast
 * (v2.3357). One modal for every drill on the lens: a bar slice (with the
 * month's slice chips, ‹ › month steps and a small bar of the whole month), an
 * odds card, an age bucket, a tile, a person's row. Sits under the Bid window
 * (z 900 < 1000) so a bid opened from here stacks on top and closing it lands
 * back on the list. Built the way `BidBoardWeeklySentCellModal` is built:
 * Escape closes only the topmost modal, backdrop click closes.
 */
export type BidListModalCohort = {
  drill: CohortDrill
  onBucket: (bucket: CohortBucket) => void
  onMonth: (index: number) => void
}

type Props = {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  rows: PursuitRow[]
  cohort?: BidListModalCohort | null
  /** Open the bid (the Bids page's Bid window); the list stays open beneath it. */
  onOpenBid: (bidId: string) => void
}

const Z_INDEX = 900
const WON = '#1e8a57', LOST = '#c64b3a', OPEN = '#b8801f', OPEN_STALE = 'rgba(184, 128, 31, 0.42)'
const BUCKET_COLOR: Record<CohortBucket, string> = { won: WON, lost: LOST, open: OPEN, openStale: OPEN_STALE }
const OUTCOME_COLORS: Record<PursuitOutcome, { fg: string; bg: string }> = {
  open: { fg: OPEN, bg: 'rgba(184, 128, 31, 0.14)' },
  won: { fg: WON, bg: 'rgba(30, 138, 87, 0.14)' },
  lost: { fg: LOST, bg: 'rgba(198, 75, 58, 0.14)' },
  unsent: { fg: 'var(--text-muted)', bg: 'var(--bg-subtle)' },
}

const usd = (n: number): string => `$${formatCurrency(n)}`
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 9px', fontSize: '0.75rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'none', color: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', font: 'inherit' }
const navBtn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }
const th: CSSProperties = { padding: '0.45rem 0.55rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--bg-subtle)' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const cell: CSSProperties = { padding: '0.45rem 0.55rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', whiteSpace: 'nowrap' }
const num: CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const subLine: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'normal' }

const shortDate = (ymd: string | null): string => {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-')
  return `${Number(m)}/${Number(d)}/${(y ?? '').slice(2)}`
}

export function BidListModal({ open, onClose, title, sub, rows, cohort, onOpenBid }: Props) {
  const titleId = useId()
  const isTopmost = useModalStackEntry(open)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [estimator, setEstimator] = useState<string | null>(null)
  const [gc, setGc] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // A new list (another slice, another month) drops the chip filters.
  useEffect(() => {
    setEstimator(null)
    setGc(null)
    setCopied(false)
  }, [title, rows])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) onClose()
      if (cohort && isTopmost()) {
        if (e.key === 'ArrowLeft' && cohort.drill.prevIndex != null) cohort.onMonth(cohort.drill.prevIndex)
        if (e.key === 'ArrowRight' && cohort.drill.nextIndex != null) cohort.onMonth(cohort.drill.nextIndex)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, isTopmost, cohort])

  const byEstimator = useMemo(() => rollupByEstimator(rows), [rows])
  const byGc = useMemo(() => rollupByGc(rows), [rows])
  const shown = useMemo(() => [...filterDrillRows(rows, { estimator, gc })].sort((a, b) => (b.bidValue ?? 0) - (a.bidValue ?? 0)), [rows, estimator, gc])
  const shownUsd = useMemo(() => shown.reduce((s, r) => s + (r.bidValue ?? 0), 0), [shown])

  if (!open) return null
  const d = cohort?.drill ?? null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bidListText(title, shown, usd))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_INDEX, padding: '1rem' }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, width: '100%', maxWidth: 780, maxHeight: 'min(92vh, 720px)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem 0.6rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {d ? (
            <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
              <button type="button" onClick={() => d.prevIndex != null && cohort!.onMonth(d.prevIndex)} disabled={d.prevIndex == null} style={{ ...navBtn, opacity: d.prevIndex == null ? 0.4 : 1 }} title="Previous month, same slice (←)">‹ month</button>
              <button type="button" onClick={() => d.nextIndex != null && cohort!.onMonth(d.nextIndex)} disabled={d.nextIndex == null} style={{ ...navBtn, opacity: d.nextIndex == null ? 0.4 : 1 }} title="Next month, same slice (→)">month ›</button>
            </span>
          ) : null}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: '1rem', fontWeight: 600, lineHeight: 1.25 }}>{title}</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
              {sub ?? `${rows.length} bid${rows.length === 1 ? '' : 's'} · ${formatUsdShort(rows.reduce((s, r) => s + (r.bidValue ?? 0), 0))}`}
              {d?.shareOfDecided != null ? ` · ${Math.round(d.shareOfDecided * 100)}% of what ${d.label} decided, by value` : ''}
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} style={{ border: 'none', background: 'var(--bg-muted)', borderRadius: 6, padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, flexShrink: 0, font: 'inherit' }}>Close</button>
        </div>

        {d ? (
          <div style={{ padding: '0.5rem 1rem 0' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>This month:</span>
              {d.slices.map((s) => {
                const on = s.bucket === d.bucket
                const c = BUCKET_COLOR[s.bucket]
                return (
                  <button key={s.bucket} type="button" disabled={s.n === 0} onClick={() => cohort!.onBucket(s.bucket)} aria-pressed={on} style={{ ...chip, color: s.n === 0 ? 'var(--text-muted)' : c, borderColor: on ? c : 'transparent', background: s.bucket === 'openStale' ? 'rgba(184, 128, 31, 0.10)' : `${c}22`, fontWeight: on ? 600 : 400, outline: on ? `2px solid ${c}` : 'none', outlineOffset: 1, cursor: s.n === 0 ? 'default' : 'pointer' }}>
                    {sliceWords(s, formatUsdShort)}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', height: 8, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-subtle)', marginTop: 8 }} aria-hidden>
              {d.monthCount > 0 ? d.slices.filter((s) => s.n > 0).map((s) => <span key={s.bucket} style={{ display: 'block', height: '100%', width: `${(s.n / d.monthCount) * 100}%`, background: BUCKET_COLOR[s.bucket], outline: s.bucket === d.bucket ? '2px solid var(--text-primary, currentColor)' : 'none', outlineOffset: -2 }} />) : null}
            </div>
          </div>
        ) : null}

        {rows.length > 0 && (byEstimator.length > 1 || byGc.length > 1) ? (
          <div style={{ padding: '0.6rem 1rem 0', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', alignItems: 'center' }}>
            {byEstimator.length > 1 ? (
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ color: 'var(--text-primary, inherit)', fontWeight: 500 }}>By estimator</b>
                {byEstimator.slice(0, 6).map((r) => <button key={r.key} type="button" aria-pressed={estimator === r.key} onClick={() => setEstimator(estimator === r.key ? null : r.key)} style={{ ...chip, padding: '1px 8px', fontSize: '0.72rem', ...(estimator === r.key ? { borderColor: 'var(--text-link)', color: 'var(--text-link)', fontWeight: 600 } : {}) }}>{r.label} · {r.n}</button>)}
              </span>
            ) : null}
            {byGc.length > 1 ? (
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ color: 'var(--text-primary, inherit)', fontWeight: 500 }}>By GC</b>
                {byGc.slice(0, 5).map((r) => <button key={r.key} type="button" aria-pressed={gc === r.key} onClick={() => setGc(gc === r.key ? null : r.key)} style={{ ...chip, padding: '1px 8px', fontSize: '0.72rem', ...(gc === r.key ? { borderColor: 'var(--text-link)', color: 'var(--text-link)', fontWeight: 600 } : {}) }}>{r.label} · {r.n}</button>)}
                {byGc.length > 5 ? <span>+{byGc.length - 5} more</span> : null}
              </span>
            ) : null}
          </div>
        ) : null}

        <div style={{ padding: '0.6rem 1rem 0.4rem', overflow: 'auto', minHeight: 0, flex: 1 }}>
          {shown.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rows.length === 0 ? 'No bids here.' : 'No bids match that chip.'}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead><tr><th style={th}>Bid</th><th style={th}>Estimator</th><th style={th}>Sent</th><th style={thNum}>Value</th><th style={th}>Outcome</th><th style={th}>Decided</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.bidId} onClick={() => onOpenBid(r.bidId)} style={{ cursor: 'pointer' }} title="Open this bid">
                    <td style={{ ...cell, whiteSpace: 'normal', minWidth: 200 }}>{r.label}{r.gcName ? <span style={subLine}>{r.gcName}</span> : null}</td>
                    <td style={cell}>{r.estimatorName ?? '—'}</td>
                    <td style={cell}>{shortDate(r.sentYmd ?? r.dateYmd)}</td>
                    <td style={num}>{r.bidValue != null ? usd(r.bidValue) : '—'}</td>
                    <td style={cell}><span style={{ ...chip, cursor: 'default', borderWidth: 0, color: OUTCOME_COLORS[r.outcome].fg, background: OUTCOME_COLORS[r.outcome].bg, fontWeight: 500 }}>{PURSUIT_OUTCOME_LABELS[r.outcome]}</span></td>
                    <td style={cell}>{r.outcomeAtYmd ? shortDate(r.outcomeAtYmd) : r.outcome === 'won' || r.outcome === 'lost' ? <span style={{ color: 'var(--text-muted)' }}>no date</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '0.6rem 1rem 0.85rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void copy()} disabled={shown.length === 0} style={{ ...chip, color: 'var(--text-link)', borderColor: 'var(--text-link)' }}>{copied ? 'Copied' : 'Copy list'}</button>
          <span>{shown.length !== rows.length ? `${shown.length} of ${rows.length} bids · ${formatUsdShort(shownUsd)} · ` : ''}Click a bid to open it; this list stays behind it. Esc closes{d ? ', ← → step months' : ''}.</span>
        </div>
      </div>
    </div>
  )
}
