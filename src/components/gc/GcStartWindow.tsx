import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { startChecklist, type StartTradeRow } from '../../lib/gc/start'
import { startRecipients } from '../../lib/gc/startEmail'
import type { GcProject, GcState } from '../../lib/gc/types'
import { shortDate, weekdayDate } from '../../lib/gc/words'
import { useCompanyOpener } from './gcCompanyOpener'
import { Btn, Card, Chip, input, td, th } from './gcUi'

/**
 * GC mode, the real build, the Board's B6-c-ii: Get started, the design spike's `GcStart.tsx` on real rows. One window
 * answers "can we start?": what we owe the customer, the schedule, then every trade with its five steps in the order
 * they happen. Start stays shut until nothing is missing; Start anyway keeps why and what was owed. Each trade's Next
 * opens the place on main where that work is done (Compare quotes, the company's Documents, the trade card's Send), so
 * no press is built twice. The spike's Sign it as them stays on the spike.
 */

/** Who heard the job started, and who did not with why. */
export interface StartTold {
  told: string[]
  missed: { company: string; why: string }[]
}

/** The window's presses. Unset: it reads only. */
export interface StartPresses {
  /** Start, or Start anyway with why and what was missing, then tell every company awarded on the job. */
  start: (anyway?: { reason: string; missing: string[] }) => Promise<StartTold>
  /** Tell again the companies not told yet. */
  tellAgain: () => Promise<StartTold>
  setPermit: (done: boolean) => Promise<void>
  setStartDate: (date: string | null) => Promise<void>
  /** Our contract with the customer, signed on paper or not. The money team's only: its price is Our number's. */
  signContract?: (signed: boolean) => Promise<void>
  /** A trade's next step, where main already does it: Compare quotes, and the trade card's statement of work. */
  award: (packageId: string) => void
  openSow: (packageId: string) => void
}

export function GcStartWindow({
  state,
  project,
  presses,
  told: toldBefore,
  ownBidHref,
  covered = false,
  onOpenSchedule,
  onClose,
}: {
  state: GcState
  project: GcProject
  presses?: StartPresses
  /** The companies already told the job started, by name (from the trade messages). */
  told: string[]
  /** Our own crew's Trades mode bid, by trade. */
  ownBidHref: (packageId: string) => string | null
  /** Another window it opened sits on top (Compare quotes, a company's): Escape is that one's. */
  covered?: boolean
  onOpenSchedule: () => void
  onClose: () => void
}) {
  const list = startChecklist(state, project)
  const started = project.startedOn !== null
  const owed = started && Boolean(project.startedAnyway)
  const onJob = startRecipients(state, project.id).length
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // What the last press heard back; until one, who the trade messages say was told.
  const [pressed, setPressed] = useState<StartTold | null>(null)
  const heard = pressed ?? { told: toldBefore, missed: [] }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !covered) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, covered])

  /** One press at a time, its problem said in the window. */
  const run = (key: string, work: () => Promise<void>) => {
    setBusy(key)
    setProblem(null)
    void work()
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(null))
  }
  const doStart = (anyway: boolean) =>
    presses &&
    run('start', async () => {
      const result = await presses.start(anyway ? { reason: why.trim(), missing: list.missing } : undefined)
      setPressed(result)
    })
  const notTold = Math.max(0, onJob - heard.told.length)

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Get started, ${project.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(1040px, 100%)', maxHeight: 'min(92vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <strong style={{ fontSize: '1.1rem' }}>Get started · {project.name}</strong>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '1rem', overflowY: 'auto', minHeight: 0, display: 'grid', gap: '0.9rem' }}>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.88rem' }}>
              {problem}
            </div>
          )}
          <Card style={{ borderColor: started || list.ready ? 'var(--border-green)' : 'var(--border-amber)' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 18rem' }}>
                <div data-gc-start-strip style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                  {started
                    ? `Started ${shortDate(project.startedOn)}.${project.startDate ? ` Work begins ${weekdayDate(project.startDate)}.` : ''}`
                    : list.ready
                      ? 'Ready to start. Nothing is missing.'
                      : `Not ready yet. ${list.missing.length} ${list.missing.length === 1 ? 'thing is' : 'things are'} missing.`}
                </div>
                <div style={{ marginTop: '0.4rem', height: 10, borderRadius: 5, background: 'var(--bg-muted)', overflow: 'hidden' }} title={`${list.done} of ${list.total} steps done`}>
                  <div style={{ width: `${(list.done / Math.max(1, list.total)) * 100}%`, height: '100%', background: list.ready ? 'var(--text-green-700)' : 'var(--text-amber-700)' }} />
                </div>
                <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {list.done} of {list.total} steps done
                </div>
              </div>
              {!started && presses && (
                <Btn kind="primary" disabled={!list.ready || busy !== null} title={list.ready ? undefined : list.missing.join(' ')} onClick={() => doStart(false)}>
                  {busy === 'start' ? 'Starting…' : `Start the project and tell the ${onJob} on the job`}
                </Btn>
              )}
            </div>
            {(started || pressed) && (
              <div data-gc-start-told style={{ marginTop: '0.6rem', fontSize: '0.9rem', display: 'grid', gap: '0.3rem' }}>
                {heard.told.length > 0 && <div>Told {heard.told.join(', ')}.</div>}
                {heard.missed.map((m) => (
                  <div key={m.company} style={{ color: 'var(--text-red-700)' }}>
                    {m.company} was not told: {m.why}
                  </div>
                ))}
                {presses && notTold > 0 && (
                  <div>
                    <Btn disabled={busy !== null} onClick={() => run('again', async () => setPressed(await presses.tellAgain()))}>
                      {busy === 'again' ? 'Sending…' : 'Send again'}
                    </Btn>
                  </div>
                )}
              </div>
            )}
            {(!started || owed) && !list.ready && (
              <>
                {owed && project.startedAnyway && (
                  <div style={{ marginTop: '0.6rem', fontSize: '0.9rem', color: 'var(--text-amber-800)' }}>
                    {project.startedAnyway.by} started it before everything was in{project.startedAnyway.reason ? `: ${project.startedAnyway.reason.replace(/[.!?]+$/, '')}` : ''}. Still owed:
                  </div>
                )}
                <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', fontSize: '0.9rem', display: 'grid', gap: '0.15rem' }}>
                  {list.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            )}
            {owed && list.ready && <div style={{ marginTop: '0.6rem', fontSize: '0.9rem', color: 'var(--text-green-700)' }}>Started anyway, and everything owed is in now.</div>}
            {!started && !list.ready && presses && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input style={{ ...input, flex: '1 1 16rem' }} placeholder="Why start before everything is in?" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Why start anyway" maxLength={500} />
                <Btn disabled={why.trim() === '' || busy !== null} title="Starts the job now. What is missing stays listed here as owed." onClick={() => doStart(true)}>
                  Start anyway
                </Btn>
              </div>
            )}
          </Card>

          <Card>
            <Caps>With {project.owner}</Caps>
            <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
              {list.owner.map((c) => (
                <div key={c.key} data-gc-start-owner={c.key} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Tick done={c.done} />
                  <span style={{ flex: '1 1 16rem' }}>{c.label}</span>
                  <span style={{ color: c.done ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{c.detail}</span>
                  {c.key === 'startDate' && presses ? (
                    <input
                      type="date"
                      min={state.today}
                      value={project.startDate ?? ''}
                      disabled={started || busy !== null}
                      onChange={(e) => run('date', () => presses.setStartDate(e.target.value || null))}
                      style={input}
                      aria-label="The day work starts"
                    />
                  ) : c.key === 'permit' && presses && (!started || owed) ? (
                    <Btn kind={c.done ? 'quiet' : 'plain'} disabled={busy !== null} onClick={() => run('permit', () => presses.setPermit(!c.done))}>
                      {c.done ? 'Undo' : 'Mark it done'}
                    </Btn>
                  ) : c.key === 'ownerContract' && presses?.signContract && (!started || owed) ? (
                    <Btn kind={c.done ? 'quiet' : 'plain'} disabled={busy !== null} title={c.done ? undefined : 'Signed on paper, outside their portal'} onClick={() => run('contract', () => presses.signContract!(!c.done))}>
                      {c.done ? 'Undo' : 'Mark it signed'}
                    </Btn>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <Caps>The schedule</Caps>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <Tick done={list.schedule.done} />
              <span style={{ flex: '1 1 16rem' }}>
                {list.schedule.label}
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>The dates and what waits on what. Its first change after Start keeps the plan we measure against.</span>
              </span>
              <span style={{ color: list.schedule.done ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{list.schedule.detail}</span>
              <Btn kind={list.schedule.done ? 'quiet' : 'plain'} onClick={onOpenSchedule}>
                {list.schedule.done ? 'Open the schedule' : 'Draw it on Schedule'}
              </Btn>
            </div>
          </Card>

          <Card style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Trade', 'Company', 'Awarded', 'Master agreement', 'Insurance', 'W-9', 'Statement of work', 'Next'].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.trades.map((row) => (
                  <TradeLine key={row.pkg.id} row={row} presses={presses} locked={started && !owed} ownBidHref={ownBidHref(row.pkg.id)} />
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Caps({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{children}</div>
}

function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-label={done ? 'done' : 'not done'}
      style={{
        display: 'inline-flex',
        width: '1.25rem',
        height: '1.25rem',
        borderRadius: '50%',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 700,
        flexShrink: 0,
        background: done ? 'var(--text-green-700)' : 'var(--bg-muted)',
        color: done ? 'var(--surface)' : 'var(--text-muted)',
        border: done ? 'none' : '1px solid var(--border-strong)',
      }}
    >
      {done ? '✓' : ''}
    </span>
  )
}

function TradeLine({
  row,
  presses,
  locked,
  ownBidHref,
}: {
  row: StartTradeRow
  presses?: StartPresses
  locked: boolean
  ownBidHref: string | null
}) {
  const opener = useCompanyOpener()
  const { pkg, partner, invite, checks } = row
  if (pkg.selfPerform) {
    return (
      <tr data-gc-start-trade={pkg.id}>
        <td style={{ ...td, fontWeight: 600 }}>{pkg.trade}</td>
        <td style={td} colSpan={6}>
          <Chip tone="violet">We do this ourselves</Chip> {pkg.selfPerform.note}
          {!row.ready && ' Our own bid is not priced yet.'}
        </td>
        <td style={td}>
          {row.ready ? (
            <Chip tone="green">ready</Chip>
          ) : ownBidHref ? (
            <Link to={ownBidHref} style={{ color: 'var(--text-link)' }}>
              Price our own bid
            </Link>
          ) : (
            <Chip tone="amber">not priced yet</Chip>
          )}
        </td>
      </tr>
    )
  }
  const first = checks.find((c) => !c.done)
  const sow = pkg.sow
  const paper = (doc: string, label: string) =>
    partner && opener ? (
      <Btn kind="primary" onClick={() => opener.openPartner(partner.id, { tab: 'documents', doc, send: true })}>
        {label}
      </Btn>
    ) : null

  let action: ReactNode = null
  if (!locked && first && presses) {
    if (first.key === 'awarded') {
      action = pkg.invites.some((i) => i.bid) ? (
        <Btn kind="primary" onClick={() => presses.award(pkg.id)}>
          Award
        </Btn>
      ) : null
    } else if (first.key === 'msa') action = paper('msa', partner?.msa === 'sent' ? 'Remind them' : 'Send the master agreement')
    else if (first.key === 'coi') action = paper('insurance', 'Ask for their insurance')
    else if (first.key === 'w9') action = paper('w9', 'Ask for their W-9')
    else if (first.key === 'sow' && sow?.status === 'draft') {
      action = (
        <Btn kind="primary" title="Opens it on the trade's card, where it is sent" onClick={() => presses.openSow(pkg.id)}>
          Send the statement of work
        </Btn>
      )
    } else if (first.key === 'sow' && sow?.status === 'sent') action = paper(`sow-${pkg.id}`, 'Remind them')
  }

  return (
    <tr data-gc-start-trade={pkg.id} style={{ background: row.ready ? undefined : 'var(--bg-amber-tint)' }}>
      <td style={{ ...td, fontWeight: 600 }}>{pkg.trade}</td>
      <td style={td}>{partner?.company ?? <span style={{ color: 'var(--text-red-700)' }}>no company</span>}</td>
      {checks.map((c) => (
        <td key={c.key} style={td}>
          <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
            <Tick done={c.done} />
            <span style={{ fontSize: '0.8rem', color: c.done ? 'var(--text-600)' : 'var(--text-amber-800)' }}>{c.key === 'awarded' ? (invite ? '' : 'not yet') : c.detail}</span>
          </span>
        </td>
      ))}
      <td style={{ ...td, minWidth: '14rem' }}>
        {row.ready ? (
          <Chip tone="green">ready</Chip>
        ) : (
          <div style={{ display: 'grid', gap: '0.3rem', justifyItems: 'start' }}>
            <span style={{ fontSize: '0.85rem' }}>{row.next}</span>
            {action}
          </div>
        )}
      </td>
    </tr>
  )
}
