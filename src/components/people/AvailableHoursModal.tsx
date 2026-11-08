/**
 * The one window for an answer: the week a person can work, drawn, from which Sunday on. My Time
 * opens it for the signed-in person; People → Utilization opens it for anyone the office picks.
 * Drawing is the door; "Type a number instead" keeps the plain weekly total for someone who does
 * not want to draw. Every save is a new answer (append-only), so the board reads old weeks
 * against the answer that held then.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { addDaysYmd } from '../../lib/emailSchedule/emailScheduleWeek'
import { formatPayWeekLabel, payWeekContaining } from '../../lib/payWeekAnchor'
import type { AvailabilityIo } from '../../lib/people/availabilityIo'
import { parseHoursPerWeek, UTILIZATION_ASSUMED_HOURS, UTILIZATION_MAX_HOURS_PER_WEEK, type AvailableHoursAnswer, type CanWork } from '../../lib/people/utilization'
import { DEFAULT_WEEK, describeWeek, normalizeWeek, weekHours, type WeekDays } from '../../lib/people/weekAvailability'
import { WeekAvailabilityPainter } from './WeekAvailabilityPainter'

const LABEL: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }
const HINT: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const INPUT: CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 700,
  width: '6ch',
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
const CHIP = (on: boolean): CSSProperties => ({
  padding: '0.3rem 0.7rem',
  borderRadius: 999,
  border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`,
  background: on ? '#2563eb' : 'var(--surface)',
  color: on ? '#fff' : 'var(--text-700)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
})
const LINK: CSSProperties = { border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'underline' }

export type AvailableHoursSubject = { userId: string; name: string }

export function AvailableHoursModal({
  open,
  subject,
  current,
  isSelf,
  setBy,
  io,
  onClose,
  onSaved,
}: {
  open: boolean
  subject: AvailableHoursSubject
  current: CanWork | null
  /** The signed-in person answering for themselves: the words say "you". */
  isSelf: boolean
  /** The signed-in person's id, stamped on the answer. */
  setBy: string | null
  io: AvailabilityIo
  onClose: () => void
  onSaved: (answer: AvailableHoursAnswer) => void
}) {
  const narrow = useNarrowViewport640()
  const today = todayYmdInAppTz()
  const thisWeek = payWeekContaining(today)
  const nextWeek = payWeekContaining(addDaysYmd(thisWeek.end, 1))
  const [mode, setMode] = useState<'draw' | 'number'>('draw')
  const [days, setDays] = useState<WeekDays>(DEFAULT_WEEK)
  const [hoursText, setHoursText] = useState('')
  const [from, setFrom] = useState<'this' | 'next'>('this')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    const drawn = current?.days ?? null
    setMode(current?.source === 'answered' && !drawn ? 'number' : 'draw')
    setDays(drawn ? normalizeWeek(drawn) : DEFAULT_WEEK.map((d) => d.map(([s, e]) => [s, e])))
    setHoursText(String(current?.source === 'answered' ? current.hours : UTILIZATION_ASSUMED_HOURS))
    setFrom('this')
    setNote('')
    setError(null)
  }, [open, current])
  if (!open) return null
  const parsed = mode === 'number' ? parseHoursPerWeek(hoursText) : weekHours(days)
  const who = isSelf ? 'you' : subject.name.trim().split(/\s+/)[0] || subject.name
  const save = async () => {
    if (parsed == null) {
      setError(`Type a number of hours from 0 to ${UTILIZATION_MAX_HOURS_PER_WEEK}.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const answer = await io.addAnswer({
        user_id: subject.userId,
        hours_per_week: parsed,
        days: mode === 'draw' ? normalizeWeek(days) : null,
        effective_from: (from === 'this' ? thisWeek : nextWeek).start,
        set_by: setBy,
        note: note.trim() || null,
      })
      onSaved(answer)
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e, 'The hours did not save.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 990, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isSelf ? 'Hours you can work' : `Hours ${subject.name} can work`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 12, width: '96%', maxWidth: 560, maxHeight: 'min(90vh, 100%)', overflowY: 'auto', padding: '1rem', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', display: 'grid', gap: '0.85rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>{isSelf ? 'Hours you can work' : `Hours ${subject.name} can work`}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 999, padding: '0.25rem 0.6rem', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--text-700)' }}>
            ✕
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>
          {isSelf ? 'Draw the hours you can work for the company each week. Dispatch plans the crew from this picture.' : `Draw the hours ${who} can work for the company each week. They can change it from My Time.`}
        </p>

        {mode === 'draw' ? (
          <>
            <WeekAvailabilityPainter value={days} onChange={setDays} rowHeight={narrow ? 12 : 14} />
            <button type="button" style={{ ...LINK, justifySelf: 'start' }} onClick={() => setMode('number')}>
              Type a number instead
            </button>
          </>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <label style={LABEL} htmlFor="available-hours-input">
                Hours a week
              </label>
              <input id="available-hours-input" inputMode="decimal" value={hoursText} onChange={(e) => setHoursText(e.target.value)} style={INPUT} aria-describedby="available-hours-hint" />
              <span style={HINT} id="available-hours-hint">
                {current?.source === 'answered' ? `Now ${current.hours} h${current.days ? `, ${describeWeek(current.days)}` : ''}` : current?.source === 'schedule' ? 'Salaried: the schedule says 40 h.' : `The board assumes ${UTILIZATION_ASSUMED_HOURS} h until someone answers.`}
              </span>
            </div>
            <button type="button" style={{ ...LINK, justifySelf: 'start' }} onClick={() => setMode('draw')}>
              Draw the week instead
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <span style={LABEL}>From</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setFrom('this')} style={CHIP(from === 'this')} aria-pressed={from === 'this'}>
              This week · {formatPayWeekLabel(thisWeek)}
            </button>
            <button type="button" onClick={() => setFrom('next')} style={CHIP(from === 'next')} aria-pressed={from === 'next'}>
              Next week · {formatPayWeekLabel(nextWeek)}
            </button>
          </div>
          <span style={HINT}>Weeks before keep the answer that held then. A first answer reads the weeks before it too.</span>
        </div>
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <label style={LABEL} htmlFor="available-hours-note">
            Why, in a few words <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input id="available-hours-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="School on Fridays until May" style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', fontSize: '0.875rem' }} />
        </div>
        {error ? (
          <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
            {error}
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || parsed == null}
            style={{ padding: '0.45rem 0.9rem', border: '1px solid #2563eb', borderRadius: 8, background: saving || parsed == null ? 'var(--bg-subtle)' : '#2563eb', color: saving || parsed == null ? 'var(--text-muted)' : '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: saving || parsed == null ? 'default' : 'pointer' }}
          >
            {saving ? 'Saving…' : parsed == null ? 'Save hours' : `Save ${parsed} h a week`}
          </button>
        </div>
      </div>
    </div>
  )
}
