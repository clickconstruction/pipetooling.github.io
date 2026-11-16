import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useScorecard } from '../../hooks/useScorecard'
import { HURDLE_TARGET_HREF, HURDLE_TARGET_WORDS, hurdleWords, usdPerHour } from '../../lib/scorecard/hurdle'
import { fieldByOwner, fieldRowNote, type FieldOwnerLine, type FieldScoreJobRow } from '../../lib/scorecard/fieldScore'
import { STALE_PROPOSAL_DAYS, type EstimatorRow } from '../../lib/scorecard/estimatorScore'
import { SCORECARD_WINDOWS } from '../../lib/scorecard/loadScorecard'
import { SCORES_SOURCE_WORDS } from '../../lib/scorecard/scorecardWire'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'

/**
 * People → Review → Scores (team scorecard, design spike 2026-11-15): the team's two numbers over one
 * window, each with its owner, the hurdle where it applies, and one drill-down. The field score is gross
 * profit on every paid field hour; the estimating and sales score is gross profit won above the hurdle,
 * corrected to the actual as jobs close. Nothing else is a card: a count would get optimized instead.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem', display: 'grid', gap: 6, background: 'var(--surface)', minWidth: 0 }
const th: CSSProperties = { padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const td: CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.86rem', verticalAlign: 'top' }
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const btn: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, padding: '0.3rem 0.7rem', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer', color: 'inherit' }
const btnOn: CSSProperties = { ...btn, background: 'var(--bg-muted)', fontWeight: 700 }

const usd0 = (n: number | null | undefined): string => (n == null ? '—' : `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`)
const h0 = (n: number): string => `${Math.round(n).toLocaleString('en-US')} h`
const tone = (clears: boolean | null): string => (clears == null ? 'inherit' : clears ? 'var(--text-green-700)' : 'var(--text-red-700)')
const who = (r: Pick<EstimatorRow, 'estimatorName' | 'accountManagerName'>): string => [...new Set([r.estimatorName, r.accountManagerName].filter(Boolean))].join(' · ') || '—'
const bidLabel = (r: Pick<EstimatorRow, 'bidNumber' | 'projectName'>): string => [r.bidNumber ? `B${r.bidNumber}` : null, r.projectName].filter(Boolean).join(' ') || 'A bid'

export function PeopleScoresTab() {
  const jobDetail = useJobDetailModal()
  const todayYmd = todayYmdInAppTz()
  const [windowDays, setWindowDays] = useState(56)
  const { read, source, loading, error } = useScorecard({ windowDays, todayYmd })
  const [open, setOpen] = useState<'field' | 'bids' | null>(null)

  const estimatorAwarded = useMemo(() => read?.estimator.awarded ?? [], [read])
  const ownerLines = useMemo(() => (read ? fieldByOwner(read.field.rows, read.ownersByJob, read.hurdle) : []), [read])

  return (
    <div style={{ display: 'grid', gap: '0.9rem', padding: '0.5rem 0' }} data-testid="team-scores">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem 1rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Scores</h2>
        <span style={muted}>two numbers, one formula each, judged against the hurdle</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }} role="group" aria-label="Window">
          {SCORECARD_WINDOWS.map((w) => (
            <button key={w.days} type="button" style={w.days === windowDays ? btnOn : btn} onClick={() => setWindowDays(w.days)} aria-pressed={w.days === windowDays}>
              {w.label}
            </button>
          ))}
        </span>
      </div>

      {error ? <div style={{ ...muted, color: 'var(--text-red-700)' }}>{error}</div> : null}
      {loading && !read ? <div style={muted}>Reading the hours, the bills, the materials and the bids…</div> : null}

      {read ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.9rem' }}>
            <section style={card} data-testid="field-score" aria-label="Field score">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <b style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Field</b>
                <span style={muted}>the crew · {read.windowDays} days</span>
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.05, color: tone(read.field.clears), fontVariantNumeric: 'tabular-nums' }} data-testid="field-score-figure">
                {read.field.perHourUsd == null ? '—' : usdPerHour(read.field.perHourUsd)}
              </div>
              <div style={{ fontSize: '0.86rem' }}>gross profit on every paid field hour</div>
              <div style={{ fontSize: '0.86rem' }}>
                hurdle <b>{read.hurdle.hurdlePerHourUsd == null ? '—' : usdPerHour(read.hurdle.hurdlePerHourUsd)}</b>
                {read.hurdle.breakEvenPerHourUsd != null ? <span style={muted}> · break-even {usdPerHour(read.hurdle.breakEvenPerHourUsd)} + {usdPerHour(read.hurdle.targetProfitPerHourUsd)} target</span> : null}
              </div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-700)' }}>{read.field.verdict}</div>
              <div style={muted}>
                earned {usd0(read.field.earnedUsd)} · labor {usd0(read.field.laborUsd)} at ×{read.burden} · materials {usd0(read.field.materialsUsd)} · subs {usd0(read.field.subUsd)}
              </div>
              {ownerLines.some((l) => l.owner) ? (
                <div style={muted} data-testid="field-owners-line">
                  {ownerLines
                    .filter((l) => l.owner)
                    .map((l) => `${l.owner!.name} ${l.perHourUsd == null ? '—' : usdPerHour(l.perHourUsd)} on ${Math.round(l.paidHours)} h`)
                    .join(' · ')}
                </div>
              ) : null}
              {read.pendingFieldHours > 0 ? <div style={{ ...muted, color: 'var(--text-amber-700)' }}>{h0(read.pendingFieldHours)} of closed sessions still wait on approval; they count as paid time.</div> : null}
              {read.field.noBillCount > 0 ? <div style={{ ...muted, color: 'var(--text-amber-700)' }}>{read.field.noBillCount} {read.field.noBillCount === 1 ? 'job has' : 'jobs have'} hours and no bill. Nothing is earned on them until someone bills.</div> : null}
              <div>
                <button type="button" style={open === 'field' ? btnOn : btn} onClick={() => setOpen(open === 'field' ? null : 'field')} aria-expanded={open === 'field'} disabled={read.field.rows.length === 0}>
                  {open === 'field' ? 'Close the jobs' : `Open the ${read.field.rows.length} ${read.field.rows.length === 1 ? 'job' : 'jobs'}`}
                </button>
              </div>
            </section>

            <section style={card} data-testid="estimator-score" aria-label="Estimating and sales score">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <b style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Estimating & sales</b>
                <span style={muted}>one shared number · {read.windowDays} days</span>
              </div>
              {read.estimator.ramp ? (
                <>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: read.estimator.coverage.judged === 0 ? 'var(--text-amber-700)' : 'inherit' }} data-testid="estimator-score-figure">
                    {read.estimator.coverage.judged} of {read.estimator.coverage.total}
                  </div>
                  <div style={{ fontSize: '0.86rem' }}>priced bids that can be judged against the hurdle, until the first one scores</div>
                  <div style={muted}>Then: gross profit won above the hurdle, corrected as jobs close.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }} data-testid="estimator-score-figure">
                    {usd0(read.estimator.countedUsd)}
                  </div>
                  <div style={{ fontSize: '0.86rem' }}>gross profit won above the hurdle, corrected as jobs close</div>
                  <div style={{ fontSize: '0.86rem' }}>
                    won at award <b>{usd0(read.estimator.additionsUsd)}</b>
                    <span style={muted}> · closeouts moved it {usd0(read.estimator.adjustmentsUsd)} · still at the estimate {usd0(read.estimator.openAtEstimateUsd)}</span>
                  </div>
                </>
              )}
              <div style={{ fontSize: '0.86rem', color: 'var(--text-700)' }}>{read.estimator.verdict}</div>
              {read.estimator.people.length > 0 ? (
                <div style={muted}>{read.estimator.people.map((p) => `${p.name} ${usd0(p.countedUsd)} on ${p.bids + p.closed}`).join(' · ')}</div>
              ) : null}
              {read.estimator.waiting.length > 0 ? (
                <div style={{ ...muted, color: 'var(--text-amber-700)' }}>
                  {read.estimator.waiting.length} priced {read.estimator.waiting.length === 1 ? 'proposal is' : 'proposals are'} out with no answer, the oldest {read.estimator.waiting[0]!.daysOut} days.
                </div>
              ) : null}
              {read.estimator.toFinish.length > 0 && !read.estimator.ramp ? (
                <div style={{ ...muted, color: 'var(--text-amber-700)' }}>
                  {read.estimator.toFinish.length} priced {read.estimator.toFinish.length === 1 ? 'bid needs' : 'bids need'} the Labor tab finished before {read.estimator.toFinish.length === 1 ? 'it' : 'they'} can score.
                </div>
              ) : null}
              {read.estimator.waitingUnpriced > 0 || read.estimator.waitingStale > 0 ? (
                <div style={muted}>
                  {[
                    read.estimator.waitingUnpriced > 0 ? `${read.estimator.waitingUnpriced} out with no priced stamp` : null,
                    read.estimator.waitingStale > 0 ? `${read.estimator.waitingStale} out past ${STALE_PROPOSAL_DAYS} days with no answer, the Bid Board's to close` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  .
                </div>
              ) : null}
              {read.actualsUnread > 0 ? <div style={{ ...muted, color: 'var(--text-amber-700)' }}>{read.actualsUnread} finished {read.actualsUnread === 1 ? 'job’s actual' : 'jobs’ actuals'} could not be read; those bids stand at the estimate.</div> : null}
              <div>
                <button type="button" style={open === 'bids' ? btnOn : btn} onClick={() => setOpen(open === 'bids' ? null : 'bids')} aria-expanded={open === 'bids'}>
                  {open === 'bids' ? 'Close the bids' : 'Open the bids'}
                </button>
              </div>
            </section>
          </div>

          {open === 'field' ? (
            <>
              <OwnerRows lines={ownerLines} />
              <FieldRows rows={read.field.rows} burden={read.burden} openJob={jobDetail ? (jobId) => jobDetail.openJobDetail({ jobId }) : null} />
            </>
          ) : null}
          {open === 'bids' ? <EstimatorRows awarded={estimatorAwarded} closeouts={read.estimator.closeouts} underHurdle={read.estimator.underHurdle} held={read.estimator.held} waiting={read.estimator.waiting} toFinish={read.estimator.toFinish} /> : null}

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', display: 'grid', gap: 6 }} data-testid="scores-rule">
            <b style={{ fontSize: '0.86rem' }}>The hurdle</b>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>{hurdleWords(read.hurdle)}</div>
            {/* #360 PR 3: the target is a pricing rule now, set by the owner on the Bid Board beside what difficulty costs. */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-700)' }} data-testid="scores-target-door">
              {HURDLE_TARGET_WORDS.setOnBoard}{' '}
              <Link to={HURDLE_TARGET_HREF} style={{ fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}>
                {HURDLE_TARGET_WORDS.boardDoor}
              </Link>
            </div>
            {/* #360 PR 4: where the read was made. The server's read sends the scores and no wage. */}
            {source ? (
              <div style={muted} data-testid="scores-source">
                {source === 'server' ? SCORES_SOURCE_WORDS.server : SCORES_SOURCE_WORDS.browser}
              </div>
            ) : null}
            <b style={{ fontSize: '0.86rem', marginTop: 4 }}>How it is scored</b>
            {RULE_LINES.map((line) => (
              <div key={line} style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>
                {line}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {read && read.field.rows.length === 0 && read.estimator.awarded.length === 0 && !loading ? <EmptyState main="Nothing to score in this window." tail="A job appears when it has paid field hours, materials or a sub sheet in the window. A bid appears when it was awarded in the window with a priced margin and labor hours." /> : null}
    </div>
  )
}

const RULE_LINES = [
  'Field: gross profit ÷ paid field hours. Gross profit is what the hours earned of their jobs’ contracts, less those hours’ wages at the burden factor, the materials and the subs dated in the window. Every paid field hour counts, callbacks and waiting included.',
  'Hurdle: the window’s overhead pool ÷ its paid field hours (break-even), plus the target profit per hour. The same window as the score.',
  'Estimating & sales: a bid counts its priced gross profit at award when that profit over the award’s labor hours clears the hurdle. Awarded under the hurdle it counts zero and stays there. Once the job is billed or paid, the actual replaces the estimate. The estimator and the account manager share the number.',
  'A proposal out counts zero until it is awarded; it is listed with its days out so someone calls.',
  'Until the first judged bid is awarded, the estimating card shows how many of the priced bids in play can be judged: hours on nine rows in ten and every row costed. The company crew rate stands in when no rate is typed.',
]

function OwnerRows({ lines }: { lines: FieldOwnerLine[] }) {
  if (lines.length === 0) return null
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }} data-testid="field-owner-rows">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Who runs the jobs</th>
            <th style={thNum}>Jobs</th>
            <th style={thNum}>Paid hours</th>
            <th style={thNum}>Gross profit</th>
            <th style={thNum}>$/h</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.owner?.id ?? 'none'} data-testid="field-owner-row">
              <td style={td}>
                <b>{l.owner?.name ?? 'No superintendent'}</b>
                {l.noBill > 0 ? <span style={{ ...muted, marginLeft: 6, color: 'var(--text-amber-700)' }}>{l.noBill} with hours and no bill</span> : null}
                {!l.owner ? <div style={{ ...muted, fontSize: '0.74rem' }}>Jobs with no project superintendent and no GC project superintendent. A shared job splits evenly between its superintendents.</div> : null}
              </td>
              <td style={tdNum}>{l.jobs}</td>
              <td style={tdNum}>{h0(l.paidHours)}</td>
              <td style={{ ...tdNum, fontWeight: 600 }}>{usd0(l.grossProfitUsd)}</td>
              <td style={{ ...tdNum, fontWeight: 700, color: tone(l.clears) }}>{l.perHourUsd == null ? '—' : usdPerHour(l.perHourUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FieldRows({ rows, burden, openJob }: { rows: FieldScoreJobRow[]; burden: number; openJob: ((jobId: string) => void) | null }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }} data-testid="field-rows">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Job</th>
            <th style={thNum}>Paid hours</th>
            <th style={thNum}>Earned</th>
            <th style={thNum}>Labor ×{burden}</th>
            <th style={thNum}>Materials</th>
            <th style={thNum}>Subs</th>
            <th style={thNum}>Gross profit</th>
            <th style={thNum}>$/h</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const note = fieldRowNote(r)
            return (
              <tr key={r.jobId} data-testid="field-row">
                <td style={td}>
                  {openJob ? (
                    <button type="button" onClick={() => openJob(r.jobId)} style={{ ...btn, border: 'none', padding: 0, fontWeight: 600, fontSize: '0.86rem' }} title="Open the job">
                      {r.label}
                    </button>
                  ) : (
                    <b>{r.label}</b>
                  )}
                  {note ? (
                    <div style={{ ...muted, fontSize: '0.74rem', color: 'var(--text-amber-700)' }}>
                      {note}
                      {r.flags.noBill && openJob ? (
                        <>
                          {' '}
                          <button type="button" onClick={() => openJob(r.jobId)} style={{ ...btn, border: 'none', padding: 0, fontSize: '0.74rem', color: 'var(--text-blue-700)', fontWeight: 600 }}>
                            Open the job to bill it →
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                <td style={tdNum}>{r.paidHours > 0 ? h0(r.paidHours) : '—'}</td>
                <td style={tdNum}>{r.earnedUsd == null ? '—' : usd0(r.earnedUsd)}</td>
                <td style={tdNum}>{usd0(r.laborUsd)}</td>
                <td style={tdNum}>{usd0(r.materialsUsd)}</td>
                <td style={tdNum}>{usd0(r.subUsd)}</td>
                <td style={{ ...tdNum, fontWeight: 600 }}>{usd0(r.grossProfitUsd)}</td>
                <td style={{ ...tdNum, fontWeight: 700, color: tone(r.clears) }}>{r.perHourUsd == null ? '—' : usdPerHour(r.perHourUsd)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EstimatorRows({ awarded, closeouts, underHurdle, held, waiting, toFinish }: { awarded: EstimatorRow[]; closeouts: EstimatorRow[]; underHurdle: EstimatorRow[]; held: EstimatorRow[]; waiting: EstimatorRow[]; toFinish: EstimatorRow[] }) {
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }} data-testid="estimator-rows">
      {toFinish.length > 0 ? (
        <div style={{ border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.6rem 0.9rem', display: 'grid', gap: 4 }} data-testid="estimator-to-finish">
          <b style={{ fontSize: '0.8rem' }}>Finish these before they can score</b>
          {toFinish.map((r) => (
            <div key={r.bidId} style={{ fontSize: '0.8rem' }}>
              <a href={`/bids?bidId=${encodeURIComponent(r.bidId)}&tab=labor`} style={{ color: 'var(--text-blue-700)', fontWeight: 600, textDecoration: 'none' }}>
                {bidLabel(r)} · open the Labor tab →
              </a>{' '}
              <span style={muted}>
                {r.customerName ?? '—'} · {who(r)} · {r.outcome ? 'awarded' : `out ${r.daysOut} days`} · {r.note}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Awarded above the hurdle</th>
              <th style={th}>GC</th>
              <th style={th}>Who</th>
              <th style={th}>Awarded</th>
              <th style={thNum}>Expected profit</th>
              <th style={thNum}>$/h at award</th>
              <th style={thNum}>Counts today</th>
              <th style={thNum}>Moved by</th>
            </tr>
          </thead>
          <tbody>
            {awarded.length === 0 ? (
              <tr>
                <td style={td} colSpan={8}>
                  <EmptyState compact main="Nothing waiting on the estimators here: no bid awarded above the hurdle in the window." tail="A bid lands here on the day it is awarded with a priced stamp and labor hours that clear the hurdle." />
                </td>
              </tr>
            ) : null}
            {awarded.map((r) => (
              <tr key={r.bidId} data-testid="estimator-row">
                <td style={td}>
                  <a href={`/bids?bidId=${encodeURIComponent(r.bidId)}`} style={{ color: 'inherit', fontWeight: 600 }}>{bidLabel(r)}</a>
                  <div style={{ ...muted, fontSize: '0.74rem' }}>{r.kind === 'closed' ? `${r.job?.label ?? 'the job'} · closed, at the actual` : r.job ? `${r.job.label} · open, at the estimate` : 'no job linked · at the estimate'}</div>
                  {r.note ? <div style={{ ...muted, fontSize: '0.74rem', color: 'var(--text-amber-700)' }}>{r.note}</div> : null}
                </td>
                <td style={td}>{r.customerName ?? '—'}</td>
                <td style={td}>{who(r)}</td>
                <td style={td}>{r.outcomeYmd ?? '—'}</td>
                <td style={tdNum}>{usd0(r.expectedGrossProfitUsd)}</td>
                <td style={{ ...tdNum, color: tone(r.clearsAtAward) }}>{r.expectedPerHourUsd == null ? '—' : usdPerHour(r.expectedPerHourUsd)}</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>{usd0(r.countedUsd)}</td>
                <td style={{ ...tdNum, color: r.adjustmentUsd == null ? 'inherit' : r.adjustmentUsd < 0 ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>{r.adjustmentUsd == null ? '—' : usd0(r.adjustmentUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {closeouts.length > 0 ? (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }} data-testid="estimator-closeouts">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Closed in the period</th>
                <th style={th}>Who</th>
                <th style={th}>Closed</th>
                <th style={thNum}>Expected profit</th>
                <th style={thNum}>Actual profit</th>
                <th style={thNum}>Moved by</th>
              </tr>
            </thead>
            <tbody>
              {closeouts.map((r) => (
                <tr key={r.bidId} data-testid="closeout-row">
                  <td style={td}>
                    <a href={`/bids?bidId=${encodeURIComponent(r.bidId)}`} style={{ color: 'inherit', fontWeight: 600 }}>{bidLabel(r)}</a>
                    <div style={{ ...muted, fontSize: '0.74rem' }}>{r.job?.label ?? ''}{r.note ? ` · ${r.note}` : ''}</div>
                  </td>
                  <td style={td}>{who(r)}</td>
                  <td style={td}>{r.job?.closedYmd ?? r.outcomeYmd ?? '—'}</td>
                  <td style={tdNum}>{usd0(r.expectedGrossProfitUsd)}</td>
                  <td style={tdNum}>{usd0(r.job?.actualGrossProfitUsd ?? null)}</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: r.adjustmentUsd == null ? 'inherit' : r.adjustmentUsd < 0 ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>{r.adjustmentUsd == null ? '—' : usd0(r.adjustmentUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {underHurdle.length > 0 || held.some((r) => !r.needsEstimate) ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.9rem', display: 'grid', gap: 4 }} data-testid="estimator-zero">
          <b style={{ fontSize: '0.8rem' }}>Awarded, counting zero</b>
          {[...underHurdle, ...held.filter((r) => !r.needsEstimate)].map((r) => (
            <div key={r.bidId} style={{ fontSize: '0.8rem' }}>
              <a href={`/bids?bidId=${encodeURIComponent(r.bidId)}`} style={{ color: 'inherit', fontWeight: 600 }}>{bidLabel(r)}</a> · {r.customerName ?? '—'} · {who(r)} · {usd0(r.expectedGrossProfitUsd)} expected
              {r.note ? <span style={{ ...muted, marginLeft: 6 }}>{r.note}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Out, waiting on a decision</th>
              <th style={th}>GC</th>
              <th style={th}>Who</th>
              <th style={thNum}>Days out</th>
              <th style={thNum}>Priced profit</th>
              <th style={thNum}>$/h</th>
            </tr>
          </thead>
          <tbody>
            {waiting.length === 0 ? (
              <tr>
                <td style={td} colSpan={6}>
                  <EmptyState compact main="Nothing waiting on a decision: no priced proposal is out." tail="A proposal lands here once it is sent with a priced stamp and labor hours, until it is won or lost." />
                </td>
              </tr>
            ) : null}
            {waiting.map((r) => (
              <tr key={r.bidId} data-testid="waiting-row">
                <td style={td}>
                  <a href={`/bids?bidId=${encodeURIComponent(r.bidId)}`} style={{ color: 'inherit', fontWeight: 600 }}>{bidLabel(r)}</a>
                  {r.note ? <div style={{ ...muted, fontSize: '0.74rem', color: 'var(--text-amber-700)' }}>{r.note}</div> : null}
                </td>
                <td style={td}>{r.customerName ?? '—'}</td>
                <td style={td}>{who(r)}</td>
                <td style={{ ...tdNum, fontWeight: (r.daysOut ?? 0) > 21 ? 700 : 400 }}>{r.daysOut ?? '—'}</td>
                <td style={tdNum}>{usd0(r.expectedGrossProfitUsd)}</td>
                <td style={{ ...tdNum, color: tone(r.clearsAtAward) }}>{r.expectedPerHourUsd == null ? '—' : usdPerHour(r.expectedPerHourUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PeopleScoresTab
