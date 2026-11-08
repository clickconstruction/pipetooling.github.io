import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { calcLineBudget, lineBudgetEntryOf, lineBudgetFor, sumLineBudgets, LINE_BUDGET_GLYPH } from '../../lib/jobs/lineBudgets'
import { useLineBudgetSettings } from '../../hooks/useLineBudgetSettings'
import type { Database } from '../../types/database'

/**
 * The Costs tab's line budgets card (punch list #234 PR 1, v2.6300): where the
 * job stands against the whole budget — spent of labor and of materials, each
 * with the job's percent done as a mark — then a row per line with its budget
 * read from the line's own columns and its own percent. Spent per line waits on
 * the stage attribution (PR 1b); until then spent reads once, for the job.
 */
type Fixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']

const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const h0 = (n: number) => `${Math.round(n).toLocaleString('en-US')} h`
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', background: 'var(--surface)', display: 'grid', gap: '0.55rem' }
const lab: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }
const big: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }
const sub: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)' }
const LABOR = '#2563eb'
const MATERIALS = '#f59e0b'
/** One line per row, the same reading as the quiet line on ① Line Items: name and price, the bar, the words. */
const lineRow: CSSProperties = { display: 'grid', gap: 4, padding: '0.45rem 0', borderTop: '1px solid var(--border)' }
const lineHead: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: '0.8rem' }
const lineName: CSSProperties = { fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }
const lineBar: CSSProperties = { position: 'relative', display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--border)' }
const lineWords: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }

type Props = {
  fixtures: Fixture[]
  /** Clock hours on the job, as the Costs tab already reads them. */
  teamHours: number | null
  /** Spend by component from the charge events: team and sub labor dollars against the labor budget, parts against materials. */
  spend: { teamUsd: number; subUsd: number; partsUsd: number } | null
  /** The job's percent done, for the kept-so-far reading when a line carries no percent of its own. */
  jobPctDone: number | null
  /** The job, for the door to its card on the Projects board (punch list #242, PR 5); none, no door. */
  jobId?: string | null
  /** The job reads as a project (#238's kind); undefined = not known here, so an ordered stage stands in. */
  isProject?: boolean
}

export function JobCostsLineBudgets({ fixtures, teamHours, spend, jobPctDone, jobId = null, isProject }: Props) {
  const { settings } = useLineBudgetSettings()
  const lines = useMemo(
    () =>
      fixtures
        .filter((f) => f.line_kind !== 'discount')
        .map((f) => {
          const priceUsd = (Number(f.line_unit_price) || 0) * (Number(f.count) || 1)
          const entry = lineBudgetFor(lineBudgetEntryOf(f), f.name, settings)
          // A line's own percent only (the superintendent's line card, #234 PR 3); the job's is never borrowed per line.
          return { id: f.id, name: f.name, priceUsd, entry, pctDone: f.progress_pct != null ? Number(f.progress_pct) : null, calc: calcLineBudget(priceUsd, entry, settings) }
        }),
    [fixtures, settings],
  )
  const sums = useMemo(() => sumLineBudgets(lines, settings), [lines, settings])
  // Only a project carries budgets (#238's kind, punch list #234 PR 1a); a caller that does not know the kind leaves an ordered stage to stand in.
  const project = isProject ?? fixtures.some((f) => f.stage_kind === 'order')
  if (lines.length === 0 || !project) return null
  // Where we are against the whole budget, from what the job already knows at any moment:
  // team and sub labor dollars against the labor budget, parts against materials.
  const laborSpent = spend ? spend.teamUsd + spend.subUsd : null
  const materialsSpent = spend ? spend.partsUsd : null
  const budgetUsd = sums.laborUsd + sums.materialsUsd
  const spentUsd = laborSpent != null && materialsSpent != null ? laborSpent + materialsSpent : null
  const spentPct = spentUsd != null && budgetUsd > 0 ? (spentUsd / budgetUsd) * 100 : null
  const jobPct = jobPctDone != null ? Math.max(0, Math.min(100, jobPctDone)) : null
  // Spend past the work's percent is money ahead of the work; ten points is the Costs verdict's own margin of noise.
  const ahead = spentPct != null && jobPct != null && spentPct - jobPct >= 10
  const ownPctLines = lines.filter((l) => l.pctDone != null).length
  const hoursPct = teamHours != null && sums.laborHours > 0 ? Math.round((teamHours / sums.laborHours) * 100) : null

  const pace = (field: string, spentField: number | null, budget: number, color: string, tail?: string) => {
    const pct = spentField != null && budget > 0 ? (spentField / budget) * 100 : null
    const over = pct != null && jobPct != null && pct - jobPct >= 10
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', fontSize: '0.76rem' }} data-testid={`budget-pace-${field.toLowerCase()}`}>
        <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>{field}</span>
        <span style={{ position: 'relative', display: 'block', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--border)' }} aria-hidden>
          <i style={{ display: 'block', height: 10, width: `${Math.min(100, pct ?? 0)}%`, background: over ? 'var(--text-red-700)' : color, borderRadius: 5 }} />
          {jobPct != null ? <span style={{ position: 'absolute', top: 0, bottom: 0, width: 0, borderLeft: '2px dashed var(--text-strong)', left: `${jobPct}%` }} title={`the job is ${Math.round(jobPct)}% done`} /> : null}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: over ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
          {spentField != null ? `${usd0(spentField)} of ${usd0(budget)}` : `— of ${usd0(budget)}`}{pct != null ? ` · ${Math.round(pct)}%` : ''}{tail ? ` · ${tail}` : ''}
        </span>
      </div>
    )
  }

  return (
    <div style={card} data-testid="job-costs-line-budgets">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...lab, display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span>Where we are</span>
            {jobId ? <Link to={`/projects-board?job=${encodeURIComponent(jobId)}`} data-testid="job-costs-board-door" style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--text-link)', textDecoration: 'none' }} title="This project's card on the Projects board, with its expected hours">On the Projects board ›</Link> : null}
          </div>
          <div style={{ ...big, color: ahead ? 'var(--text-red-700)' : 'inherit' }}>
            {spentUsd != null ? usd0(spentUsd) : '—'} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>of {usd0(budgetUsd)} spent{spentPct != null ? ` · ${Math.round(spentPct)}% of the budget` : ''}</span>
          </div>
        </div>
        <div style={{ ...sub, textAlign: 'right' }}>
          {jobPct != null ? `the job is ${Math.round(jobPct)}% done` : 'no percent on the job yet'}
          {spentUsd != null && spentUsd > 0 && jobPct != null ? (
            <span style={{ display: 'block', fontWeight: 600, color: ahead ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>
              {ahead ? `spending ${Math.round((spentPct ?? 0) - jobPct)} points ahead of the work` : `${usd0(Math.max(0, (budgetUsd * jobPct) / 100 - spentUsd))} kept so far`}
            </span>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {pace('Labor', laborSpent, sums.laborUsd, LABOR, teamHours != null ? `${h0(teamHours)} of ${h0(sums.laborHours)}${hoursPct != null ? ` (${hoursPct}%)` : ''}` : undefined)}
        {pace('Materials', materialsSpent, sums.materialsUsd, MATERIALS)}
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', borderLeft: `3px solid ${ahead ? 'var(--border-red)' : 'var(--border-green, #16a34a)'}`, paddingLeft: 8 }}>
        {ahead ? (
          <span><b style={{ color: 'inherit' }}>The money is ahead of the work:</b> {Math.round(spentPct ?? 0)}% of the budget spent at {Math.round(jobPct ?? 0)}% done. Which line is eating it reads per line once hours land on a stage.</span>
        ) : (
          <span>
            The budget is the sum of the lines ({sums.bySource.workbench} ◆ from the workbench · {sums.bySource.assumed} ≈ assumed · {sums.bySource.tuned} ✎ tuned) at ${settings.rateUsd}/h; the dashed mark is the job's percent done.{' '}
            {ownPctLines === 0 ? "Each line's percent comes from the crew's report on that stage." : 'Spent per line waits on hours landing on a stage.'}
          </span>
        )}
      </div>
      <div data-testid="job-costs-line-rows">
        {lines.map((l) => {
          const pct = l.pctDone != null ? Math.max(0, Math.min(100, l.pctDone)) : null
          const assumed = l.entry.source === 'assumed'
          const sourceWords = l.entry.source === 'workbench' ? 'from the workbench' : assumed ? 'assumed' : 'tuned'
          return (
            <div key={l.id} style={lineRow} data-testid="job-costs-line-row">
              <div style={lineHead}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }} title={sourceWords}>{LINE_BUDGET_GLYPH[l.entry.source]}</span>
                <span style={lineName} title={l.name}>{l.name}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{usd0(l.priceUsd)}</span>
              </div>
              <div style={lineBar} aria-hidden>
                <i style={{ display: 'block', height: 8, width: `${l.entry.laborPct}%`, background: LABOR, opacity: assumed ? 0.55 : 1 }} />
                <i style={{ display: 'block', height: 8, width: `${l.entry.materialsPct}%`, background: MATERIALS, opacity: assumed ? 0.55 : 1 }} />
                {/* The line's own percent, as a mark across the bar: what of this line is earned. */}
                {pct != null ? <span style={{ position: 'absolute', top: -1, bottom: -1, width: 2, background: 'var(--text-strong)', left: `calc(${pct}% - 1px)` }} /> : null}
              </div>
              <div style={lineWords}>
                <span>{h0(l.calc.laborHours)} · {usd0(l.calc.laborUsd)} labor · {usd0(l.calc.materialsUsd)} mat. · {sourceWords}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{pct != null ? `${Math.round(pct)}% done · ${usd0((l.calc.laborUsd * pct) / 100)} earned` : 'no % of its own yet'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
