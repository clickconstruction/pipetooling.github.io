/**
 * GC mode design spike: how to get days back (G-82, `to-dos/gc-mode/mockups/G-82.md`). On a job past
 * its contract, under the measures: the offers on the red chain, side by side or a second crew, each
 * with the days it gives back and what that does to the contract. *Look at it* opens the window a
 * recovery is saved from, the way G-37's pull is: the dates, what comes in, what keeps its dates and
 * why, the finish, the billing, then why. Who has to agree is on every offer, with Follow up's own
 * Call and Follow up (G-115's sheet), so the trade is asked before anything is saved.
 */
import { useEffect, useMemo, useState, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { daysBetween, telHref, weekdayDate, type GcAction, type GcProject, type GcState, type ScheduleMoveReason } from '../../lib/gcMode/gcModel'
import { MOVE_REASONS, moveWhyProblem, spanWords } from '../../lib/gcMode/gcScheduleMoves'
import { recoveryFollowPeople, recoveryNoneWords, recoveryOffers, sideBySideWords, type RecoveryOffer } from '../../lib/gcMode/gcRecovery'
import { planBillingShift, shiftWords } from '../../lib/gcMode/gcBillingForecast'
import { GcFollowUpSheet } from './GcFollowUpSheet'
import { Btn, Card, Chip, input } from './gcUi'

/** The signed-in person's name. Outside the app's sign-in (a test), none. */
function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** Under the measures on a job past its contract: every way to bring the finish in, the most days back first. */
export function GcDaysBack({ state, project, offers, dispatch }: { state: GcState; project: GcProject; offers: RecoveryOffer[]; dispatch: Dispatch<GcAction> }) {
  const [open, setOpen] = useState<string | null>(null)
  // Who has to agree (pick 2): the Follow up sheet on that offer's companies, at one of them.
  const [sheet, setSheet] = useState<{ key: string; partnerId: string; calling: boolean } | null>(null)
  return (
    <Card dataTour="gc-days-back">
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
        <div>
          <span style={label}>Days back</span>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {offers.length === 0
              ? `Nothing on the red chain can come in yet. ${recoveryNoneWords(state, project)}`
              : `${offers.length} ${offers.length === 1 ? 'way' : 'ways'} to bring the finish in. Each stands alone: save one and the list reads again.`}
          </div>
        </div>
        {offers.map((o) => (
          <div key={o.key} style={{ display: 'grid', gap: '0.2rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ flex: '1 1 16rem' }}>{o.words.title}</strong>
              <Chip tone="green">{days(o.daysBack)} back</Chip>
              <Btn kind="plain" onClick={() => setOpen(o.key)} title="The move in full, before anything is saved">
                Look at it
              </Btn>
            </div>
            <div style={{ color: 'var(--text-600)' }}>{o.words.detail}</div>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', color: 'var(--text-600)' }}>
              <span>{o.words.who}</span>
              {o.who.flatMap((w) =>
                w.partner && w.phone
                  ? [
                      <a
                        key={`call-${w.partner.id}`}
                        href={telHref(w.phone)}
                        title={`Call ${w.name}, ${w.phone}`}
                        onClick={() => setSheet({ key: o.key, partnerId: w.partner?.id ?? '', calling: true })}
                        style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', color: 'var(--text-base)', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}
                      >
                        Call {w.first}
                      </a>,
                      <Btn key={`fu-${w.partner.id}`} kind="quiet" onClick={() => setSheet({ key: o.key, partnerId: w.partner?.id ?? '', calling: false })} title={`A text or an email to ${w.name}, drafted, about the days back`}>
                        Follow up
                      </Btn>,
                    ]
                  : [],
              )}
            </div>
            <div style={{ color: o.lateAfter === 0 ? 'var(--text-green-800)' : 'var(--text-base)' }}>{o.words.worth}</div>
          </div>
        ))}
      </div>
      {open && <GcRecoveryWindow state={state} project={project} offerKey={open} dispatch={dispatch} onClose={() => setOpen(null)} />}
      {sheet && (
        <GcFollowUpSheet
          state={state}
          dispatch={dispatch}
          startPartnerId={sheet.partnerId}
          startCalling={sheet.calling}
          onClose={() => setSheet(null)}
          list={(s) => {
            const job = s.projects.find((x) => x.id === project.id)
            return job ? recoveryFollowPeople(s, job, sheet.key) : []
          }}
          title={project.name}
        />
      )}
    </Card>
  )
}

/** The window a recovery is saved from (G-82): the move in full, then why. One move, Undo puts it all back. */
export function GcRecoveryWindow({ state, project, offerKey, dispatch, onClose }: { state: GcState; project: GcProject; offerKey: string; dispatch: Dispatch<GcAction>; onClose: () => void }) {
  const me = useMeName() ?? 'The office'
  const offer = useMemo(() => recoveryOffers(state, project).find((o) => o.key === offerKey) ?? null, [state, project, offerKey])
  const [reason, setReason] = useState<ScheduleMoveReason | null>('recovery')
  const [note, setNote] = useState(offer?.note ?? '')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // What the move shifts between bills (G-97), read the way the pull's window reads it.
  const billing = useMemo(() => (offer ? shiftWords(planBillingShift(state, project, offer), 'will') : null), [state, project, offer])
  if (!offer) return null
  const problem = moveWhyProblem(reason, note)
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const save = () => {
    if (problem || !reason) return
    dispatch({ type: 'recoverScheduleDays', projectId: project.id, key: offer.key, why: { reason, note: note.trim(), by: me } })
    onClose()
  }
  const sooner = Math.max(0, daysBetween(offer.to.finish, offer.from.finish))
  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Get days back"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(620px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Get days back</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{offer.words.title}</div>
        </div>
        <div style={{ display: 'grid', gap: '0.45rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem 0.7rem' }}>
          <span style={label}>{offer.how === 'side' ? 'Starts sooner' : 'A second crew'}</span>
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <strong>{offer.name}</strong>
            <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{spanWords(offer.from)}</span>
            <span aria-hidden>→</span>
            <span>
              {weekdayDate(offer.to.start)} to {weekdayDate(offer.to.finish)}
            </span>
            {sooner > 0 && <Chip tone="green">finishes {days(sooner)} sooner</Chip>}
          </div>
          {offer.how === 'side' && offer.afterName && (
            <div style={{ color: 'var(--text-600)' }}>
              It starts {sideBySideWords(-(offer.gap ?? 0), offer.afterName)}. The two trades work side by side.
            </div>
          )}
          {offer.how === 'crew' && <div style={{ color: 'var(--text-600)' }}>{offer.words.detail}</div>}
          {offer.pulls.length > 0 && (
            <>
              <span style={{ ...label, marginTop: '0.3rem' }}>Comes in behind it</span>
              {offer.pulls.map((p) => (
                <div key={p.lineId} style={{ fontSize: '0.85rem' }}>
                  <strong>{p.name}</strong> <span style={{ color: 'var(--text-muted)' }}>· {p.company}</span>: {weekdayDate(p.to.start)} to {weekdayDate(p.to.finish)}, {days(p.days)} sooner.
                  {p.limit && <span style={{ color: 'var(--text-muted)' }}> {p.limit}</span>}
                </div>
              ))}
            </>
          )}
          {offer.stays.length > 0 && (
            <>
              <span style={{ ...label, marginTop: '0.3rem' }}>Keeps its dates</span>
              {offer.stays.map((s) => (
                <div key={s.lineId} style={{ fontSize: '0.85rem', color: s.held ? 'var(--text-amber-800)' : 'var(--text-600)' }}>
                  <strong>{s.name}</strong> <span style={{ color: 'var(--text-muted)' }}>· {s.company}</span>: {s.why}
                </div>
              ))}
            </>
          )}
          <div style={{ color: 'var(--text-green-800)', fontWeight: 600, marginTop: '0.2rem' }}>
            The finish: {weekdayDate(offer.finishFrom)} → {weekdayDate(offer.finishTo)}.
          </div>
          <div>{offer.words.worth}</div>
          {billing && <div style={{ color: 'var(--text-600)' }}>Billing: {billing}</div>}
          <div style={{ color: 'var(--text-amber-800)' }}>{offer.words.who} Ask them before you save it.</div>
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
            style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, padding: '0.45rem 0.55rem' }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>{problem ?? `Saved as one move by ${me}, today. Undo puts every date back.`}</span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null} onClick={save}>
            Save the move
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
