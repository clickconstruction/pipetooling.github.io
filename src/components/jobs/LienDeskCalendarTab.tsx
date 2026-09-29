import { useMemo, useState, type CSSProperties } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { buildLienCalendar, type LienCalendarGroup, type LienCalendarJob } from '../../lib/jobs/lienCalendar'
import type { LienRunwayTone } from '../../lib/jobs/lienPayRunway'
import LienPayRunway from './LienPayRunway'

/**
 * The Lien desk's Calendar tab (v2.4101, punch list #55 PR B): every billed
 * and collections job — direct jobs too, which the notice piles never list —
 * grouped by GC with a search box, each row carrying the same runway its
 * Pipeline row carries and opening the job's Lien window. The shell: PR C
 * lays the rows on one shared axis with the 15ths as columns, the density
 * strip, the key and the to-do line; PR D puts the pen on the pay dot.
 */

export type LienDeskCalendarTabProps = {
  rows: ReadonlyArray<LienCalendarJob> | null
  loading: boolean
  onOpenJob: (jobId: string) => void
}

const TONE: Record<LienRunwayTone, string> = {
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
  grey: 'var(--text-muted)',
}

const cellNum: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, padding: '0 5px', borderRadius: 3, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', whiteSpace: 'nowrap' }

function GroupHeader({ g, open, onToggle }: { g: LienCalendarGroup; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        textAlign: 'left',
        padding: '0.5rem 0.75rem',
        border: 'none',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: g.kind === 'gone' ? 'var(--bg-red-tint)' : 'var(--bg-subtle)',
        cursor: 'pointer',
        color: 'inherit',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span aria-hidden style={{ color: 'var(--text-muted)', marginRight: 6 }}>{open ? '▾' : '▸'}</span>
          {g.name}
        </span>
        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.sub}</span>
      </span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(g.total)}</span>
        <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: TONE[g.tone], whiteSpace: 'nowrap' }}>{g.word}</span>
      </span>
    </button>
  )
}

function JobRow({ j, onOpen }: { j: LienCalendarJob; onOpen: () => void }) {
  return (
    <div
      role="row"
      className="lienCalendarRow"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 15rem auto', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.75rem 0.4rem 1.6rem', borderBottom: '1px solid var(--border)' }}
    >
      <button
        type="button"
        onClick={onOpen}
        title="Open the job’s Lien window"
        style={{ minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={cellNum}>{j.number}</span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
        </span>
        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {j.customer}
          {j.address ? ` · ${j.address}` : ''}
          {j.runway.kindAssumed ? (
            <span title="Property kind not set — the residential (earlier) clock is shown" style={{ marginLeft: 6, fontSize: '0.625rem', fontWeight: 700, padding: '0 4px', borderRadius: 3, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>
              kind?
            </span>
          ) : null}
        </span>
      </button>
      <div style={{ minWidth: 0 }}>
        <LienPayRunway runway={j.runway} onOpen={onOpen} compact />
      </div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: '4.5rem' }}>{formatUsdNoCents(j.openBalance)}</div>
    </div>
  )
}

export default function LienDeskCalendarTab({ rows, loading, onOpenJob }: LienDeskCalendarTabProps) {
  const [query, setQuery] = useState('')
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set(['gone']))
  const cal = useMemo(() => buildLienCalendar(rows ?? [], query), [rows, query])
  const toggle = (key: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="lienDeskCalendar" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {loading && !rows ? 'Reading the board…' : `every billed job on the statute’s calendar · ${cal.totals.jobs} ${cal.totals.jobs === 1 ? 'job' : 'jobs'} · ${formatUsdNoCents(cal.totals.open)} open${cal.totals.noticesOwed ? ` · ${cal.totals.noticesOwed} ${cal.totals.noticesOwed === 1 ? 'notice' : 'notices'} owed` : ''}${cal.totals.gone ? ` · ${cal.totals.gone} lien${cal.totals.gone === 1 ? '' : 's'} gone` : ''}`}
        </div>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-strong)', borderRadius: 6, padding: '3px 8px', background: 'var(--surface)', minWidth: 'min(320px, 100%)' }}>
          <span aria-hidden style={{ color: 'var(--text-muted)' }}>⌕</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Job #, name, customer, GC, address"
            aria-label="Search the lien calendar"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8125rem', width: '100%', color: 'inherit' }}
          />
        </label>
      </div>
      <div style={{ overflowY: 'auto', minHeight: 0 }}>
        {!loading && rows && cal.groups.length === 0 ? (
          <div style={{ padding: '1.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{query.trim() ? 'No billed job matches that.' : 'Nothing billed is on a lien clock.'}</div>
        ) : null}
        {cal.groups.map((g) => {
          const open = !closed.has(g.key)
          return (
            <section key={g.key} aria-label={g.name}>
              <GroupHeader g={g} open={open} onToggle={() => toggle(g.key)} />
              {open ? g.jobs.map((j) => <JobRow key={j.jobId} j={j} onOpen={() => onOpenJob(j.jobId)} />) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
