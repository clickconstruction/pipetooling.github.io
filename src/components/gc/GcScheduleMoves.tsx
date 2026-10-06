/**
 * GC mode design spike: moving a bar, the Gantt's Phase 2 (`to-dos/gc-mode/GANTT_PLAN.md`). The
 * owner, 2026-10-05: "anyone on our team may move a bar, when a bar is moved an explanation should
 * be given and recorded with that saved somewhere." Two pieces: the window every move goes through
 * (what it does, why, in whose words), and the list of every move made, with Undo on the last.
 */
import { useEffect, useMemo, useState, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { daysBetween, weekdayDate, type GcAction, type GcProject, type GcState, type ScheduleMove, type ScheduleMoveReason } from '../../lib/gcMode/gcModel'
import { MOVE_REASONS, moveActivityName, moveRows, moveWhyProblem, planMove, redoableMove, spanWords, undoableMove, type MoveLimits } from '../../lib/gcMode/gcScheduleMoves'
import { companiesToTell, datesMessage, moveAnswerWords, untoldMoves } from '../../lib/gcMode/gcTellTrades'
import { lateNoticeMoveWords } from '../../lib/gcMode/gcLateNotices'
import { moveBillingShift, planBillingShift, shiftWords } from '../../lib/gcMode/gcBillingForecast'
import { crowdingAfterMove } from '../../lib/gcMode/gcPlaces'
import { Btn, Card, Chip, input } from './gcUi'

/** The signed-in person's name. Outside the app's sign-in (a test), none. */
function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

/** A move waiting on its explanation: the activity and where it would go. */
export interface PendingMove {
  lineId: string
  start: string
  finish: string
  after: string[]
  /** The gap after each wait, the day it cannot start before, the day it must finish by, when the form set them. */
  limits?: MoveLimits
  /** The reason and the words to start the window with: a change order's days come with theirs (G-76). The person can still change them. */
  why?: { reason: ScheduleMoveReason; note: string }
  /** The signed change order whose days this move puts on the schedule. */
  changeOrderId?: string
  /** The trade's late notice this move takes (G-117): its day, reason and words came with it. */
  lateNoticeId?: string
}

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const

/** The window a move is saved from: what it does, then why. Nothing is saved without both. */
export function GcMoveExplain({ state, project, pending, dispatch, onClose, tryIt }: { state?: GcState; project: GcProject; pending: PendingMove; dispatch: Dispatch<GcAction>; onClose: () => void; tryIt?: boolean }) {
  const me = useMeName() ?? 'The office'
  const [reason, setReason] = useState<ScheduleMoveReason | null>(pending.why?.reason ?? null)
  const [note, setNote] = useState(pending.why?.note ?? '')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const plan = planMove(project, pending.lineId, pending.start, pending.finish, pending.after, pending.limits)
  // What the move does to the bills (G-97): worked out once per move, not on every keystroke.
  const billing = useMemo(() => (state && plan && !plan.problem && !plan.same ? shiftWords(planBillingShift(state, project, plan), 'will') : null), [state, project, pending]) // eslint-disable-line react-hooks/exhaustive-deps
  // What the move does to a place with too many trades (G-83), said before it saves.
  const crowding = useMemo(() => (state && plan && !plan.problem && !plan.same ? crowdingAfterMove(state, project, plan.activities) : []), [state, project, pending]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!plan || plan.same) return null
  // In a what-if (G-81) a reason is optional: the move is tried with one when it is given whole, else with none yet.
  const whyGiven = moveWhyProblem(reason, note) === null
  const problem = tryIt ? plan.problem : (plan.problem ?? moveWhyProblem(reason, note))
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const dated = plan.from.start !== plan.to.start || plan.from.finish !== plan.to.finish
  const shift = daysBetween(plan.from.finish, plan.to.finish)
  const longer = daysBetween(plan.to.start, plan.to.finish) - daysBetween(plan.from.start, plan.from.finish)
  const save = () => {
    if (problem || (!tryIt && !reason)) return
    const why = reason && whyGiven ? { why: { reason, note: note.trim(), by: me } } : {}
    dispatch({ type: 'setScheduleActivity', projectId: project.id, lineId: pending.lineId, start: pending.start, finish: pending.finish, after: pending.after, ...why, ...(pending.limits ?? {}), ...(pending.changeOrderId ? { changeOrderId: pending.changeOrderId } : {}), ...(pending.lateNoticeId ? { lateNoticeId: pending.lateNoticeId } : {}) })
    onClose()
  }
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Why it moved"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(560px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
            {tryIt ? `Try ${dated ? 'moving' : 'changing'}` : dated ? 'Move' : 'Change'} {moveActivityName(project, pending.lineId)}
          </h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {tryIt ? 'In the what-if, a reason is optional. Keep asks for one.' : "A move is saved with why it moved. Both stay on the schedule's record."}
          </div>
        </div>
        <div style={{ display: 'grid', gap: '0.3rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem 0.7rem' }}>
          {dated ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{spanWords(plan.from)}</span>
              <span aria-hidden>→</span>
              <strong>
                {weekdayDate(plan.to.start)} to {weekdayDate(plan.to.finish)}
              </strong>
              {shift !== 0 && <Chip tone={shift > 0 ? 'amber' : 'green'}>{Math.abs(shift)} {Math.abs(shift) === 1 ? 'day' : 'days'} {shift > 0 ? 'later' : 'sooner'}</Chip>}
              {longer !== 0 && <Chip tone="grey">{Math.abs(longer)} {Math.abs(longer) === 1 ? 'day' : 'days'} {longer > 0 ? 'longer' : 'shorter'}</Chip>}
            </div>
          ) : (
            <strong>Its dates stay {spanWords(plan.from)}.</strong>
          )}
          {plan.linksChanged && <div>What it waits on, or its limits, change.</div>}
          {plan.warnings.map((w) => (
            <div key={w} style={{ color: 'var(--text-amber-800)' }}>
              {w}
            </div>
          ))}
          <div style={{ color: plan.finishDays > 0 ? 'var(--text-red-700)' : 'var(--text-600)', fontWeight: plan.finishDays > 0 ? 600 : 400 }}>{plan.words}</div>
          {plan.pushed.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-600)', fontSize: '0.83rem', display: 'grid', gap: '0.1rem' }}>
              {plan.pushed.slice(0, 5).map((p) => (
                <li key={p.lineId}>
                  {p.label}: {spanWords(p.to)}, {p.days} {p.days === 1 ? 'day' : 'days'} later
                </li>
              ))}
              {plan.pushed.length > 5 && <li>and {plan.pushed.length - 5} more</li>}
            </ul>
          )}
          {billing && <div style={{ color: 'var(--text-600)' }}>Billing: {billing}</div>}
          {crowding.map((c) => (
            <div key={c.words} data-move-crowding style={{ color: c.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-green-800)' }}>
              {c.words}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={label}>Why it moved</span>
          <div role="group" aria-label="Why it moved" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {MOVE_REASONS.map((r) => {
              const on = reason === r.key
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReason(r.key)}
                  style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)' }}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={label}>What happened, in your words</span>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
            }}
            rows={3}
            placeholder="Rain stopped the roof Tuesday and Wednesday. Summit is back Thursday."
            style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, padding: '0.45rem 0.55rem' }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>
            {problem ?? (tryIt ? (whyGiven ? 'Tried with its reason, on the copy only.' : 'Tried with no reason yet, on the copy only.') : `Saved as moved by ${me}, today.`)}
          </span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null} onClick={save}>
            {tryIt ? 'Try it' : 'Save the move'}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Every move made on the schedule, newest first, each with who, why and what it did. The last one standing can be undone. */
export function GcMoveHistory({ state, project, dispatch, tryIt }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; tryIt?: boolean }) {
  const me = useMeName() ?? 'The office'
  const rows = moveRows(project)
  const [all, setAll] = useState(false)
  const [telling, setTelling] = useState(false)
  const undoable = undoableMove(project)
  // Redo (G-40): the newest undone move, while everything it touched still sits where the undo left it.
  const redoable = redoableMove(project)
  // Tell the trades (Phase 3): the companies whose days the standing, untold moves changed.
  const untold = untoldMoves(project)
  // A what-if's moves (G-81) are for nobody outside the office, so there is nobody to tell.
  const toTell = tryIt ? [] : companiesToTell(state, project, untold)
  if (rows.length === 0) {
    return (
      <Card>
        <strong>{tryIt ? 'Tried in the what-if' : 'Changes to the schedule'}</strong>{' '}
        <span style={{ color: 'var(--text-muted)' }}>
          {tryIt ? 'Nothing tried yet. Drag a bar on the chart, or press one to change its dates.' : 'None yet. Drag a bar on the chart, or press one to change its dates. Every move is kept here with who made it and why.'}
        </span>
      </Card>
    )
  }
  const shown = all ? rows : rows.slice(0, 5)
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <strong>
          {tryIt ? 'Tried in the what-if' : 'Changes to the schedule'} ({rows.length})
        </strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{tryIt ? 'Every move tried on the copy, newest first. Keep puts them on the real schedule.' : 'Every move, who made it and why. Newest first.'}</span>
        <span style={{ flex: 1 }} />
        {toTell.length > 0 && (
          <span data-tour="gc-tell-trades">
            <Btn kind="primary" onClick={() => setTelling(true)} title="Each company whose days moved gets one message with its old and new days and why.">
              Tell the trades · {toTell.length}
            </Btn>
          </span>
        )}
      </div>
      {telling && <GcTellTrades state={state} project={project} dispatch={dispatch} onClose={() => setTelling(false)} />}
      <div style={{ display: 'grid' }}>
        {shown.map((r) => (
          <div key={r.move.id} style={{ display: 'grid', gap: '0.15rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem', opacity: r.undone ? 0.6 : 1 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{r.who}</span>
              <Chip tone="grey">{r.reason}</Chip>
              {r.undone && <Chip tone="amber">undone</Chip>}
              <span style={{ flex: 1 }} />
              {undoable?.id === r.move.id && (
                <Btn kind="plain" onClick={() => dispatch({ type: 'undoScheduleMove', projectId: project.id, moveId: r.move.id, by: me })} title="Put every date this move changed back where it was. The move stays on the record.">
                  Undo
                </Btn>
              )}
              {redoable?.id === r.move.id && (
                <Btn kind="plain" onClick={() => dispatch({ type: 'redoScheduleMove', projectId: project.id, moveId: r.move.id, by: me })} title="Put the move back. Every date it changed moves again.">
                  Redo
                </Btn>
              )}
            </div>
            <div style={r.undone ? { textDecoration: 'line-through' } : undefined}>{r.what}</div>
            {r.move.noWhy ? <div style={{ color: 'var(--text-muted)' }}>{r.move.note}</div> : <div style={{ color: 'var(--text-base)' }}>“{r.move.note}”</div>}
            {(r.effect || r.undone) && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{[r.effect, r.undone].filter(Boolean).join(' ')}</div>}
            {/* A move that took a trade's late notice (G-117): who asked, and how far ahead. */}
            {lateNoticeMoveWords(state, project, r.move) && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{lateNoticeMoveWords(state, project, r.move)}</div>}
            {/* What the move did to the bills (G-97), while its bars still sit where it left them. */}
            {!r.undone && <MoveBilling state={state} project={project} move={r.move} />}
            {/* Who was told, and what they said (Phase 3). */}
            {r.move.toldOn &&
              moveAnswerWords(state, r.move).map((w) => (
                <div key={w} style={{ fontSize: '0.82rem', color: w.includes('asked for') ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
                  {w}
                </div>
              ))}
            {!tryIt && !r.move.toldOn && !r.undone && companiesToTell(state, project, [r.move]).length > 0 && <div style={{ fontSize: '0.82rem', color: 'var(--text-amber-800)' }}>The trades have not been told.</div>}
          </div>
        ))}
      </div>
      {rows.length > 5 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
          <Btn kind="quiet" onClick={() => setAll((v) => !v)}>
            {all ? 'Show the last 5' : `Show all ${rows.length}`}
          </Btn>
        </div>
      )}
    </Card>
  )
}

/** Tell the trades: each company whose days moved, its message as it will go, and one press. In the prototype nothing leaves the app. */
export function GcTellTrades({ state, project, dispatch, onClose }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; onClose: () => void }) {
  const me = useMeName() ?? 'The office'
  const untold = untoldMoves(project)
  const companies = companiesToTell(state, project, untold)
  const [shown, setShown] = useState<string | null>(companies[0]?.partner.id ?? null)
  const company = companies.find((c) => c.partner.id === shown) ?? companies[0]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const message = company ? datesMessage(project, company.partner, company) : null
  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tell the trades"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(720px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Tell the trades their dates moved</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {untold.length === 1 ? '1 move' : `${untold.length} moves`} not told yet. Each company gets one email, in its language, with its old and new days and why. It answers from its portal.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {companies.map((c) => {
            const on = company?.partner.id === c.partner.id
            return (
              <button key={c.partner.id} type="button" aria-pressed={on} onClick={() => setShown(c.partner.id)} style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-muted)' }}>
                {c.partner.company} · {c.lines.length === 1 ? '1 line' : `${c.lines.length} lines`}
                {c.partner.lang === 'es' ? ' · Español' : ''}
              </button>
            )
          })}
        </div>
        {company && message && (
          <article style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', display: 'grid', gap: '0.1rem', background: 'var(--bg-subtle)' }}>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>To </span>
                {company.partner.contact}, {company.partner.company}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>{message.subject}</span>
            </div>
            <div style={{ padding: '0.7rem 0.75rem', display: 'grid', gap: '0.45rem', lineHeight: 1.45 }}>
              {message.lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </article>
        )}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>
            {companies.length === 1 ? '1 email goes out' : `${companies.length} emails go out`}, each with the company's portal link. In the prototype nothing leaves the app.
          </span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            kind="primary"
            disabled={companies.length === 0}
            onClick={() => {
              dispatch({ type: 'tellTradesMoves', projectId: project.id, moveIds: untold.map((m) => m.id), by: me })
              onClose()
            }}
          >
            {companies.length === 1 ? `Tell ${companies[0]?.partner.company ?? 'them'}` : `Tell ${companies.length} companies`}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** What a standing move did to the bills (G-97): "Billing: it moved $6,600 of the Oct 25 bill to Nov 25." Nothing when it moved no money. */
function MoveBilling({ state, project, move }: { state: GcState; project: GcProject; move: ScheduleMove }) {
  const words = useMemo(() => shiftWords(moveBillingShift(state, project, move) ?? [], 'did'), [state, project, move])
  return words ? <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Billing: {words}</div> : null
}
