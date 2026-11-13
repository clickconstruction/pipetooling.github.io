/**
 * The Bill desk (punch list #192, v2.5930): the window behind the Bridge's Bill
 * step. Rebuilt onto the shared step frame (punch list #334, PR 1): it opens on the
 * finished work with no bill and the few things to do this week, one press
 * each. Everything the window printed whole before stays one press away: the
 * jobs with no price and the hand-marked bills open under their rows, and the
 * leaks, the pipe, the cost of waiting (with Billable today and the
 * billed-the-day-it-finished scorecard) and how it is counted sit in the folds
 * at the foot. Read-only: nothing is recorded here. Pure on its props:
 * `billDesk.ts` does the arithmetic, `billStepWindow.ts` picks the rows and
 * writes their words, `BridgeStepWindow.tsx` owns the chrome.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { stageUsd } from '../../lib/bridge/stageFlow'
import { BILL_TABLE_FOLD, type BillDesk, type BillDeskFacts, type BillLeak, type BillScorecardWeek } from '../../lib/bridge/bill/billDesk'
import { BILL_STEP_NOTHING, billHowCounted, billStepWords, type BillStepRow, type BillStepRowKind } from '../../lib/bridge/bill/billStepWindow'
import { BridgeStepWindow, type StepFoldSpec, type StepGroup, type StepRow } from './BridgeStepWindow'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
const sectionHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const sectionTitle: CSSProperties = { fontSize: '1rem', fontWeight: 700 }
const foldBody: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, fontVariantNumeric: 'tabular-nums' }
/** A door taps on a phone: 44px tall, bordered, the words ending in ›. */
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none', color: 'var(--text)', background: 'var(--surface)', whiteSpace: 'nowrap' }
const rowHead: CSSProperties = { width: '100%', font: 'inherit', background: 'none', border: 0, padding: '10px 12px', minHeight: 44, display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'baseline', textAlign: 'left', cursor: 'pointer', color: 'inherit' }
const listBox: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '2px 12px' }
const listRow: CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', fontSize: '0.86rem' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 10px 4px', borderBottom: '1px solid var(--border)', fontWeight: 700 }
const td: CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', verticalAlign: 'top' }
const num: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' }

const WEEK_TONE: Record<BillScorecardWeek['tone'], string> = { good: 'var(--text-green-700)', bad: 'var(--text-red-600)', none: 'var(--text-muted)' }

export type BridgeBillDeskProps = {
  /** What the page knows before the desk's own reads land: the verdict, the paces, the pipe, the meter. */
  facts: BillDeskFacts
  /** The rows; null while the desk's reads are in flight. */
  desk: BillDesk | null
  error: string | null
  /** Bill is the lit link: the headline reads red. */
  isLink: boolean
  /** "Mon, Oct 26 · pay week Oct 25–31". */
  readStamp: string
  onClose: () => void
}

function PipeCell({ head, usd, sub, gap }: { head: string; usd: number | null; sub?: string; gap?: boolean }) {
  return (
    <div style={gap ? { display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center', padding: '6px 8px', textAlign: 'center' } : { ...card, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={det}>{head}</span>
      <b style={{ fontSize: gap ? '1rem' : '1.1rem', color: gap ? 'var(--text-red-600)' : 'var(--text)' }}>{usd == null ? '—' : stageUsd(usd)}</b>
      {sub && <span style={{ ...det, fontSize: '0.72rem' }}>{sub}</span>}
    </div>
  )
}

export function BridgeBillDesk(props: BridgeBillDeskProps) {
  const { facts, desk, error, isLink, readStamp, onClose } = props
  const [openLeak, setOpenLeak] = useState<string | null>(null)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [allRows, setAllRows] = useState(false)
  /** The row whose list is open under it: the jobs with no price, or the bills marked billed by hand. */
  const [openList, setOpenList] = useState<BillStepRowKind | null>(null)
  const words = useMemo(() => billStepWords(facts, desk), [facts, desk])

  const leakKey = (l: BillLeak): string => `${l.kind}:${l.jobId}:${l.billId ?? ''}`
  const renderLeak = (l: BillLeak, testId: string) => {
    const key = leakKey(l)
    const open = openLeak === key
    return (
      <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }} data-testid={testId}>
        <button type="button" aria-expanded={open} onClick={() => setOpenLeak(open ? null : key)} style={rowHead}>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', minWidth: 64, flex: 'none' }}>{l.amountText}</span>
          <span style={{ color: l.satDays == null ? 'var(--text-muted)' : 'var(--text-red-600)', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 64, flex: 'none' }}>{l.satText}</span>
          <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}>
            <b>{l.head}</b> {l.detail}
          </span>
          <span aria-hidden style={{ color: 'var(--text-muted)', flex: 'none', transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}>
            ›
          </span>
        </button>
        {open && (
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', padding: '10px 12px 12px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text)' }}>The read that proves it:</b> {l.proof}
            </div>
            <div>
              <Link to={l.door.to} style={door}>
                {l.door.label} ›
              </Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  const pipe = facts.pipe
  const score = desk?.scorecard ?? null
  const rows = score ? (allRows ? score.rows : score.rows.slice(0, BILL_TABLE_FOLD)) : []
  const errorLine = error ? (
    <div role="alert" style={{ fontSize: '0.9rem', color: 'var(--text-red-700)', overflowWrap: 'anywhere' }} data-testid="bridge-bill-error">
      This window could not read its jobs and bills. {error}
    </div>
  ) : null
  const reading = <div style={det}>Reading the jobs…</div>
  const notRead = <div style={det}>The jobs and bills could not be read.</div>

  // The lists two rows open under themselves.
  const noPriceList = (
    <div style={listBox} data-testid="bridge-bill-noprice-list">
      {words.noPrice.map((l) => (
        <div key={l.jobId} style={listRow} data-testid="bridge-bill-noprice">
          <span style={{ flex: '1 1 150px', minWidth: 0, overflowWrap: 'anywhere' }}>
            <b>{l.label ?? 'A job with no name'}</b> <span style={det}>{l.amountText} this window</span>
          </span>
          <Link to={l.door.to} style={door}>
            {l.door.label} ›
          </Link>
        </div>
      ))}
    </div>
  )
  const handList = desk ? (
    <div style={foldBody} data-testid="bridge-bill-hand-list">
      {desk.handMarked.map((l) => renderLeak(l, 'bridge-bill-hand'))}
      <div style={det} data-testid="bridge-bill-hand-note">
        {desk.handMarkedNote}
      </div>
    </div>
  ) : null

  const stepRow = (r: BillStepRow, primary: boolean): StepRow => {
    const testId = `bridge-bill-press-${r.key}`
    if (r.to) return { key: r.key, title: r.title, sub: r.sub, press: { label: r.press, to: r.to, primary, testId } }
    const open = openList === r.kind
    return {
      key: r.key,
      title: r.title,
      sub: r.sub,
      press: { label: open ? (r.pressOpen ?? r.press) : r.press, onClick: () => setOpenList(open ? null : r.kind), primary, testId },
      under: open ? (r.kind === 'no-price' ? noPriceList : handList) : undefined,
    }
  }
  const groups: StepGroup[] = [
    { key: 'do', title: 'Do this week', rows: words.doRows.map((r, i) => stepRow(r, i === 0)), shown: 4, empty: desk ? BILL_STEP_NOTHING : error ? undefined : 'Reading the jobs…' },
    { key: 'ask', title: 'Did the customer get these?', rows: words.askRows.map((r) => stepRow(r, false)), empty: desk && words.askRows.length === 0 ? desk.handMarkedNote : undefined },
  ]

  const folds: StepFoldSpec[] = [
    {
      key: 'leaks',
      label: words.leakCount == null ? 'Every leak' : `Every leak (${words.leakCount})`,
      content: (
        <div style={foldBody}>
          <div style={sectionHead}>
            <div style={sectionTitle}>The leaks</div>
            <span style={det}>money that stands still unless someone acts, biggest first</span>
          </div>
          {error ? (
            notRead
          ) : !desk ? (
            reading
          ) : (
            <>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }} data-testid="bridge-bill-leaks-headline">
                {desk.headline}
              </div>
              {desk.leaks.map((l) => renderLeak(l, 'bridge-bill-row'))}
              <div style={det}>{desk.leaksNote}</div>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'pipe',
      label: 'The pipe, this window',
      content: (
        <div style={foldBody}>
          <div style={sectionHead}>
            <div style={sectionTitle}>The pipe, this window</div>
            <span style={det}>{pipe.windowWeeks} weeks, by the %s and the reports</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, alignItems: 'stretch' }} data-testid="bridge-bill-pipe">
            <PipeCell head="finished by the field" usd={pipe.finishedUsd} sub="by the %s and the reports" />
            <PipeCell head="finished, no bill yet" usd={pipe.unbilledUsd} sub={`${stageUsd(pipe.unbilledReadyUsd)} ready, ${stageUsd(pipe.unbilledPctUsd)} by the %`} gap />
            <PipeCell head="billed" usd={pipe.billedUsd} sub="invoiced this window" />
            <PipeCell head="billed, not yet paid" usd={pipe.arUsd} sub="Collect's desk" gap />
            <PipeCell head="paid" usd={pipe.paidUsd} sub="landed in the bank" />
          </div>
          <div style={det}>{pipe.line}</div>
          <div style={det}>{facts.subLine}</div>
        </div>
      ),
    },
    {
      key: 'cost',
      label: 'What waiting costs',
      content: (
        <div style={{ ...foldBody, gap: 14 }}>
          <div style={{ ...card, borderLeft: '3px solid #2563eb', display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="bridge-bill-meter">
            <div style={label}>{facts.meter.head}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{facts.meter.value}</div>
            <div style={{ fontSize: '0.85rem' }}>{facts.meter.words.join(' ')}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={sectionHead}>
              <div style={sectionTitle}>Billable today</div>
              <span style={det}>the fast lane, the jobs the office marked ready to bill</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }} data-testid="bridge-bill-verdict">
              {facts.verdict}
            </div>
            {error && !desk ? notRead : !desk ? reading : null}
            {desk && (
              <>
                {desk.fast.length > 0 && (
                  <div style={listBox}>
                    {desk.fast.map((r) => (
                      <div key={r.jobId} style={listRow} data-testid="bridge-bill-fast">
                        <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}>
                          <b>{r.label}</b> <span style={det}>· {r.coverText}</span>
                        </span>
                        <span style={{ color: r.satDays == null ? 'var(--text-muted)' : r.late ? 'var(--text-red-600)' : 'var(--text-green-700)', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.satText}</span>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 64, textAlign: 'right' }}>{stageUsd(r.usd)}</span>
                        <Link to={r.door.to} style={door}>
                          {r.door.label} ›
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                <div style={det}>{desk.fastNote}</div>
              </>
            )}
          </div>

          {score && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button type="button" aria-expanded={scoreOpen} onClick={() => setScoreOpen((v) => !v)} style={{ ...rowHead, ...card, borderRadius: scoreOpen ? '10px 10px 0 0' : 10, gap: 10 }} data-testid="bridge-bill-scorecard">
                <span style={sectionTitle}>The rule, lately</span>
                <span style={det}>billed the day it finished?</span>
                <span style={{ fontWeight: 700, color: score.withReady === 0 ? 'var(--text-muted)' : score.sameDay === score.withReady ? 'var(--text-green-700)' : 'var(--text-red-600)' }}>{score.headText}</span>
                <span style={det}>{score.costLabel}</span>
                <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-muted)', transform: scoreOpen ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}>
                  ›
                </span>
              </button>
              {scoreOpen && (
                <div style={{ border: '1px solid var(--border)', borderTop: 0, borderRadius: '0 0 10px 10px', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 6 }} aria-hidden="true">
                    {score.weeks.map((w) => (
                      <div key={w.start} title={`week of ${w.label}: ${w.sent === 0 ? 'no bill with a ready day' : `${w.same} of ${w.sent} the same day`}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <b style={{ fontSize: '1rem', color: WEEK_TONE[w.tone] }}>{w.sent === 0 ? '—' : `${w.same}/${w.sent}`}</b>
                        <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${w.sent === 0 ? 0 : Math.round((w.same / w.sent) * 100)}%`, background: WEEK_TONE[w.tone] }} />
                        </div>
                        <span style={{ ...det, fontSize: '0.7rem' }}>{w.label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={det}>bills that went out the day their job finished, over the bills sent that week</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="bridge-bill-table">
                      <thead>
                        <tr>
                          <th style={th}>Bill</th>
                          <th style={th}>Ready</th>
                          <th style={th}>Billed</th>
                          <th style={{ ...th, ...num }}>Lag</th>
                          <th style={th}>Sent by</th>
                          <th style={{ ...th, ...num }}>Cash-days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td style={td}>{r.bill}</td>
                            <td style={td}>{r.readyText}</td>
                            <td style={td}>{r.billedText}</td>
                            <td style={{ ...td, ...num, fontWeight: 700, color: r.lagDays == null ? 'var(--text-muted)' : r.late ? 'var(--text-red-600)' : 'var(--text-green-700)' }}>{r.lagText}</td>
                            <td style={td}>{r.sentBy}</td>
                            <td style={{ ...td, ...num }}>{r.cashDaysText}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {score.rows.length > BILL_TABLE_FOLD && !allRows && (
                    <div>
                      <button type="button" onClick={() => setAllRows(true)} style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.8rem', cursor: 'pointer' }}>
                        Show all {score.rows.length}
                      </button>
                    </div>
                  )}
                  {score.noReadyLine && <div style={det}>{score.noReadyLine}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'counted',
      label: 'How this is counted',
      content: (
        <div style={foldBody} data-testid="bridge-bill-counted">
          <div style={{ fontSize: '0.84rem', color: 'var(--text-700)', lineHeight: 1.5 }}>{billHowCounted().join(' ')}</div>
          <div style={det}>Read {readStamp}</div>
        </div>
      ),
    },
  ]

  return (
    <BridgeStepWindow
      testId="bridge-bill-desk"
      ariaLabel="Bill, broken down"
      eyebrow="Bill · the work done"
      headline={words.headline}
      headlineTestId="bridge-bill-headline"
      tone={isLink ? 'bad' : 'plain'}
      line={words.line}
      summary={errorLine}
      groups={groups}
      folds={folds}
      footer={
        <div>
          <Link to="/jobs?tab=billing" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: '0.84rem', color: 'var(--text-link)', textDecoration: 'none' }} data-testid="bridge-bill-open-billing">
            Open Billing ›
          </Link>
        </div>
      }
      onClose={onClose}
    >
      {words.ruleLine ? (
        <div style={{ fontSize: '0.86rem', color: 'var(--text-700)' }} data-testid="bridge-bill-rule">
          {words.ruleLine}
        </div>
      ) : null}
    </BridgeStepWindow>
  )
}
