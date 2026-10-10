/**
 * GC mode, the real build, the schedule's PR 9d: how to get days back on a late job (G-82), ported from the GC mode
 * prototype (branch spike/gc-mode, `GcRecovery.tsx`; the plan is to-dos/gc-mode/mockups/schedule-pr9d.md there). On a
 * job running past its date to meet for substantial completion, under the measures: the offers on the red chain, side
 * by side or a second crew, each with the days it gives back. *Look at it* opens the window a recovery is saved from,
 * the way a pull is: the dates, what comes in, what keeps its dates and why, the finish, then why. Saved as one move
 * (`recoveryMove`) through the window's one save, re-found by its key from the schedule as read. Who has to agree is on
 * every offer with **Call**, a phone link. Follow up waits for the Board lane's Follow up sheet, as the call list's
 * does (7c-ii), and the billing line for the schedule to read bills (PR 16).
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { telHref } from '../../lib/gc/followUpSheet'
import { moveWhyProblem, spanWords } from '../../lib/gc/schedule/moves'
import { daysBetween } from '../../lib/gc/schedule/network'
import { recoveryMove, recoveryNoneWords, recoveryOffers, sideBySideWords, type RecoveryOffer } from '../../lib/gc/schedule/recovery'
import { recoveryLogWords } from '../../lib/gc/schedule/scheduleWindow'
import type { ScheduleMoveReason } from '../../lib/gc/schedule/types'
import { scheduleChangedRefusal, type ScheduleChange } from '../../lib/gc/schedule/versionRefusal'
import type { GcProject, GcState } from '../../lib/gc/types'
import { weekdayDate } from '../../lib/gc/words'
import { formatErrorMessage } from '../../utils/errorHandling'
import { WhyItMoved, type ScheduleSave } from './GcPullEarlier'
import { GcScheduleRefusal } from './GcScheduleMoves'
import { Btn, Card, Chip, input } from './gcUi'

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** Under the measures on a late job: every way to bring the finish in, the most days back first. `onLook` opens one's window. */
export function GcDaysBack({ state, project, offers, onLook }: { state: GcState; project: GcProject; offers: RecoveryOffer[]; onLook: (key: string) => void }) {
  return (
    <Card>
      <div data-days-back style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
        <div>
          <span style={label}>Days back</span>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {offers.length === 0
              ? `Nothing on the red chain can come in yet. ${recoveryNoneWords(state, project)}`
              : `${offers.length} ${offers.length === 1 ? 'way' : 'ways'} to bring the finish in. Each stands alone: save one and the list reads again.`}
          </div>
        </div>
        {offers.map((o) => (
          <div key={o.key} data-days-back-offer={o.key} style={{ display: 'grid', gap: '0.2rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ flex: '1 1 16rem' }}>{o.words.title}</strong>
              <Chip tone="green">{days(o.daysBack)} back</Chip>
              <Btn kind="plain" onClick={() => onLook(o.key)} title="The move in full, before anything is saved">
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
                        style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', color: 'var(--text-base)', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}
                      >
                        Call {w.first}
                      </a>,
                    ]
                  : [],
              )}
            </div>
            <div style={{ color: o.lateAfter === 0 ? 'var(--text-green-800)' : 'var(--text-base)' }}>{o.words.worth}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** The window a recovery is saved from (G-82): the move in full, then why. One move, and Undo puts it all back. */
export function GcRecoveryWindow({
  state,
  project,
  offerKey,
  by,
  onSave,
  onReload,
  onClose,
}: {
  state: GcState
  project: GcProject
  offerKey: string
  by: string
  onSave: ScheduleSave
  onReload: () => void
  onClose: () => void
}) {
  const offer = useMemo(() => recoveryOffers(state, project).find((o) => o.key === offerKey) ?? null, [state, project, offerKey])
  const [reason, setReason] = useState<ScheduleMoveReason | null>('recovery')
  const [note, setNote] = useState(offer?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<ScheduleChange[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!offer || !project.schedule) return null
  const schedule = project.schedule
  const problem = moveWhyProblem(reason, note)
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const save = async () => {
    if (problem || !reason || saving) return
    const why = { reason, note: note.trim(), by }
    setSaving(true)
    setRefused(null)
    setFailed(null)
    try {
      await onSave(recoveryMove(schedule, offer, why, state.today), offer.activities, recoveryLogWords(project, offer, by))
      onClose()
    } catch (e) {
      const refusal = scheduleChangedRefusal(e)
      if (refusal) {
        // Someone saved first: their changes, and the chart reads again behind the window.
        setRefused(refusal.changes)
        onReload()
      } else setFailed(formatErrorMessage(e, 'The move did not save.'))
    } finally {
      setSaving(false)
    }
  }
  const sooner = Math.max(0, daysBetween(offer.to.finish, offer.from.finish))
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Get days back"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(620px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
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
          <div style={{ color: 'var(--text-amber-800)' }}>{offer.words.who} Ask them before you save it.</div>
        </div>
        {refused && <GcScheduleRefusal changes={refused} what="Your move was not saved. The chart shows the new dates now. Look at it again on them." />}
        <WhyItMoved reason={reason} onReason={setReason} />
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={label}>What happened, in your words</span>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save()
            }}
            rows={3}
            style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, padding: '0.45rem 0.55rem' }}
          />
        </label>
        {failed && (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
            {failed}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>{problem ?? `Saved as one move by ${by}, today. Undo puts every date back.`}</span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null || saving} onClick={() => void save()}>
            Save the move
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
