/**
 * GC mode design spike: "We will be late" on one of a company's own bars in its portal, the
 * Gantt's Phase 3 (G-117; mock-up `to-dos/gc-mode/mockups/G-117.md`). The company sends the day it
 * will finish (or start, for work not started) and why, while there is still time, and sees what
 * that day does to the work waiting on it. Then the bar says where the word stands: waiting on the
 * office, taken, or pushed back, with the answer to give.
 */
import { useState, type Dispatch } from 'react'
import type { GcAction, GcProject, GcState, LookAheadReason, Partner, PortalKey } from '../../lib/gcMode/gcModel'
import { GC_COMPANY, pDate, pWeekday } from '../../lib/gcMode/gcModel'
import { addDays } from '../../lib/gcMode/gcBuilding'
import { LATE_REASONS, lateDayAsked, lateDayChanged, lateDoor, lateNoticeProblem, lateTarget, lateWaiting, portalLateNotice } from '../../lib/gcMode/gcLateNotices'
import { daysBetween } from '../../lib/gcMode/gcBuildingSchedule'
import { PortalTag } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'
import { Btn, input } from './gcUi'

const GC = GC_COMPANY.shortName

const REASON_WORDS: Record<LookAheadReason, PortalKey> = {
  weather: 'reasonWeather',
  'trade before': 'reasonTradeBefore',
  materials: 'reasonMaterials',
  crew: 'reasonCrew',
  other: 'reasonOther',
}

const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1)

export function GcPortalLate({ state, project, partner, lineId, dispatch }: { state: GcState; project: GcProject; partner: Partner; lineId: string; dispatch: Dispatch<GcAction> }) {
  const { lang, t } = usePortalLang()
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState('')
  const [reason, setReason] = useState<LookAheadReason | null>(null)
  const [note, setNote] = useState('')
  const [thanked, setThanked] = useState(false)
  const door = lateDoor(state, project, partner.id, lineId)
  // A finished bar, or one that is not theirs: nothing to say on it.
  if (!door) return null
  const shown = portalLateNotice(project, partner.id, lineId)
  const days = (n: number) => (n === 1 ? t('lateDay1') : t('lateDaysN', { n }))
  const problem = lateNoticeProblem(door, state.today, day, reason, note)
  const target = /^\d{4}-\d{2}-\d{2}$/.test(day) && day > door.day ? lateTarget(door.row.activity, door.started, day) : null
  const waiting = target ? lateWaiting(state, project, lineId, target) : []
  const first = addDays(door.day, 1)
  const start = (from?: { day: string; reason: LookAheadReason; note: string }) => {
    setDay(from?.day ?? '')
    setReason(from?.reason ?? null)
    setNote(from?.note ?? '')
    setThanked(false)
    setOpen(true)
  }
  const send = () => {
    if (problem || !reason) return
    dispatch({ type: 'tradeSayLate', projectId: project.id, partnerId: partner.id, lineId, day, reason, note: note.trim() })
    setOpen(false)
    setThanked(true)
  }
  const doorBtn = (
    <Btn kind="quiet" wrap onClick={() => start()}>
      {t('lateDoor')}
    </Btn>
  )

  return (
    <div data-portal-late={lineId} style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.35rem', fontSize: '0.85rem', padding: '0.1rem 0 0.45rem' }}>
      {!open && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {thanked && shown?.state === 'open' && <span>{t('lateThanks', { gc: GC })}</span>}
          {shown?.state === 'open' && (
            <>
              <PortalTag tone="grey">{t('lateSaid', { date: pWeekday(lang, lateDayAsked(shown.notice)), gc: GC })}</PortalTag>
              <Btn kind="quiet" wrap onClick={() => start({ day: lateDayAsked(shown.notice), reason: shown.notice.reason, note: shown.notice.note })}>
                {t('lateChange')}
              </Btn>
            </>
          )}
          {shown?.state === 'taken' && (
            <>
              <PortalTag tone="green">{t('lateTook', { gc: GC, date: pWeekday(lang, lateDayAsked(shown.notice)) })}</PortalTag>
              {doorBtn}
            </>
          )}
          {shown?.state === 'kept' && (
            <>
              <PortalTag tone="green">{t('lateKept', { date: pWeekday(lang, lateDayChanged(shown.notice)) })}</PortalTag>
              {doorBtn}
            </>
          )}
          {shown?.state === 'pushedBack' && shown.notice.pushedBack && (
            <div style={{ display: 'grid', gap: '0.35rem', width: '100%' }}>
              <div>
                <PortalTag tone="red">{t('latePushed', { gc: GC, date: pWeekday(lang, lateDayChanged(shown.notice)) })}</PortalTag>
              </div>
              <div>
                “{shown.notice.pushedBack.note}”{' '}
                <span style={{ color: 'var(--text-muted)' }}>
                  {shown.notice.pushedBack.by}, {pDate(lang, shown.notice.pushedBack.on)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <Btn kind="primary" wrap onClick={() => dispatch({ type: 'tradeKeepDay', projectId: project.id, partnerId: partner.id, noticeId: shown.notice.id })}>
                  {t('lateKeep', { date: pWeekday(lang, lateDayChanged(shown.notice)) })}
                </Btn>
                {doorBtn}
              </div>
            </div>
          )}
          {!shown && doorBtn}
        </div>
      )}

      {open && (
        <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem', background: 'var(--bg-subtle)', borderRadius: 8, minWidth: 0 }}>
          <strong>{t(door.started ? 'lateAskFinish' : 'lateAskStart', { gc: GC })}</strong>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{t(door.started ? 'lateFinishes' : 'lateStarts')}</span>
            <input
              type="date"
              value={day}
              min={first > state.today ? first : state.today}
              onChange={(e) => setDay(e.target.value)}
              aria-label={t(door.started ? 'lateFinishAria' : 'lateStartAria')}
              style={input}
            />
            {target && (
              <span>
                {pWeekday(lang, day)}.{' '}
                {door.started ? t('lateAfter', { days: days(daysBetween(door.day, day)), date: pWeekday(lang, door.day) }) : t('lateWouldFinish', { date: pWeekday(lang, target.finish) })}
              </span>
            )}
          </label>
          <div role="group" aria-label={t('lateWhy')} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{t('lateWhy')}</span>
            {LATE_REASONS.map((r) => {
              const on = reason === r
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReason(r)}
                  style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)' }}
                >
                  {capital(t(REASON_WORDS[r]))}
                </button>
              )
            })}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t('lateNote')}
            aria-label={t('lateNote')}
            style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}
          />
          {/* What waits on it, before they send (G-117, the second look): the same work their chart shows, never a price. */}
          {waiting.length > 0 && (
            <div style={{ display: 'grid', gap: '0.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('lateWaits')}</div>
              {waiting.map((w) => (
                <div key={w.lineId}>
                  {w.company === null
                    ? t('lateYourNext', { work: w.work, date: pWeekday(lang, w.start), days: days(w.days) })
                    : t('lateTheirNext', { work: w.work, company: w.company, date: pWeekday(lang, w.start), days: days(w.days) })}
                </div>
              ))}
            </div>
          )}
          <div style={{ color: 'var(--text-muted)' }}>{t('lateDecides', { gc: GC })}</div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn kind="primary" wrap disabled={problem !== null} onClick={send}>
              {t('sendTo', { gc: GC })}
            </Btn>
            <Btn kind="quiet" wrap onClick={() => setOpen(false)}>
              {t('notNow')}
            </Btn>
            {problem && <span style={{ color: 'var(--text-muted)' }}>{t(problem.key, problem.day ? { date: pWeekday(lang, problem.day) } : undefined)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
