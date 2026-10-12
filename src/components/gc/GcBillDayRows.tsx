import { useEffect, useState, type ReactNode } from 'react'
import { drawAtWeSee, walkedWords } from '../../lib/gc/billDay/lines'
import { billGroups, rowMove, scheduleSays, type BillDayDates, type TradeDraw } from '../../lib/gc/billDay/trades'
import type { LineCheck } from '../../lib/gc/billDay/walk'
import type { GcProject } from '../../lib/gc/types'
import { money, shortDate, weekdayDate } from '../../lib/gc/words'
import { useCompanyOpener } from './gcCompanyOpener'
import { Btn, Card, Chip, input, num, td, th } from './gcUi'

/**
 * Messages, cut 9 (wave 2, helper 7): Bill day's rows, one per trade with a signed statement of work, by where each
 * stands: sent back, not in, waiting on us, approved, closing out (the prototype's `renderMoney` groups and `linesHtml`).
 * The money is the money team's. Approve and Send back stay the Draws window's own: a row here opens it. A row's own
 * writes are Nothing this period and Put it back, a dev's while Bill day is built.
 */
export type RowAsk = 'askDraw' | 'remind' | 'askWaiver'

export function GcBillDayRows({
  project,
  rows,
  dates,
  checks,
  photos,
  today,
  canWrite,
  busy,
  ours,
  onAsk,
  onAskAll,
  onNothing,
  onPutBack,
  onOpenDraws,
  askPanel,
  openLinesFor,
}: {
  project: GcProject
  rows: TradeDraw[]
  dates: BillDayDates
  checks: LineCheck[]
  photos: Map<string, string>
  today: string
  canWrite: boolean
  busy: boolean
  ours: { amount: number; pct: number; ref: string } | null
  onAsk: (ask: RowAsk, row: TradeDraw) => void
  onAskAll: () => void
  onNothing: (row: TradeDraw, saidBy: string) => Promise<boolean>
  onPutBack: (row: TradeDraw) => Promise<boolean>
  onOpenDraws?: () => void
  /** The ask panel open under a row, by its package id. */
  askPanel: { packageId: string; node: ReactNode } | null
  /** A row whose lines a gate's Open the lines opened, by its package id. */
  openLinesFor?: string | null
}) {
  const groups = billGroups(rows, dates)
  const notIn = rows.filter((r) => r.state === 'notin' && !r.nothing).length
  return (
    <Card style={{ padding: '0.75rem 1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }} data-bill-day-strip>
        {groups.map((g) => (
          <a key={g.key} href={`#bill-day-${g.key}`} style={{ textDecoration: 'none' }}>
            <Chip tone={g.tone === 'hot' ? 'red' : g.tone === 'warn' ? 'amber' : 'grey'}>{`${g.label} ${g.rows.length}`}</Chip>
          </a>
        ))}
        {ours && (
          <a href="#bill-day-ours" style={{ textDecoration: 'none' }}>
            <Chip tone="grey">Our own crew</Chip>
          </a>
        )}
      </div>
      {groups.map((g) => (
        <section key={g.key} id={`bill-day-${g.key}`} data-bill-day-group={g.key} style={{ display: 'grid', gap: '0.4rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.9rem', color: g.tone === 'hot' ? 'var(--text-red-700)' : g.tone === 'warn' ? 'var(--text-amber-800)' : 'inherit' }}>{g.label}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {g.rows.length}
              {g.note ? ` · ${g.note}` : ''}
            </span>
            {g.key === 'notin' && notIn > 1 && (
              <Btn kind="quiet" onClick={onAskAll}>
                {`Ask all ${notIn} in one press`}
              </Btn>
            )}
          </div>
          {g.rows.map((row) => (
            <Row
              key={row.packageId}
              project={project}
              row={row}
              dates={dates}
              checks={checks}
              photos={photos}
              today={today}
              canWrite={canWrite}
              busy={busy}
              onAsk={onAsk}
              onNothing={onNothing}
              onPutBack={onPutBack}
              onOpenDraws={onOpenDraws}
              askPanel={askPanel?.packageId === row.packageId ? askPanel.node : null}
              linesAsked={openLinesFor === row.packageId}
            />
          ))}
        </section>
      ))}
      {ours && (
        <section id="bill-day-ours" data-bill-day-group="ours" style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>Our own crew</strong>
          <div>
            {money(ours.amount)} this period on {ours.ref}, {ours.pct}% done from the job’s stages.
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No draw and no waiver. Bill the customer bills its line from the percent.</div>
        </section>
      )}
    </Card>
  )
}

function Row({
  project,
  row,
  dates,
  checks,
  photos,
  today,
  canWrite,
  busy,
  onAsk,
  onNothing,
  onPutBack,
  onOpenDraws,
  askPanel,
  linesAsked,
}: {
  project: GcProject
  row: TradeDraw
  dates: BillDayDates
  checks: LineCheck[]
  photos: Map<string, string>
  today: string
  canWrite: boolean
  busy: boolean
  onAsk: (ask: RowAsk, row: TradeDraw) => void
  onNothing: (row: TradeDraw, saidBy: string) => Promise<boolean>
  onPutBack: (row: TradeDraw) => Promise<boolean>
  onOpenDraws?: () => void
  askPanel: ReactNode
  linesAsked: boolean
}) {
  const opener = useCompanyOpener()
  const [linesOpen, setLinesOpen] = useState(linesAsked)
  useEffect(() => {
    if (linesAsked) setLinesOpen(true)
  }, [linesAsked])
  const [saying, setSaying] = useState<string | null>(null)
  const move = rowMove(row, today)
  const keep = () => {
    if (saying === null || saying.trim() === '') return
    void onNothing(row, saying.trim()).then((ok) => {
      if (ok) setSaying(null)
    })
  }
  const lineDraw = row.draw ?? row.back?.draw ?? null
  const held = row.changes.filter((c) => c.state !== 'signed')
  const signed = row.changes.filter((c) => c.state === 'signed')
  const moneyCell =
    row.state === 'notin'
      ? row.last
        ? `${money(row.last.net)} last, draw ${row.last.number}${row.last.paidOn ? `, paid ${shortDate(row.last.paidOn)}` : ''}`
        : 'No draw before'
      : row.state === 'approved'
        ? `${money(row.asked ?? 0)} asked · ${money(row.approved ?? 0)} approved`
        : `${money(row.asked ?? 0)} asked${row.state === 'back' && row.back ? `, sent back ${weekdayDate(row.back.on)}` : row.since ? `, came ${weekdayDate(row.since)}` : ''}`
  const detail =
    row.state === 'back' && row.back
      ? `“${row.back.note.trim()}”`
      : row.state === 'notin' && !row.nothing
        ? row.first
          ? 'First draw. The form is in their portal.'
          : 'No day given.'
        : ''
  return (
    <div data-bill-day-row={row.packageId} data-row-state={row.state} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.7rem', display: 'grid', gap: '0.4rem', fontSize: '0.85rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 180, flex: '1 1 180px', display: 'grid', gap: '0.1rem' }}>
          <strong>{row.company}</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {row.trade}
            {row.person ? ` · ${row.person}` : ''}
          </span>
          {opener && row.partnerId && (
            <button
              type="button"
              onClick={() => row.partnerId && opener.openPartner(row.partnerId, { tab: 'portal' })}
              title={`Opens ${row.company}’s portal as they see it: their statement of work, the draw form and their papers. Nothing of ours shows on it.`}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem', justifySelf: 'start' }}
            >
              See their page
            </button>
          )}
        </div>
        <div style={{ minWidth: 70 }}>
          Draw {row.number} {row.first ? <Chip tone="blue" small>first</Chip> : row.state === 'notin' ? <Chip tone="grey" small>next</Chip> : null}
        </div>
        <div style={{ minWidth: 150, flex: '1 1 150px', fontVariantNumeric: 'tabular-nums' }}>{moneyCell}</div>
        <div style={{ minWidth: 130, flex: '1 1 130px', display: 'grid' }} title="What the schedule says this draw comes to by bill day, after retainage.">
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(row.expected)} expected</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{row.expectedWords || 'No bar on the schedule moves it.'}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', flex: '1 1 160px' }}>
          {row.owedUnconditional.length > 0 && <Chip tone="amber">{`unconditional owed on draw ${row.owedUnconditional.map((o) => o.draw).join(', ')}`}</Chip>}
          {signed.map((c) => (
            <Chip key={c.co.id} tone="green">{`CO ${c.co.number} signed`}</Chip>
          ))}
          {held.map((c) => (
            <Chip key={c.co.id} tone="amber">{`CO ${c.co.number} unsigned · ${money(c.co.cost)} held out`}</Chip>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '0.15rem', flex: '1 1 150px' }}>
          <Chip tone={move.side === 'ours' ? 'blue' : move.side === 'theirs' ? 'amber' : move.side === 'paid' ? 'green' : 'grey'}>{move.words}</Chip>
          {detail && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{detail}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {row.state === 'back' && (
          <>
            <Btn kind="plain" onClick={() => setLinesOpen((o) => !o)}>
              {linesOpen ? 'Close the lines' : 'Open the lines'}
            </Btn>
            <Btn kind="plain" onClick={() => onAsk('remind', row)}>
              Remind them
            </Btn>
          </>
        )}
        {row.state === 'notin' && !row.nothing && (
          <>
            <Btn kind="primary" onClick={() => onAsk('askDraw', row)}>
              Ask for it
            </Btn>
            {canWrite && saying === null && (
              <Btn kind="plain" onClick={() => setSaying(`${row.person || 'The office'}, by phone`)}>
                Nothing this period
              </Btn>
            )}
          </>
        )}
        {row.state === 'notin' && row.nothing && canWrite && (
          <Btn kind="plain" disabled={busy} onClick={() => void onPutBack(row)}>
            Put it back
          </Btn>
        )}
        {row.state === 'waiting' && (
          <>
            <Btn kind="plain" onClick={() => setLinesOpen((o) => !o)}>
              {linesOpen ? 'Close the lines' : 'Open the lines'}
            </Btn>
            {onOpenDraws && (
              <Btn kind="primary" onClick={onOpenDraws}>
                Approve or send back in Draws
              </Btn>
            )}
          </>
        )}
        {(row.state === 'approved' || row.state === 'closing') && onOpenDraws && (
          <Btn kind="plain" onClick={onOpenDraws}>
            Open the draw in Draws
          </Btn>
        )}
        {row.owedUnconditional.length > 0 && (
          <Btn kind="quiet" onClick={() => onAsk('askWaiver', row)}>
            Ask for the waiver
          </Btn>
        )}
      </div>
      {saying !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            keep()
          }}
          style={{ display: 'grid', gap: '0.35rem', borderTop: '1px solid var(--border)', paddingTop: '0.45rem' }}
        >
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem' }}>
            Said by
            <input value={saying} onChange={(e) => setSaying(e.target.value)} style={input} />
          </label>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Kept with who said it and when, never typed over a draw. They can still send one before bill day, and the row comes back.</span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <Btn kind="primary" disabled={busy || saying.trim() === ''} onClick={keep}>
              Keep it
            </Btn>
            <Btn kind="quiet" onClick={() => setSaying(null)}>
              Not now
            </Btn>
          </div>
        </form>
      )}
      {linesOpen && lineDraw && <Lines project={project} row={row} draw={lineDraw} checks={row.state === 'back' ? backChecks(row) : checks} photos={photos} billDay={dates.billDay} />}
      {askPanel}
    </div>
  )
}

/** A draw sent back reads what we saw from the send-back itself: its lines we doubted, at the percent we see. */
function backChecks(row: TradeDraw): LineCheck[] {
  const back = row.back
  if (!back) return []
  return back.lines.map((l) => ({ drawId: back.draw.id, sovId: l.sovId, weSee: l.weSee, onSite: null, photo: false, note: '', by: '', at: back.on }))
}

/** A draw's lines, read only: claimed, what we see, the schedule, and this draw's money at what we see. */
function Lines({ project, row, draw, checks, photos, billDay }: { project: GcProject; row: TradeDraw; draw: NonNullable<TradeDraw['draw']>; checks: LineCheck[]; photos: Map<string, string>; billDay: string }) {
  const pkg = project.packages.find((p) => p.id === row.packageId)
  if (!pkg) return null
  const at = drawAtWeSee(project, pkg, row.sow, draw, checks, (sovId) => scheduleSays(project, sovId, billDay))
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.45rem', display: 'grid', gap: '0.35rem' }} data-bill-day-lines={draw.id}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Draw {draw.number}’s lines: what they claim, what we see, and what the schedule says. {walkedWords(at)}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th style={th}>Line</th>
              <th style={{ ...th, textAlign: 'right' }}>Value</th>
              <th style={th}>Last</th>
              <th style={th}>Claimed</th>
              <th style={th}>We see</th>
              <th style={th}>Schedule says</th>
              <th style={{ ...th, textAlign: 'right' }}>This draw</th>
            </tr>
          </thead>
          <tbody>
            {at.lines.map((l) => {
              const photo = photos.get(`${draw.id}:${l.sovId}`)
              return (
                <tr key={l.sovId}>
                  <td style={td}>
                    {l.item} · {l.label}
                  </td>
                  <td style={num}>{money(l.value)}</td>
                  <td style={td}>{l.stored > 0 && l.claimed === l.last ? '—' : `${l.last}%`}</td>
                  <td style={td}>{l.stored > 0 && l.claimed === l.last ? `${money(l.stored)} stored` : `${l.claimed}%`}</td>
                  <td style={{ ...td, color: l.doubt ? 'var(--text-red-700)' : 'inherit', fontWeight: l.doubt ? 700 : 400 }}>
                    {l.stored > 0 && l.claimed === l.last ? (l.onSite === null ? 'not walked yet' : l.onSite ? 'on site' : 'not seen') : l.weSee === null ? 'not walked yet' : `${l.weSee}%`}
                    {photo && (
                      <>
                        {' '}
                        <a href={photo} target="_blank" rel="noreferrer">
                          photo
                        </a>
                      </>
                    )}
                  </td>
                  <td style={td}>{l.schedule === null ? '—' : `${Math.round(l.schedule)}% by ${shortDate(billDay)}`}</td>
                  <td style={num}>
                    {money(l.thisDraw)}
                    {l.doubt && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        at {l.weSee}%, not {money(l.asClaimed)} at {l.claimed}%{l.note ? `. ${l.note}` : ''}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {at.heldOut.map((c) => (
              <tr key={c.name}>
                <td style={{ ...td, color: 'var(--text-muted)' }}>{c.name}</td>
                <td style={num}>{money(c.amount)}</td>
                <td style={td} colSpan={4}>
                  {c.waitsOn === 'customer' ? 'Waits on the customer’s signature.' : c.waitsOn === 'us' ? 'Waits on us to send it to them.' : 'Waits on their signature.'}
                </td>
                <td style={{ ...num, color: 'var(--text-amber-800)' }}>held out</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, textAlign: 'right', color: 'var(--text-muted)' }} colSpan={6}>
                less {at.retainagePct}% retainage
              </td>
              <td style={num}>−{money(at.retainage)}</td>
            </tr>
            <tr>
              <td style={{ ...td, textAlign: 'right' }} colSpan={6}>
                <strong>At what we see</strong>
              </td>
              <td style={num}>
                <strong>{money(at.net)}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>they asked {money(at.asked.net)}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
