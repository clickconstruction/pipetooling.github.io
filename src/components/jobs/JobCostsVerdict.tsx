import { useState, type CSSProperties, type ReactNode } from 'react'
import { formatCurrency } from '../../lib/format'
import { baselineReadWords, pctDoneWords, timeLeftWords, type CostsVerdict } from '../../lib/jobs/jobCostsVerdict'
import type { JobBudgetState } from '../../hooks/useJobBudget'
import type { JobBaselineState } from '../../hooks/useJobBaseline'

/**
 * The Costs tab's verdict (v2.3361 — the honest tab). Four tiles that are
 * always true — true margin at completion, spent, earned off the price, time
 * left — then, behind the margin tile, how the margin builds by section
 * (spent · at completion · the bid's figure), and the baseline strip: what
 * this job is producing for the labor book, or how it reads against the bid
 * when the bid carried hours. Nothing here shows "≈ assumed" as a budget.
 * Layout only; every number comes from `buildCostsVerdict`.
 */
type Props = {
  verdict: CostsVerdict
  canWrite: boolean
  budget: JobBudgetState
  linkedBid: { id: string; bid_number: string | null; project_name: string | null } | null
  /** Bids → Counts on the linked bid. */
  onOpenBidCounts: (() => void) | null
  /** The link-a-bid doorway (candidates · find · typed budget) for a job with no bid; folded under the strip. */
  doorway: ReactNode
  /** The job's kept baseline (v2.3367) and the Keep now door. */
  kept: JobBaselineState
  jobFinished: boolean
}

const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const pct0 = (n: number | null) => (n == null ? '' : ` · ${Math.round(n)}%`)
const h0 = (n: number) => `${Math.round(n).toLocaleString('en-US')} h`
const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.7rem', background: 'var(--surface)', minWidth: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }
const lab: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }
const big: CSSProperties = { fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, marginTop: 2 }
const sub: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }
const th: CSSProperties = { padding: '0.35rem 0.5rem', textAlign: 'left', fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const td: CSSProperties = { padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', verticalAlign: 'top' }
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const muted: CSSProperties = { color: 'var(--text-muted)' }
const btn = (primary = false): CSSProperties => ({ padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontWeight: 600, border: `1px solid ${primary ? '#3b82f6' : 'var(--border-strong)'}`, borderRadius: 6, background: primary ? '#3b82f6' : 'var(--surface)', color: primary ? 'white' : 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' })

const keptWords = (k: JobBaselineState['row']): string => {
  if (!k) return ''
  const day = new Date(k.kept_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `Baseline kept ${day}${k.kept_on === 'billed' ? ' on billing' : ''} · ${k.grade === 'fixture' ? 'by fixture' : 'per $1k'}`
}

export function JobCostsVerdict({ verdict: v, canWrite, budget, linkedBid, onOpenBidCounts, doorway, kept, jobFinished }: Props) {
  const [sectionsOpen, setSectionsOpen] = useState(false)
  const [doorOpen, setDoorOpen] = useState(false)
  const tl = timeLeftWords(v.timeLeft, usd0)
  const margin = v.trueMargin ?? v.directMargin
  const marginIsTrue = v.trueMargin != null
  const good = margin != null && margin.usd >= 0
  const heroTone: CSSProperties = margin == null ? {} : good ? { borderColor: 'var(--border-green, #16a34a)', background: 'var(--bg-green-100, var(--surface))' } : { borderColor: 'var(--border-red)', background: 'var(--bg-red-100, var(--surface))' }
  const b = v.baseline

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }} data-testid="job-costs-verdict">
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {v.priceUsd != null ? `${usd0(v.priceUsd)} · ` : ''}{pctDoneWords(v, dayLabel)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }} className="job-costs-verdict-tiles">
        <button type="button" onClick={() => setSectionsOpen((o) => !o)} aria-expanded={sectionsOpen} style={{ ...tile, ...heroTone, cursor: 'pointer', position: 'relative', gridColumn: '1 / -1' }} title="How the margin builds, by section" data-testid="verdict-margin">
          <span style={{ position: 'absolute', right: 9, top: 7, fontSize: '0.66rem', fontWeight: 600, color: 'var(--text-muted)' }}>by section {sectionsOpen ? '▴' : '▾'}</span>
          <div style={lab}>{marginIsTrue ? 'True margin at completion' : 'Direct margin at completion'}</div>
          <div style={{ ...big, color: margin == null ? 'var(--text-muted)' : good ? 'var(--text-green-600)' : 'var(--text-red-600)' }}>{margin ? `${usd0(margin.usd)}${pct0(margin.pct)}` : v.timeLeft.early ? 'too early' : '—'}</div>
          <div style={sub}>
            {v.eacUsd != null ? `at today's pace: ${usd0(v.eacUsd)} direct` : 'projection needs 3 field days and 10%'}
            {marginIsTrue && v.overheadProjectedUsd != null ? ` + ${usd0(v.overheadToDateUsd + v.overheadProjectedUsd)} overhead share` : ''}
            {marginIsTrue && v.directMargin ? `. Direct margin alone ${usd0(v.directMargin.usd)}${pct0(v.directMargin.pct)}.` : ''}
          </div>
        </button>
        <div style={tile}>
          <div style={lab}>Spent so far</div>
          <div style={big}>{usd0(v.spent.usd)}</div>
          <div style={sub}>{v.spent.pctOfPrice != null ? `${Math.round(v.spent.pctOfPrice)}% of the price · ` : ''}{h0(v.spent.teamHours)} team · {usd0(v.spent.materialsUsd)} materials</div>
        </div>
        <div style={tile}>
          <div style={lab}>Earned so far</div>
          <div style={big}>{v.earned ? usd0(v.earned.usd) : '—'}</div>
          <div style={sub}>{v.earned && v.pctDone != null && v.priceUsd != null ? `${Math.round(v.pctDone)}% of ${usd0(v.priceUsd)} · ${v.earned.aheadUsd >= 0 ? `${usd0(v.earned.aheadUsd)} ahead on direct` : `${usd0(-v.earned.aheadUsd)} behind on direct`}` : v.priceUsd == null ? 'set the price on the Bill tab' : 'needs a % complete'}</div>
        </div>
        <div style={tile}>
          <div style={lab}>Time left</div>
          <div style={big}>{tl.big}</div>
          <div style={sub}>{tl.sub}</div>
        </div>
      </div>

      {sectionsOpen ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }} data-testid="verdict-sections">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.4rem 0.6rem', background: 'var(--bg-subtle)', fontSize: '0.78rem' }}>
            <b>How {margin ? usd0(margin.usd) : 'the margin'} builds — by section, at today's pace</b>
            <span style={{ ...muted, fontSize: '0.7rem' }}>bid figures: {v.budgetLabel}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Section</th><th style={thNum}>Spent so far</th><th style={thNum}>At completion</th><th style={thNum}>Bid figure</th><th style={th}>Read</th></tr></thead>
              <tbody>
                {v.sections.map((s) => (
                  <tr key={s.key} data-testid={`verdict-row-${s.key}`}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}><b>{s.label}</b> <span style={{ ...muted, fontSize: '0.7rem' }}>{s.hours != null ? `${h0(s.hours)} · ` : ''}{s.sub}</span></td>
                    <td style={tdNum}>{usd0(s.spentUsd)}</td>
                    <td style={tdNum}>{s.atCompletionUsd != null ? usd0(s.atCompletionUsd) : '—'}</td>
                    <td style={{ ...tdNum, ...(s.budgetUsd == null && s.budgetHours == null ? muted : {}) }}>{s.budgetHours != null ? `${h0(s.budgetHours)}${s.budgetUsd != null ? ` · ${usd0(s.budgetUsd)}` : ''}` : s.budgetUsd != null ? usd0(s.budgetUsd) : s.budgetWords}</td>
                    <td style={{ ...td, ...muted, minWidth: 160 }}>
                      {s.key === 'labor' && b.avgWageUsd != null ? `$${formatCurrency(b.avgWageUsd)}/h${b.hoursPerThousand != null ? ` · ${b.hoursPerThousand.toFixed(1)} h per $1k so far` : ''}` : ''}
                      {s.key === 'materials' && b.materialsPctOfPrice != null ? `${Math.round(b.materialsPctOfPrice)}% of the price` : ''}
                      {s.pctOfBudget != null ? ` · ${Math.round(s.pctOfBudget)}% of the bid figure${s.aheadPts != null ? (s.aheadPts > 5 ? ' · ahead of the work' : s.aheadPts < -5 ? ' · behind the work' : ' · with the work') : ''}` : ''}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                  <td style={td}>Direct cost</td><td style={tdNum}>{usd0(v.spent.usd)}</td><td style={tdNum}>{v.eacUsd != null ? usd0(v.eacUsd) : '—'}</td>
                  <td style={{ ...tdNum, ...muted, fontWeight: 400 }}>{v.assumedDirectUsd != null && v.targetMarginPct != null ? `≈ ${usd0(v.assumedDirectUsd)} assumed (${100 - v.targetMarginPct}% of price)` : ''}</td>
                  <td style={{ ...td, ...muted, fontWeight: 400 }}>{v.eacUsd != null && v.pctDone != null ? `spent ÷ ${Math.round(v.pctDone)}% done` : ''}</td>
                </tr>
                <tr>
                  <td style={td}><b>Overhead share</b></td><td style={tdNum}>{usd0(v.overheadToDateUsd)}</td><td style={tdNum}>{v.overheadProjectedUsd != null ? usd0(v.overheadToDateUsd + v.overheadProjectedUsd) : '—'}</td><td style={{ ...tdNum, ...muted }}>—</td>
                  <td style={{ ...td, ...muted }}>{v.timeLeft.burnPerFieldDayUsd != null && v.overheadProjectedUsd != null && v.timeLeft.workLeftFieldDays != null && v.timeLeft.workLeftFieldDays > 0 ? `${usd0(v.overheadProjectedUsd / v.timeLeft.workLeftFieldDays)} a field day × ${Math.round(v.timeLeft.workLeftFieldDays)} days left` : ''}</td>
                </tr>
                <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                  <td style={td}>True cost</td><td style={tdNum}>{usd0(v.spent.usd + v.overheadToDateUsd)}</td><td style={tdNum}>{v.eacUsd != null && v.overheadProjectedUsd != null ? usd0(v.eacUsd + v.overheadToDateUsd + v.overheadProjectedUsd) : '—'}</td><td style={td} /><td style={td} />
                </tr>
                <tr>
                  <td style={td}><b>Price</b></td><td style={tdNum} /><td style={tdNum}>{v.priceUsd != null ? usd0(v.priceUsd) : '—'}</td><td style={{ ...tdNum, ...muted }}>{linkedBid ? '= bid value' : ''}</td><td style={td} />
                </tr>
                <tr style={{ fontWeight: 700, ...(margin ? (good ? { background: 'var(--bg-green-100, var(--bg-subtle))' } : { background: 'var(--bg-red-100, var(--bg-subtle))' }) : {}) }}>
                  <td style={td}>{marginIsTrue ? 'True margin' : 'Direct margin'}</td>
                  <td style={tdNum}>{v.trueMarginSoFar && marginIsTrue ? `${usd0(v.trueMarginSoFar.usd)}${pct0(v.trueMarginSoFar.pct)} so far` : v.earned ? `${usd0(v.earned.aheadUsd)} so far` : ''}</td>
                  <td style={tdNum}>{margin ? `${usd0(margin.usd)}${pct0(margin.pct)}` : '—'}</td>
                  <td style={{ ...tdNum, ...muted, fontWeight: 400 }}>{v.targetMarginPct != null ? `${v.targetMarginPct}% target` : ''}</td>
                  <td style={{ ...td, ...muted, fontWeight: 400 }}>{marginIsTrue && v.directMargin ? `direct margin ${usd0(v.directMargin.usd)}${pct0(v.directMargin.pct)}` : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {b.kind === 'bid' ? (
        <div style={{ border: '1px solid var(--border-green, #16a34a)', borderRadius: 8, padding: '0.6rem 0.8rem', display: 'grid', gap: '0.35rem' }} data-testid="baseline-strip-bid">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem 0.75rem', flexWrap: 'wrap' }}>
            <b style={{ fontSize: '0.9rem' }}>◆ Baseline from {b.bidLabel ?? 'the bid'} · {h0(b.bidHours ?? 0)} predicted</b>
            <span style={{ fontSize: '0.78rem' }}>{baselineReadWords(b, v.pctDone)}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.4rem' }}>
              {canWrite && linkedBid ? <button type="button" onClick={() => void budget.linkAndSnapshot(linkedBid.id)} disabled={budget.busy} style={btn()} title="Take the bid's estimate again">Refresh from bid ↻</button> : null}
              {canWrite ? <button type="button" onClick={() => void budget.clear()} disabled={budget.busy} style={btn()}>Clear</button> : null}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem 0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>{kept.row ? keptWords(kept.row) : jobFinished ? 'No baseline kept — the job had no recorded hours when it billed.' : 'Kept for the labor book when the job bills.'}</span>
            {canWrite && !kept.row && !jobFinished ? <button type="button" onClick={() => void kept.keepNow()} disabled={kept.busy} style={btn()} title="Keep what the job has taken so far as its baseline now">Keep now</button> : null}
            {canWrite && kept.row ? <button type="button" onClick={() => void kept.keepNow()} disabled={kept.busy} style={btn()} title="Take the baseline again from today's hours">Keep again ↻</button> : null}
            {kept.error ? <span style={{ color: 'var(--text-red-700)' }}>{kept.error}</span> : null}
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid #f59e0b', background: 'var(--bg-amber-100)', borderRadius: 8, padding: '0.6rem 0.8rem', display: 'grid', gap: '0.4rem' }} data-testid="baseline-strip-none">
          <b style={{ fontSize: '0.9rem' }}>{linkedBid ? `No baseline for this job yet — bid ${b.bidLabel} was sent without hours.` : 'No baseline for this job yet — no bid is linked.'}</b>
          <div style={{ fontSize: '0.78rem' }}>What it has taken so far is the baseline:</div>
          <div style={{ display: 'flex', gap: '0.5rem 1rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <span><b>{h0(b.teamHours)}</b> team</span>
            {b.hoursPerThousand != null ? <span><b>{b.hoursPerThousand.toFixed(1)} h</b> per $1k of price</span> : null}
            {b.avgWageUsd != null ? <span><b>${formatCurrency(b.avgWageUsd)}/h</b> average wage</span> : null}
            {b.people != null ? <span><b>{b.people}</b> {b.people === 1 ? 'person' : 'people'}</span> : null}
            <span><b>{usd0(b.materialsUsd)}</b> materials{b.materialsPctOfPrice != null ? ` · ${Math.round(b.materialsPctOfPrice)}% of price` : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }} data-testid="baseline-keep">
            {kept.row ? <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{keptWords(kept.row)}</span> : null}
            {canWrite && !kept.row && !jobFinished && b.teamHours > 0 ? <button type="button" onClick={() => void kept.keepNow()} disabled={kept.busy} style={btn(true)} title="Keep what the job has taken so far as its baseline now — billing keeps one on its own">Keep as baseline</button> : null}
            {canWrite && kept.row && !jobFinished ? <button type="button" onClick={() => void kept.keepNow()} disabled={kept.busy} style={btn()} title="Take the baseline again from today's hours">Keep again ↻</button> : null}
            {!kept.row && jobFinished ? <span>{b.teamHours > 0 ? 'Not kept yet.' : 'No recorded hours to keep.'}</span> : null}
            {!kept.row && !jobFinished && b.teamHours > 0 ? <span>Kept automatically when the job bills.</span> : null}
            {kept.error ? <span style={{ color: 'var(--text-red-700)' }}>{kept.error}</span> : null}
          </div>
          {kept.rows.length > 0 ? (
            <details style={{ fontSize: '0.75rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>By fixture · {kept.rows.length} rows · hours split by {kept.rows[0]!.weight_source === 'predicted' ? "the bid's predicted hours" : 'count'}</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) auto auto', gap: '0.15rem 0.75rem', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {kept.rows.slice(0, 12).map((r) => <span key={r.fixture} style={{ display: 'contents' }}><span>{r.fixture}{r.unit ? <span style={{ color: 'var(--text-muted)' }}> · {r.unit}</span> : null}</span><span style={{ textAlign: 'right' }}>{Number(r.count).toLocaleString('en-US')}</span><span style={{ textAlign: 'right' }}>{Number(r.hours).toFixed(1)} h</span></span>)}
                {kept.rows.length > 12 ? <span style={{ gridColumn: '1 / -1', color: 'var(--text-muted)' }}>+{kept.rows.length - 12} more</span> : null}
              </div>
            </details>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {linkedBid ? (
              <>
                {onOpenBidCounts ? <button type="button" onClick={onOpenBidCounts} style={btn()}>Count sheet on {b.bidLabel} →</button> : null}
                {canWrite && budget.linkedBreakdown?.has_estimate ? <button type="button" onClick={() => void budget.linkAndSnapshot(linkedBid.id)} disabled={budget.busy} style={btn()}>Take its estimate</button> : null}
                <span>{budget.linkedBreakdown?.has_estimate ? `${b.bidLabel} has an estimate without hours — add hours on its Labor tab and take it again.` : `Add a count sheet and hours to ${b.bidLabel} and this job reads against them.`}</span>
              </>
            ) : (
              <button type="button" onClick={() => setDoorOpen((o) => !o)} aria-expanded={doorOpen} style={btn()}>Link the bid {doorOpen ? '▴' : '▾'}</button>
            )}
          </div>
          {!linkedBid && doorOpen ? <div>{doorway}</div> : null}
          {budget.error ? <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{budget.error}</p> : null}
        </div>
      )}
      <style>{`@media (max-width: 480px) { .job-costs-verdict-tiles { grid-template-columns: 1fr 1fr !important; } }`}</style>
    </div>
  )
}

export default JobCostsVerdict
