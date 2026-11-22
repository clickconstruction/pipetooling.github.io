import { useRef, useState, type CSSProperties } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { lienHoursAfterHandDayValues, lienLastWorkSourceValues } from '../../lib/jobs/lienDayValues'
import { lienHoursAfterHandDay, LIEN_LAST_WORK_CLEAR, lienLastWorkDay, type LienLastWorkJob } from '../../lib/jobs/lienLastWorkDay'
import { LIEN_LAST_WORK_KEEP_HINT, LIEN_LAST_WORK_SET_BY_HAND_WORDS, LIEN_LAST_WORK_VALUE_LABEL, lienLastWorkBackWords, lienLastWorkClearedWords, lienLastWorkOpeningDay } from '../../lib/jobs/lienLastWorkDoor'
import { ChangeableValue, ValueLine, ValueLines, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { LienLastWorkDayWindow } from './LienLastWorkDayWindow'
import { useLienLastWorkDayWrite } from './useLienLastWorkDayWrite'

/**
 * The last day of work, on one line (v2.4676): the day, a chip saying where it came from (clock
 * hours, a bill, the job's creation, or a person) and the reason when a person set it. The day is set by hand
 * here: a day and a one-line reason, saved on the job. Clock hours and pay are never
 * touched, and the line says so. Drawn as the first row of the Months card on the Lien desk (`flat`,
 * no box of its own) and in Edit Job's lien row; the caller re-reads after a save. Since v2.7447 (punch list #335) the day may be earlier
 * than the clock hours, and the window says what that takes off the lien clock. Since v2.4717 a window opens before
 * anything is written (`LienLastWorkDayConfirm`): how far the day moves from the hours, the dates that move with it,
 * and the reason, asked there; the write happens on its *Set the day*. Since v2.7684 that window and
 * its write are `LienLastWorkDayWindow`, which the timeline's press under LAST WORK opens too.
 *
 * Values in place (punch list #399, the first screen): one fact a line, the labels in a column and the values beside
 * them. Who set the day and when, and the later hours' last day, are drawn bold, apart from the words
 * (`lienDayValues.ts` marks them inside the kernel's own sentences).
 *
 * The day itself is a value a person can change where it sits (the owner's yes of 2026-11-21). There is no
 * *Change ›* and no editor box. A day from clock hours, a bill or the job's creation is a default: bold, its source
 * chip after it, and **Set by hand** beside it. A day set by hand is underlined, and a press on it opens its field,
 * with *Back to clock hours* in it. **Keep** writes nothing. It opens the same window on the day typed, because the
 * day moves every lien deadline: the window shows what moves, asks why, and its *Set the day* is the one write.
 */
const chip = (tone: 'hand' | 'hours' | 'bill' | 'created'): CSSProperties => ({
  display: 'inline-block',
  padding: '0 7px',
  // The chip sits in the values column since punch list #399, so a long *set by hand · name · day* wraps inside it on a phone, where it ran past its box.
  borderRadius: 9,
  fontSize: '0.7rem',
  fontWeight: 700,
  lineHeight: '18px',
  minWidth: 0,
  background: tone === 'hand' ? 'var(--bg-green-tint)' : tone === 'hours' ? 'var(--bg-blue-tint)' : 'var(--bg-amber-tint)',
  color: tone === 'hand' ? 'var(--text-green-800)' : tone === 'hours' ? 'var(--text-blue-700)' : 'var(--text-amber-800)',
})
/** A day never breaks across two lines; a name may. */
const whole = (text: string) => (
  <WorkedOutValue>
    <span style={{ whiteSpace: 'nowrap' }}>{text}</span>
  </WorkedOutValue>
)

export function LienLastWorkDayLine({
  jobId,
  job,
  todayYmd,
  canEdit,
  userId,
  setByName,
  onSaved,
  jobLabel,
  clockMonths,
  noticedMonths,
  affidavitMonths,
  propertyKind,
  startEditing = false,
  onCancel,
  flat = false,
}: {
  jobId: string
  job: LienLastWorkJob | null | undefined
  todayYmd: string
  canEdit: boolean
  userId: string | null
  /** The name behind `lien_last_work_set_by`, when the caller knows it. */
  setByName?: string | null
  /** After a save or a clear: the caller re-reads the job and the desk. */
  onSaved: () => void
  /** "922 · Michael Palvern" — the window's subtitle. */
  jobLabel?: string
  /** The months with approved hours (YYYY-MM), for the window's dates; the Edit Job row has none. */
  clockMonths?: ReadonlyArray<string>
  noticedMonths?: ReadonlyArray<string>
  /** The months the job's approved or filed affidavit names (v2.7447), when the caller holds the paper. */
  affidavitMonths?: ReadonlyArray<string>
  /** 'residential' | 'commercial'; '' or absent draws the words without the table. */
  propertyKind?: string
  /**
   * Open on the window (v2.4733): the Lien window draws the line only when its timeline's press under LAST WORK is
   * pressed, and the window that sets the day opens with it, the day to pick inside. Until punch list #399 this
   * opened the line's own editor box, which is gone.
   */
  startEditing?: boolean
  /** That window closed with nothing saved: the Lien window folds the line away again. */
  onCancel?: () => void
  /** No box of its own (punch list #361): the line is the first row of the Lien desk's Months card, on the card's hairline. */
  flat?: boolean
}) {
  const d = lienLastWorkDay(job)
  const laterHoursDay = lienHoursAfterHandDay(job)
  // The day Keep handed over, which the window opens on and may still fix.
  const [kept, setKept] = useState('')
  // The window, and what opened it: the Lien window's press (`start`, the day picked inside) or Keep on the value.
  // It is this job's window only: another job under the line starts with none.
  const [win, setWin] = useState<{ jobId: string; from: 'start' | 'keep' } | null>(startEditing && canEdit ? { jobId, from: 'start' } : null)
  const open = win && win.jobId === jobId ? win : null
  const saved = useRef(false)
  // Back to the clock hours writes through the same door as the window's Set the day (`useLienLastWorkDayWrite`).
  const { write } = useLienLastWorkDayWrite(jobId, onSaved)
  const clear = async () => {
    await write(LIEN_LAST_WORK_CLEAR, lienLastWorkClearedWords(Boolean(job?.last_work_date)))
  }

  const dayText = d.day ? formatYmdMonthDay(d.day) : 'none yet'
  // Nobody typed a day from clock hours, a bill or the job's creation: it is a default this job may override.
  const asDefault = canEdit && d.source !== 'hand' && Boolean(d.day)
  const source = (
    <span style={chip(d.source)} data-testid="lien-last-work-source">
      <ValueSentence text={lienLastWorkSourceValues(d, setByName)} values={{ when: whole }} />
    </span>
  )

  return (
    <div data-testid="lien-last-work" data-source={d.source} data-flat={flat ? 'yes' : undefined} style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: '0.8125rem', ...(flat ? null : { padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }) }}>
        <ValueLines>
          <ValueLine label="Last day of work">
            <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem 0.5rem', flexWrap: 'wrap' }}>
              <span data-testid="lien-last-work-day" style={{ minWidth: 0, maxWidth: '100%' }}>
                {canEdit ? (
                  <ChangeableValue
                    text={dayText}
                    label={LIEN_LAST_WORK_VALUE_LABEL}
                    type="date"
                    // A stand-in is no day anyone said, so its field opens empty, as the window does (`lienLastWorkOpeningDay`).
                    value={lienLastWorkOpeningDay(d)}
                    max={todayYmd}
                    hint={LIEN_LAST_WORK_KEEP_HINT}
                    onKeep={(day) => {
                      setKept(day)
                      setWin({ jobId, from: 'keep' })
                    }}
                    fromDefault={asDefault ? source : undefined}
                    setOwnLabel={LIEN_LAST_WORK_SET_BY_HAND_WORDS}
                    backToDefault={d.source === 'hand' ? { label: lienLastWorkBackWords(Boolean(job?.last_work_date)), onPress: clear } : undefined}
                  />
                ) : d.day ? (
                  // A role that cannot set the day reads it: worked out, so bold with no press.
                  whole(dayText)
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>none yet</span>
                )}
              </span>
              {/* Beside a default the value piece draws the chip itself, as the default's word. */}
              {asDefault ? null : source}
            </span>
          </ValueLine>
          {d.note ? (
            <ValueLine label="Why">
              <span style={{ color: 'var(--text-muted)' }} data-testid="lien-last-work-note">“{d.note}”</span>
            </ValueLine>
          ) : null}
          {/* v2.7193, punch list #335, row 1: hours approved after a day set by hand do not move it, and the line says they are there. */}
          {laterHoursDay ? (
            <ValueLine label="Later hours">
              <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }} data-testid="lien-last-work-later-hours">
                <ValueSentence text={lienHoursAfterHandDayValues(laterHoursDay)} values={{ hours: whole }} />
              </span>
            </ValueLine>
          ) : null}
        </ValueLines>
      </div>
      {open && canEdit ? (
        <LienLastWorkDayWindow
          jobId={jobId}
          job={job}
          todayYmd={todayYmd}
          userId={userId}
          onSaved={() => {
            saved.current = true
            onSaved()
          }}
          onClose={() => {
            // The window closes itself after a save too. Only a window the Lien window's press opened, closed with
            // nothing saved, folds the line away.
            const fold = open.from === 'start' && !saved.current
            saved.current = false
            setWin(null)
            if (fold) onCancel?.()
          }}
          jobLabel={jobLabel}
          clockMonths={clockMonths}
          noticedMonths={noticedMonths}
          affidavitMonths={affidavitMonths}
          propertyKind={propertyKind}
          day={open.from === 'keep' ? kept : undefined}
          onDay={open.from === 'keep' ? setKept : undefined}
        />
      ) : null}
    </div>
  )
}
