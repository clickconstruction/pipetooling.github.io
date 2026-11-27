import { useState } from 'react'
import { payCalendarFieldStyle, payCalendarLabelStyle } from './payCalendarFieldStyles'
import { PAY_CALENDAR_CLAUSE_MAX, PAY_CALENDAR_CUTOFF_MAX, PAY_CALENDAR_DAYS_AFTER_DEFAULT, PAY_CALENDAR_DAYS_AFTER_MAX, PAY_CALENDAR_WORDS_MAX, ordinalDay, paysDaysAfter, showsHowTheyPay, type PayCalendar } from '../../lib/jobs/payCalendar'

/**
 * The Pay calendar's own fields (punch list #323): the day bills must be in by, the day they pay
 * and of which month, pay when paid, and where the contract says it. One home for the office's
 * window (`PayCalendarModal`) and the estimator's part of a job draft (`DraftPayTermsPart`), so
 * the two never ask in different words.
 *
 * The first choice is how they pay (punch list #341, PR 5): on a set day of the month, or a number
 * of days after the bill is accepted. The second shape asks for the days alone.
 *
 * That choice is hidden since v2.8714 (call 4: no contract here pays a number of days after the
 * bill). It is drawn only for terms that are already in days, a stored row or a draft's, and stays
 * while the fields are open so a switch to a set day can be switched back (`showsHowTheyPay`).
 */

const CUTOFF_DAYS = Array.from({ length: PAY_CALENDAR_CUTOFF_MAX }, (_, i) => i + 1)
const PAY_DAYS = Array.from({ length: 30 }, (_, i) => i + 1)
const MONTH_CHOICES = ['the same month', 'the next month', 'the month after that'] as const

export default function PayCalendarFields({ form, onChange, disabled = false, clauseLabel = 'Where the contract says it' }: { form: PayCalendar; onChange: (patch: Partial<PayCalendar>) => void; disabled?: boolean; clauseLabel?: string }) {
  const labelStyle = payCalendarLabelStyle
  const fieldStyle = payCalendarFieldStyle
  const days = paysDaysAfter(form)
  /** What is typed in the days box while it is not a number the terms can hold: an emptied box stays empty until a digit or a blur, and the form keeps its last days. Null shows the form's own. */
  const [daysTyped, setDaysTyped] = useState<string | null>(null)
  /** The terms were in days at some point while these fields were open: the choice then stays on the page. */
  const [hadDays, setHadDays] = useState(days)
  if (days && !hadDays) setHadDays(true)
  const showsHow = showsHowTheyPay({ days, hadDays })
  const howPress = (on: boolean, words: string, pick: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={pick}
      style={{ flex: '1 1 150px', minWidth: 0, textAlign: 'left', padding: '0.4rem 0.6rem', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: on ? 700 : 400, border: `1px solid ${on ? 'var(--text-link)' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-base)', borderRadius: 8, cursor: disabled ? 'default' : 'pointer' }}
    >
      {words}
    </button>
  )
  return (
    <>
      {showsHow ? (
        <>
          <div style={labelStyle}>How they pay</div>
          <div role="radiogroup" aria-label="How they pay" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {howPress(!days, 'On a set day of the month', () => onChange({ daysAfter: null }))}
            {howPress(days, 'A number of days after the bill', () => onChange({ daysAfter: form.daysAfter ?? PAY_CALENDAR_DAYS_AFTER_DEFAULT }))}
          </div>
        </>
      ) : null}

      {days ? (
        <label style={labelStyle}>
          Days after the bill is accepted
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={PAY_CALENDAR_DAYS_AFTER_MAX}
            step={1}
            aria-label="Days after the bill is accepted"
            value={daysTyped ?? form.daysAfter ?? ''}
            disabled={disabled}
            onChange={(e) => {
              // Whole days, held inside what the terms here can name. Anything else is kept as typed and the form keeps its last days, so it is never neither shape.
              const raw = e.target.value
              const n = Math.floor(Number(raw))
              if (raw.trim() === '' || !Number.isFinite(n) || n < 1) {
                setDaysTyped(raw)
                return
              }
              setDaysTyped(null)
              onChange({ daysAfter: Math.min(n, PAY_CALENDAR_DAYS_AFTER_MAX) })
            }}
            onBlur={() => setDaysTyped(null)}
            style={{ ...fieldStyle, display: 'block', marginTop: 4, width: 110 }}
          />
        </label>
      ) : (
        <>
      <label style={labelStyle}>
        Bills must be in by
        <select
          aria-label="Bills must be in by"
          value={form.cutoffDay ?? 'eom'}
          disabled={disabled}
          onChange={(e) => onChange({ cutoffDay: e.target.value === 'eom' ? null : Number(e.target.value) })}
          style={{ ...fieldStyle, display: 'block', marginTop: 4, maxWidth: '100%' }}
        >
          <option value="eom">The last day of the month</option>
          {CUTOFF_DAYS.map((d) => (
            <option key={d} value={d}>
              The {ordinalDay(d)}
            </option>
          ))}
        </select>
      </label>

      <div style={labelStyle}>They pay on the</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: '0.875rem' }}>
        <select aria-label="They pay on the" value={form.payDay >= 31 ? 31 : form.payDay} disabled={disabled} onChange={(e) => onChange({ payDay: Number(e.target.value) })} style={fieldStyle}>
          {PAY_DAYS.map((d) => (
            <option key={d} value={d}>
              {ordinalDay(d)}
            </option>
          ))}
          <option value={31}>last day</option>
        </select>
        <span>of</span>
        <select aria-label="Of which month" value={form.monthsAfter} disabled={disabled} onChange={(e) => onChange({ monthsAfter: Number(e.target.value) })} style={fieldStyle}>
          {MONTH_CHOICES.map((words, i) => (
            <option key={words} value={i}>
              {words}
            </option>
          ))}
        </select>
      </div>
        </>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', marginTop: '0.8rem', cursor: disabled ? 'default' : 'pointer' }}>
        <input type="checkbox" checked={form.payWhenPaid} disabled={disabled} onChange={(e) => onChange({ payWhenPaid: e.target.checked })} style={{ marginTop: 3 }} />
        <span>
          They pay when the owner pays them
          {form.payWhenPaid ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>The due day then reads as no sooner than.</span> : null}
        </span>
      </label>

      <div style={labelStyle}>{clauseLabel}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <input
          type="text"
          aria-label="Clause number"
          value={form.clause}
          disabled={disabled}
          onChange={(e) => onChange({ clause: e.target.value.slice(0, PAY_CALENDAR_CLAUSE_MAX) })}
          placeholder="§ 5.2"
          style={{ ...fieldStyle, width: 90 }}
        />
        <input
          type="text"
          aria-label="The clause in a few words"
          value={form.words}
          disabled={disabled}
          onChange={(e) => onChange({ words: e.target.value.slice(0, PAY_CALENDAR_WORDS_MAX) })}
          placeholder={days ? 'Paid 45 days after an approved application.' : 'Paid the 10th of the month after it is received.'}
          style={{ ...fieldStyle, flex: '1 1 200px', minWidth: 0 }}
        />
      </div>
    </>
  )
}
