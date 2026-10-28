import { useEffect, useState, type CSSProperties } from 'react'
import { EmptyState } from '../../EmptyState'
import { emptyWords } from '../../../lib/emptyWords'
import {
  retainageAgeWords,
  retainageBandSummary,
  retainageReleaseWords,
  retainageSourceWords,
  type RetainageHeldLine,
  type RetainageHeldSection,
} from '../../../lib/ar/retainageHeld'
import type { RetainageJobFacts } from '../../../lib/ar/retainageHeldRows'
import { formatYmdMonthDay } from '../../../lib/jobs/billedExpectedPay'
import { formatCurrency } from '../../../lib/jobs/jobFormatting'

/**
 * The Retainage held band in the Accounts Receivable window (punch list #165, PR 2 — show A):
 * the money GCs hold back on our trade jobs, one line per job, apart from the deposits and
 * the bills, aged from the day the job finished, with a door to the job. Read only: nothing
 * here bills or releases anything. Every figure and every word comes from
 * `lib/ar/retainageHeld.ts`; this file only draws.
 *
 * Closed, the band is one line with the total; open, the lines. The choice is remembered on
 * this browser and nowhere else.
 */

const OPEN_KEY = 'ar.retainageHeld.open'

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== 'closed'
  } catch {
    return true
  }
}

const money = (n: number): string => `$${formatCurrency(n)}`

const cell: CSSProperties = { padding: '0.35rem 0.5rem', borderTop: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
const head: CSSProperties = { padding: '0 0.5rem 0.25rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const muted: CSSProperties = { color: 'var(--text-muted)' }
const doorStyle: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }

function Figure({ line }: { line: RetainageHeldLine }) {
  const release = retainageReleaseWords(line.release)
  if (line.owed > 0) {
    return (
      <>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{money(line.owed)}</span>
        {release ? <span style={{ ...muted, display: 'block', fontSize: '0.75rem' }}>{release}</span> : null}
      </>
    )
  }
  return (
    <>
      <span style={{ ...muted, fontVariantNumeric: 'tabular-nums', textDecoration: 'line-through' }}>{money(line.held)}</span>
      <span style={{ ...muted, display: 'block', fontSize: '0.75rem' }}>{release}</span>
    </>
  )
}

function Door({ jobId, onOpenJob }: { jobId: string; onOpenJob?: (jobId: string) => void }) {
  if (!onOpenJob) return null
  return (
    <button type="button" data-testid="ar-retainage-open-job" onClick={() => onOpenJob(jobId)} style={doorStyle}>
      Open the job
    </button>
  )
}

function JobCell({ line, facts }: { line: RetainageHeldLine; facts: RetainageJobFacts | undefined }) {
  return (
    <>
      <span style={{ fontWeight: 700 }}>{facts?.label ?? line.jobId.slice(0, 8)}</span>
      {facts?.name ? <span style={muted}> · {facts.name}</span> : null}
      {facts?.address ? <span style={{ ...muted, display: 'block', fontSize: '0.75rem' }}>{facts.address}</span> : null}
      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-blue-800)' }}>{retainageSourceWords(line, formatYmdMonthDay)}</span>
    </>
  )
}

function AgeCell({ line }: { line: RetainageHeldLine }) {
  const aging = line.ageDays != null && line.owed > 0
  return <span style={{ fontSize: '0.75rem', color: aging ? 'var(--text-amber-800)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{retainageAgeWords(line, formatYmdMonthDay)}</span>
}

export function ArRetainageHeld({
  section,
  facts,
  loading,
  error,
  narrow,
  onOpenJob,
}: {
  section: RetainageHeldSection | null
  facts: Map<string, RetainageJobFacts>
  loading: boolean
  /** Why the read failed, already in the office's words. */
  error: string | null
  narrow: boolean
  onOpenJob?: (jobId: string) => void
}) {
  const [open, setOpen] = useState(true)
  useEffect(() => setOpen(readOpen()), [])
  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      window.localStorage.setItem(OPEN_KEY, next ? 'open' : 'closed')
    } catch {
      // The choice is a convenience; a browser that refuses storage keeps this visit's.
    }
  }
  const lines = section?.lines ?? []
  const summary = loading && !section ? 'reading…' : error && !section ? 'could not be read' : retainageBandSummary(section)

  return (
    <div data-testid="ar-retainage-held" style={{ padding: '0.5rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        style={{ font: 'inherit', display: 'flex', alignItems: 'baseline', gap: '0.5rem', width: '100%', textAlign: 'left', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}
      >
        <span aria-hidden="true" style={{ ...muted, fontSize: '0.75rem' }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-700)' }}>Retainage held</span>
        <span data-testid="ar-retainage-summary" style={{ ...muted, fontSize: '0.8125rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          · {summary}
          {!narrow ? ' · money GCs hold back on our trade jobs' : ''}
        </span>
      </button>
      {!open ? null : error ? (
        <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : loading && !section ? (
        <p style={{ ...muted, margin: '0.5rem 0 0', fontSize: '0.8125rem' }}>Reading the retainage GCs hold…</p>
      ) : lines.length === 0 ? (
        <EmptyState compact main={emptyWords({ kind: 'waiting', who: 'retainage a GC holds' }).main} />
      ) : narrow ? (
        <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, display: 'grid', gap: '0.5rem' }}>
          {lines.map((line) => {
            const f = facts.get(line.jobId)
            return (
              <li key={line.jobId} data-testid="ar-retainage-line" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem', fontSize: '0.8125rem', display: 'grid', gap: '0.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
                  <span style={{ minWidth: 0 }}>
                    <JobCell line={line} facts={f} />
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <Figure line={line} />
                  </span>
                </div>
                {f?.heldBy ? <span style={muted}>held by {f.heldBy}</span> : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                  <AgeCell line={line} />
                  <Door jobId={line.jobId} onOpenJob={onOpenJob} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.4rem' }}>
          <thead>
            <tr>
              <th scope="col" style={head}>Job</th>
              <th scope="col" style={head}>Held by</th>
              <th scope="col" style={{ ...head, textAlign: 'right' }}>Held</th>
              <th scope="col" style={head}>Aging</th>
              <th scope="col" style={head} aria-label="Door" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const f = facts.get(line.jobId)
              return (
                <tr key={line.jobId} data-testid="ar-retainage-line">
                  <td style={cell}>
                    <JobCell line={line} facts={f} />
                  </td>
                  <td style={cell}>{f?.heldBy || <span style={muted}>—</span>}</td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Figure line={line} />
                  </td>
                  <td style={cell}>
                    <AgeCell line={line} />
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    <Door jobId={line.jobId} onOpenJob={onOpenJob} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
