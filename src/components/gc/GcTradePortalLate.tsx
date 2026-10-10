import { useEffect, useState } from 'react'
import { addDays } from '../../lib/gc/building'
import { GC_COMPANY } from '../../lib/gc/company'
import { pDate, pWeekday, type PortalKey } from '../../lib/gc/portalI18n'
import { LATE_REASONS, lateNoticeProblem, lateTarget, type LateDoor } from '../../lib/gc/schedule/lateNotices'
import { daysBetween } from '../../lib/gc/schedule/schedule'
import type { LookAheadReason, ScheduleActivity } from '../../lib/gc/schedule/types'
import { MUTED } from '../../lib/portal/portalTheme'
import type { WorkLate, WorkWaiting } from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress, usePress } from './gcTradePortalPress'

/**
 * GC mode, the trade partner portal's P5d-ii-2 (to-dos/gc-mode/mockups/portal-p5d.md): "We will be late" under one of the
 * company's own bars on its chart (G-117), in 14b's `ownRow` slot, lifted from the design spike's `GcPortalLate.tsx`
 * onto `gc-trade-portal`'s answer. The company sends the day it will finish (or start, for work not started), why and a
 * sentence (`say_late`), and sees what that day does to the work waiting on it: the second look, which the function
 * works out for the day picked (`PortalPress.lateWaiting`). Then the bar says where its word stands, and after our push
 * back it can say it will make the day (`keep_day`). Never who of ours pushed back. The door's kernel runs on the server,
 * so this is a lift of the screen, not word for word.
 */

const GC = GC_COMPANY.shortName

const REASON_WORDS: Record<LookAheadReason, PortalKey> = {
  weather: 'reasonWeather',
  'trade before': 'reasonTradeBefore',
  materials: 'reasonMaterials',
  crew: 'reasonCrew',
  other: 'reasonOther',
}

const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1)

/** The second look waits this long after the day settles before it asks. */
const SECOND_LOOK_MS = 400

export function GcTradePortalLate({ late, today }: { late: WorkLate; today: string }) {
  const { lang, t } = usePortalLang()
  const press = usePortalPress()
  const { busy, problem: refused, run } = usePress()
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState('')
  const [reason, setReason] = useState<LookAheadReason | null>(null)
  const [note, setNote] = useState('')
  const [thanked, setThanked] = useState(false)
  const [waiting, setWaiting] = useState<WorkWaiting[]>([])
  // The lifted checks read only the bar's day and dates: the answer carries those, not the office's row (amendment 2).
  const door = { day: late.day, started: late.started } as unknown as LateDoor
  const problem = lateNoticeProblem(door, today, day, reason, note)
  const target = /^\d{4}-\d{2}-\d{2}$/.test(day) && day > late.day ? lateTarget({ start: late.start, finish: late.finish } as unknown as ScheduleActivity, late.started, day) : null
  const shown = late.notice
  // A notice shown is one whose bar still has the dates it was sent against, so the day it changes is the bar's own.
  const asked = shown ? (late.started ? shown.toFinish : shown.toStart) : ''
  const days = (n: number) => (n === 1 ? t('lateDay1') : t('lateDaysN', { n }))
  const first = addDays(late.day, 1)

  useEffect(() => {
    if (!open || !target || !press) {
      setWaiting([])
      return
    }
    let live = true
    const timer = setTimeout(() => {
      void press.lateWaiting(late.lineId, day).then((w) => {
        if (live) setWaiting(w)
      })
    }, SECOND_LOOK_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [open, target?.start, target?.finish, day, late.lineId, press]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = (from?: { day: string; reason: LookAheadReason; note: string }) => {
    setDay(from?.day ?? '')
    setReason(from?.reason ?? null)
    setNote(from?.note ?? '')
    setThanked(false)
    setOpen(true)
  }
  const send = async () => {
    if (problem || !reason) return
    if (await run('say_late', { activityId: late.lineId, day, reason, note: note.trim() })) {
      setOpen(false)
      setThanked(true)
    }
  }
  const doorBtn = (
    <Btn kind="quiet" wrap onClick={() => start()}>
      {t('lateDoor')}
    </Btn>
  )

  return (
    <div data-portal-late={late.lineId} style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', padding: '0.1rem 0 0.45rem' }}>
      {!open && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {thanked && shown?.state === 'open' && <span>{t('lateThanks', { gc: GC })}</span>}
          {shown?.state === 'open' && (
            <>
              <Chip tone="grey">{t('lateSaid', { date: pWeekday(lang, asked), gc: GC })}</Chip>
              <Btn kind="quiet" wrap onClick={() => start({ day: asked, reason: shown.reason as LookAheadReason, note: shown.note })}>
                {t('lateChange')}
              </Btn>
            </>
          )}
          {shown?.state === 'taken' && (
            <>
              <Chip tone="green">{t('lateTook', { gc: GC, date: pWeekday(lang, asked) })}</Chip>
              {doorBtn}
            </>
          )}
          {shown?.state === 'kept' && (
            <>
              <Chip tone="green">{t('lateKept', { date: pWeekday(lang, late.day) })}</Chip>
              {doorBtn}
            </>
          )}
          {shown?.state === 'pushedBack' && shown.pushedBack && (
            <div style={{ display: 'grid', gap: '0.35rem', width: '100%' }}>
              <div>
                <Chip tone="red">{t('latePushed', { gc: GC, date: pWeekday(lang, late.day) })}</Chip>
              </div>
              <div>
                “{shown.pushedBack.note}” <span style={{ color: MUTED }}>{pDate(lang, shown.pushedBack.on)}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <Btn kind="primary" wrap disabled={busy} onClick={() => void run('keep_day', { noticeId: shown.id })}>
                  {t('lateKeep', { date: pWeekday(lang, late.day) })}
                </Btn>
                {doorBtn}
              </div>
            </div>
          )}
          {!shown && doorBtn}
          {refused && <span style={{ color: MUTED }}>{refused}</span>}
        </div>
      )}

      {open && (
        <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem', background: 'var(--bg-subtle)', borderRadius: 8, minWidth: 0 }}>
          <strong>{t(late.started ? 'lateAskFinish' : 'lateAskStart', { gc: GC })}</strong>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{t(late.started ? 'lateFinishes' : 'lateStarts')}</span>
            <input
              type="date"
              value={day}
              min={first > today ? first : today}
              onChange={(e) => setDay(e.target.value)}
              aria-label={t(late.started ? 'lateFinishAria' : 'lateStartAria')}
              style={input}
            />
            {target && (
              <span>
                {pWeekday(lang, day)}.{' '}
                {late.started ? t('lateAfter', { days: days(daysBetween(late.day, day)), date: pWeekday(lang, late.day) }) : t('lateWouldFinish', { date: pWeekday(lang, target.finish) })}
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
            <div data-portal-late-waits style={{ display: 'grid', gap: '0.15rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>{t('lateWaits')}</div>
              {waiting.map((w) => (
                <div key={`${w.work}:${w.start}`}>
                  {w.company === null
                    ? t('lateYourNext', { work: w.work, date: pWeekday(lang, w.start), days: days(w.days) })
                    : t('lateTheirNext', { work: w.work, company: w.company, date: pWeekday(lang, w.start), days: days(w.days) })}
                </div>
              ))}
            </div>
          )}
          <div style={{ color: MUTED }}>{t('lateDecides', { gc: GC })}</div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn kind="primary" wrap disabled={problem !== null || busy} onClick={() => void send()}>
              {t('sendTo', { gc: GC })}
            </Btn>
            <Btn kind="quiet" wrap onClick={() => setOpen(false)}>
              {t('notNow')}
            </Btn>
            {problem && <span style={{ color: MUTED }}>{t(problem.key, problem.day ? { date: pWeekday(lang, problem.day) } : undefined)}</span>}
            {refused && <span style={{ color: MUTED }}>{refused}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
