/**
 * The Bill desk (punch list #192, v2.5930): the modal behind the Bridge's Bill
 * card's Break it down. The header the page already knows (the verdict, the
 * paces), the pipe strip, then the leaks (each row a crossing of two reads,
 * with the read that proves it folded under and one door), the fast lane of
 * ready-to-bill jobs with the days each has sat, the billed-the-day-it-finished
 * scorecard folded under one line, the cost of a week of sitting, and the
 * footnote on how it reads. Read-only: no plan is recorded here, the Bridge's
 * call stays with the lit link. Pure on its props: `billDesk.ts` does the
 * arithmetic and the words; the chrome matches `BridgeCollectDesk.tsx`.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { stageUsd } from '../../lib/bridge/stageFlow'
import { BILL_TABLE_FOLD, type BillDesk, type BillDeskFacts, type BillScorecardWeek } from '../../lib/bridge/bill/billDesk'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
const sectionHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }
const sectionTitle: CSSProperties = { fontSize: '1rem', fontWeight: 700 }
/** A door taps on a phone: 36px tall, bordered, the words ending in ›. */
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 36, border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none', color: 'var(--text)', background: 'var(--surface)' }
const rowHead: CSSProperties = { width: '100%', font: 'inherit', background: 'none', border: 0, padding: '10px 12px', minHeight: 44, display: 'flex', gap: 12, alignItems: 'baseline', textAlign: 'left', cursor: 'pointer', color: 'inherit' }
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pipe = facts.pipe
  const score = desk?.scorecard ?? null
  const rows = score ? (allRows ? score.rows : score.rows.slice(0, BILL_TABLE_FOLD)) : []

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 750, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(24px + var(--app-top-chrome, 0px)) 16px 24px', overflow: 'auto' }} data-testid="bridge-bill-desk">
      <div role="dialog" aria-modal="true" aria-label="Bill, broken down" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: 'min(1040px, 100%)', padding: '1.1rem 1.3rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={label}>
              Bill · the work done <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>· read {readStamp}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: isLink ? 'var(--text-red-600)' : 'var(--text)', lineHeight: 1.15 }} data-testid="bridge-bill-headline">
              {desk ? desk.headline : 'Where billing leaks: reading the rows…'}
            </div>
            <div style={{ fontWeight: 700 }} data-testid="bridge-bill-verdict">
              {facts.verdict}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{facts.subLine}</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sectionHead}>
            <div style={sectionTitle}>The pipe, this window</div>
            <span style={det}>{pipe.windowWeeks} weeks, by the %s and the reports</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, alignItems: 'stretch' }} data-testid="bridge-bill-pipe">
            <PipeCell head="finished by the field" usd={pipe.finishedUsd} sub="by the %s and the reports" />
            <PipeCell head="finished, no bill yet" usd={pipe.unbilledUsd} sub={`${stageUsd(pipe.unbilledReadyUsd)} ready, ${stageUsd(pipe.unbilledPctUsd)} by the %`} gap />
            <PipeCell head="billed" usd={pipe.billedUsd} sub="invoiced this window" />
            <PipeCell head="billed, not yet paid" usd={pipe.arUsd} sub="Collect's desk" gap />
            <PipeCell head="paid" usd={pipe.paidUsd} sub="landed in the bank" />
          </div>
          <div style={det}>{pipe.line}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={sectionHead}>
            <div style={sectionTitle}>The leaks</div>
            <span style={det}>money that stands still unless someone acts · biggest first</span>
          </div>
          {error ? (
            <div style={{ ...det, color: 'var(--text-amber-800)' }}>The Bill desk could not be read ({error}).</div>
          ) : !desk ? (
            <div style={det}>Reading the Bill desk…</div>
          ) : (
            <>
              {desk.leaks.map((l) => {
                const key = `${l.kind}:${l.jobId}`
                const open = openLeak === key
                return (
                  <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }} data-testid="bridge-bill-row">
                    <button type="button" aria-expanded={open} onClick={() => setOpenLeak(open ? null : key)} style={rowHead}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', minWidth: 64, flex: 'none' }}>{l.amountText}</span>
                      <span style={{ color: l.satDays == null ? 'var(--text-muted)' : 'var(--text-red-600)', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 64, flex: 'none' }}>{l.satText}</span>
                      <span style={{ flex: 1, minWidth: 180 }}>
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
              })}
              <div style={det}>{desk.leaksNote}</div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={sectionHead}>
            <div style={sectionTitle}>Billable today</div>
            <span style={det}>the fast lane · the jobs the office marked ready to bill</span>
          </div>
          {desk && (
            <>
              {desk.fast.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '2px 12px' }}>
                  {desk.fast.map((r) => (
                    <div key={r.jobId} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', fontSize: '0.86rem' }} data-testid="bridge-bill-fast">
                      <span style={{ flex: 1, minWidth: 180 }}>
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
            <button type="button" aria-expanded={scoreOpen} onClick={() => setScoreOpen((v) => !v)} style={{ ...rowHead, ...card, borderRadius: scoreOpen ? '10px 10px 0 0' : 10, gap: 10, flexWrap: 'wrap' }} data-testid="bridge-bill-scorecard">
              <span style={sectionTitle}>The rule, lately</span>
              <span style={det}>billed the day it finished?</span>
              <span style={{ fontWeight: 700, color: score.withReady === 0 ? 'var(--text-muted)' : score.sameDay === score.withReady ? 'var(--text-green-700)' : 'var(--text-red-600)' }}>{score.headText}</span>
              <span style={det}>{score.costLabel}</span>
              <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-muted)', transform: scoreOpen ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}>
                ›
              </span>
            </button>
            {scoreOpen && (
              <div style={{ border: '1px solid var(--border)', borderTop: 0, borderRadius: '0 0 10px 10px', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    <button type="button" onClick={() => setAllRows(true)} style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.8rem', cursor: 'pointer' }}>
                      Show all {score.rows.length}
                    </button>
                  </div>
                )}
                {score.noReadyLine && <div style={det}>{score.noReadyLine}</div>}
              </div>
            )}
          </div>
        )}

        <div style={{ ...card, borderLeft: '3px solid #2563eb', display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="bridge-bill-meter">
          <div style={label}>{facts.meter.head}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{facts.meter.value}</div>
          <div style={{ fontSize: '0.85rem' }}>{facts.meter.words.join(' ')}</div>
        </div>

        <div style={{ ...det, borderTop: '1px solid var(--border)', paddingTop: 8 }}>{(desk?.footnote ?? []).join(' ')}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
          <span style={det}>The week's call is recorded on the link desk above, not here.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/jobs?tab=billing" style={{ ...door, fontWeight: 400, padding: '0 12px' }}>
              Open Billing ›
            </Link>
            <button type="button" onClick={onClose} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 0, background: 'var(--text-base)', color: 'var(--surface)', fontWeight: 700, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
