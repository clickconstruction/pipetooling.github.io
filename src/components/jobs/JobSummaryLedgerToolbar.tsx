import type { CSSProperties, ReactNode } from 'react'
import type { JobSummaryViewBundle } from '../../hooks/useJobSummaryView'
import { JOB_OVERHEAD_METHODS } from '../../lib/jobs/jobDayLedger'
import {
  JOB_SUMMARY_STATUS_OPTIONS,
  JOB_SUMMARY_VIEW_MODE_OPTIONS,
  JOB_SUMMARY_WINDOW_OPTIONS,
  type JobSummaryLedgerRowInput,
  type JobSummarySortKey,
} from '../../lib/jobs/jobSummaryLedgerView'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

/**
 * Job Summary ledger controls (v2.2692): the search box, the three segmented
 * controls (Show · Worked in · Overhead), the totals strip, and the hygiene
 * chips. Presentational — every value comes from the page's `useJobSummaryView`.
 */
type View = JobSummaryViewBundle<JobSummaryLedgerRowInput>

const segWrap: CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }
const segLabel: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }

function segButton(active: boolean, last: boolean): CSSProperties {
  return {
    padding: '0.3rem 0.65rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    border: 'none',
    borderRight: last ? 'none' : '1px solid var(--border)',
    background: active ? '#2563eb' : 'transparent',
    color: active ? '#fff' : 'var(--text-700)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

function Segmented<K extends string>({ label, value, options, onChange }: { label: string; value: K; options: ReadonlyArray<{ key: K; label: string; title?: string }>; onChange: (k: K) => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={segLabel}>{label}</span>
      <span style={segWrap} role="group" aria-label={label}>
        {options.map((o, i) => (
          <button key={o.key} type="button" aria-pressed={value === o.key} title={o.title} onClick={() => onChange(o.key)} style={segButton(value === o.key, i === options.length - 1)}>
            {o.label}
          </button>
        ))}
      </span>
    </span>
  )
}

const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }

function Tile({ k, v, s, tone }: { k: string; v: ReactNode; s?: ReactNode; tone?: 'green' | 'red' }) {
  return (
    <div style={tile}>
      <div style={tileK}>{k}</div>
      <div style={{ ...tileV, color: tone === 'green' ? 'var(--text-green-700)' : tone === 'red' ? 'var(--text-red-700)' : tileV.color }}>{v}</div>
      {s ? <div style={tileS}>{s}</div> : null}
    </div>
  )
}

const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.72rem', fontWeight: 600, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
const chipMuted: CSSProperties = { ...chip, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }

/** `formatUsdNoCents` already carries the "$"; this only adds the sign and the null dash. */
const money = (v: number | null | undefined): string => (v == null ? '—' : `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`)
const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)}%`)

export default function JobSummaryLedgerToolbar({
  view,
  search,
  setSearch,
  showMoney,
}: {
  view: View
  search: string
  setSearch: (v: string) => void
  /** Pay lockdown: overhead / true profit / labor tiles only for dev, master, controller. */
  showMoney: boolean
}) {
  const { prefs, setPrefs, totals, hygiene, ledgerLoading, ledgerError, reloadLedger } = view
  const methodLabel = JOB_OVERHEAD_METHODS.find((m) => m.key === prefs.method)?.label ?? 'Day-share'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
      <input
        type="search"
        placeholder="Search HCP, job name, address…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Segmented label="View" value={prefs.view} options={JOB_SUMMARY_VIEW_MODE_OPTIONS} onChange={(view) => setPrefs({ view })} />
        {prefs.view === 'jobs' ? <Segmented label="Show" value={prefs.status} options={JOB_SUMMARY_STATUS_OPTIONS} onChange={(status) => setPrefs({ status })} /> : null}
        <Segmented label="Worked in" value={prefs.window} options={JOB_SUMMARY_WINDOW_OPTIONS} onChange={(window) => setPrefs({ window })} />
        {showMoney && prefs.view === 'jobs' ? <Segmented label="Overhead" value={prefs.method} options={JOB_OVERHEAD_METHODS} onChange={(method) => setPrefs({ method })} /> : null}
        {ledgerLoading ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading the day ledger…</span> : null}
        {ledgerError ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
            Day ledger failed: {ledgerError}{' '}
            <button type="button" onClick={reloadLedger} style={{ border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
              retry
            </button>
          </span>
        ) : null}
      </div>
      {prefs.view !== 'jobs' ? null : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        <Tile k="Jobs" v={totals.jobs} s={`${JOB_SUMMARY_STATUS_OPTIONS.find((s) => s.key === prefs.status)?.label.toLowerCase() ?? ''} · ${JOB_SUMMARY_WINDOW_OPTIONS.find((w) => w.key === prefs.window)?.title.toLowerCase() ?? ''}`} />
        <Tile k="Revenue" v={money(totals.revenueUsd)} s={totals.earnedRows > 0 ? `${totals.earnedRows} in-progress shown as earned` : 'contract on jobs_ledger'} />
        {showMoney ? (
          <>
            <Tile k="Gross profit" v={money(totals.grossUsd)} s={`${pct(totals.marginPct)} margin`} tone={totals.grossUsd < 0 ? 'red' : undefined} />
            <Tile
              k="Overhead charged"
              v={money(totals.overheadUsd)}
              s={totals.overheadUsd == null ? (ledgerLoading ? 'loading…' : 'not available') : `${methodLabel.toLowerCase()} · ${totals.grossUsd > 0 ? pct((totals.overheadUsd / totals.grossUsd) * 100) : '—'} of gross`}
            />
            <Tile k="True profit" v={money(totals.trueProfitUsd)} s={`${pct(totals.trueMarginPct)} true margin`} tone={totals.trueProfitUsd == null ? undefined : totals.trueProfitUsd < 0 ? 'red' : 'green'} />
            <Tile k="Per field hour" v={totals.truePerHourUsd == null ? '—' : `$${totals.truePerHourUsd.toFixed(2)}`} s={`${totals.hours.toFixed(1)} h on these jobs`} />
          </>
        ) : (
          <Tile k="Field hours" v={totals.hours.toFixed(1)} s="approved, in the window" />
        )}
      </div>
      )}
      {prefs.view !== 'jobs' ? null : (
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {totals.noRevenueJobs > 0 ? <span style={chip}>⚠ {totals.noRevenueJobs} {totals.noRevenueJobs === 1 ? 'job has' : 'jobs have'} no contract $</span> : null}
        {totals.noPctJobs > 0 ? <span style={chip}>⚠ {totals.noPctJobs} {totals.noPctJobs === 1 ? 'job has' : 'jobs have'} no % complete</span> : null}
        {hygiene && hygiene.pendingFieldSessions > 0 ? (
          <span style={chip}>
            ⚠ {hygiene.pendingFieldSessions} {hygiene.pendingFieldSessions === 1 ? 'session awaits' : 'sessions await'} approval · {hygiene.pendingFieldHours.toFixed(1)} h not counted
          </span>
        ) : null}
        {totals.priorHoursJobs > 0 ? <span style={chipMuted}>{totals.priorHoursJobs} {totals.priorHoursJobs === 1 ? 'job has' : 'jobs have'} hours before the window — not charged; widen the window to charge them</span> : null}
        {showMoney && hygiene && hygiene.unallocatedUsd > 0 ? (
          <span style={chipMuted}>
            {money(hygiene.unallocatedUsd)} of overhead fell on {hygiene.unallocatedDays} {hygiene.unallocatedDays === 1 ? 'day' : 'days'} with no field work — shown, not charged
          </span>
        ) : null}
      </div>
      )}
    </div>
  )
}

/** Column-header sort control for the ledger table. */
export function JobSummarySortHeader({
  label,
  sortKey,
  view,
  align = 'right',
  title,
}: {
  label: ReactNode
  sortKey: JobSummarySortKey
  view: View
  align?: 'left' | 'right'
  title?: string
}) {
  const active = view.prefs.sortKey === sortKey
  const arrow = active ? (view.prefs.sortDir === 'desc' ? '▾' : '▴') : ''
  return (
    <th style={{ padding: '0.6rem 0.6rem', textAlign: align, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
      <button
        type="button"
        onClick={() => view.toggleSort(sortKey)}
        title={title ?? `Sort by ${typeof label === 'string' ? label : sortKey}`}
        aria-sort={active ? (view.prefs.sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
        style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontWeight: 700, color: active ? 'var(--text-link)' : 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        {label}
        {arrow ? <span aria-hidden style={{ marginLeft: 3 }}>{arrow}</span> : null}
      </button>
    </th>
  )
}
