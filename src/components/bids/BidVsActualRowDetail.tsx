import type { CSSProperties } from 'react'
import type { CostsVerdict } from '../../lib/jobs/jobCostsVerdict'
import { BID_STAGE_LABELS, stageEarnedPaceWords } from '../../lib/bids/stageEarnedValue'
import { useJobStageEarnedValue } from '../../hooks/useJobStageEarnedValue'

const td: CSSProperties = { padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.76rem', verticalAlign: 'top' }
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const th: CSSProperties = { ...td, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textAlign: 'left' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const muted: CSSProperties = { color: 'var(--text-muted)' }
const usd0 = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
const h0 = (n: number) => `${Math.round(n).toLocaleString('en-US')} h`
const pct0 = (n: number | null) => (n == null ? '' : ` · ${Math.round(n)}%`)

/**
 * A Bid vs actual row opened (Burn against the bid, piece 2, v2.5046): the job's burn by section as
 * its Costs tab reads it (the dollar roles only — wages are in it), and earned value by stage in
 * hours (every role of the lens). The section words are the Costs tab's own (`buildCostsVerdict`).
 */
export function BidVsActualRowDetail({ jobId, bidId, recordedHours, verdict, showDollars }: {
  jobId: string
  bidId: string
  recordedHours: number
  /** The job's verdict; null while it loads, 'error' when its read failed. Ignored without dollars. */
  verdict: CostsVerdict | 'error' | null
  showDollars: boolean
}) {
  const stage = useJobStageEarnedValue(true, jobId, bidId, recordedHours)
  const ev = stage.ev
  const pace = ev ? stageEarnedPaceWords(ev) : null
  return (
    <div style={{ display: 'grid', gap: '0.6rem', padding: '0.5rem 0.25rem 0.75rem' }} data-testid="bva-row-detail">
      {showDollars ? (
        verdict === 'error' ? (
          <p style={{ margin: 0, fontSize: '0.76rem', ...muted }}>The job's costs could not be read.</p>
        ) : verdict == null ? (
          <p style={{ margin: 0, fontSize: '0.76rem', ...muted }}>Reading the job's costs…</p>
        ) : (
          <div>
            <b style={{ fontSize: '0.78rem' }}>By section, at today's pace</b> <span style={{ ...muted, fontSize: '0.7rem' }}>· as the job's Costs tab reads it · bid figures: {verdict.budgetLabel}</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }} data-testid="bva-sections">
              <thead>
                <tr><th style={th}>Section</th><th style={thNum}>Spent so far</th><th style={thNum}>At completion</th><th style={thNum}>Bid figure</th><th style={th}>Read</th></tr>
              </thead>
              <tbody>
                {verdict.sections.map((s) => (
                  <tr key={s.key} data-testid={`bva-section-${s.key}`}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}><b>{s.label}</b> <span style={{ ...muted, fontSize: '0.68rem' }}>{s.hours != null ? `${h0(s.hours)} · ` : ''}{s.sub}</span></td>
                    <td style={tdNum}>{usd0(s.spentUsd)}</td>
                    <td style={tdNum}>{s.atCompletionUsd != null ? usd0(s.atCompletionUsd) : '—'}</td>
                    <td style={{ ...tdNum, ...(s.budgetUsd == null && s.budgetHours == null ? muted : {}) }}>{s.budgetHours != null ? `${h0(s.budgetHours)}${s.budgetUsd != null ? ` · ${usd0(s.budgetUsd)}` : ''}` : s.budgetUsd != null ? usd0(s.budgetUsd) : s.budgetWords}</td>
                    <td style={{ ...td, ...muted }}>{s.pctOfBudget != null ? `${Math.round(s.pctOfBudget)}% of the bid figure${s.aheadPts != null ? (s.aheadPts > 5 ? ' · ahead of the work' : s.aheadPts < -5 ? ' · behind the work' : ' · with the work') : ''}` : ''}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                  <td style={td}>Direct cost</td>
                  <td style={tdNum}>{usd0(verdict.spent.usd)}</td>
                  <td style={tdNum}>{verdict.eacUsd != null ? usd0(verdict.eacUsd) : '—'}</td>
                  <td style={td} />
                  <td style={{ ...td, ...muted, fontWeight: 400 }}>{verdict.eacUsd != null && verdict.pctDone != null ? `spent ÷ ${Math.round(verdict.pctDone)}% done` : ''}</td>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td style={td}>Direct margin</td>
                  <td style={tdNum}>{verdict.earned ? `${usd0(verdict.earned.aheadUsd)} so far` : ''}</td>
                  <td style={tdNum} data-testid="bva-direct-margin">{verdict.directMargin ? `${usd0(verdict.directMargin.usd)}${pct0(verdict.directMargin.pct)}` : '—'}</td>
                  <td style={{ ...tdNum, ...muted, fontWeight: 400 }}>{verdict.priceUsd != null ? `on ${usd0(verdict.priceUsd)}` : ''}</td>
                  <td style={{ ...td, ...muted, fontWeight: 400 }}>no overhead here · the Costs tab adds it</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      ) : null}

      <div data-testid="bva-stage-ev">
        <b style={{ fontSize: '0.78rem' }}>Earned value by stage</b>{' '}
        <span style={{ ...muted, fontSize: '0.72rem' }}>
          {stage.loading ? '· reading the stages…' : stage.failed ? '· the stages could not be read' : ev ? `· ${ev.words}${pace ? ` · ${pace}` : ''}` : ''}
        </span>
        {ev && ev.bidHours > 0 && ev.read !== 'no-stage-lines' ? (
          <table style={{ width: '100%', maxWidth: 560, borderCollapse: 'collapse', marginTop: 4 }}>
            <thead>
              <tr><th style={th}>Stage</th><th style={thNum}>Bid hours</th><th style={thNum}>Progress</th><th style={thNum}>Earned</th><th style={th}>Billing lines</th></tr>
            </thead>
            <tbody>
              {ev.stages.map((s) => (
                <tr key={s.stage} data-testid={`bva-stage-${s.stage}`}>
                  <td style={td}>{BID_STAGE_LABELS[s.stage]}</td>
                  <td style={tdNum}>{s.bidHours > 0 ? h0(s.bidHours) : '—'}</td>
                  <td style={tdNum}>{s.progressPct != null ? `${Math.round(s.progressPct)}%` : s.lines.length > 0 ? 'not reported' : '—'}</td>
                  <td style={tdNum}>{s.earnedHours != null ? h0(s.earnedHours) : '—'}</td>
                  <td style={{ ...td, ...muted }}>{s.lines.length > 0 ? s.lines.join(', ') : 'no line names it'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {ev && ev.unmapped.length > 0 ? (
          <div style={{ ...muted, fontSize: '0.72rem', marginTop: 4 }} data-testid="bva-stage-unmapped">
            Lines that name no stage, left out: {ev.unmapped.join(', ')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
