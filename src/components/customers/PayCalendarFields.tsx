import { payCalendarFieldStyle, payCalendarLabelStyle } from './payCalendarFieldStyles'
import { PAY_CALENDAR_CLAUSE_MAX, PAY_CALENDAR_CUTOFF_MAX, PAY_CALENDAR_WORDS_MAX, ordinalDay, type PayCalendar } from '../../lib/jobs/payCalendar'

/**
 * The Pay calendar's own fields (punch list #323): the day bills must be in by, the day they pay
 * and of which month, pay when paid, and where the contract says it. One home for the office's
 * window (`PayCalendarModal`) and the estimator's part of a job draft (`DraftPayTermsPart`), so
 * the two never ask in different words.
 */

const CUTOFF_DAYS = Array.from({ length: PAY_CALENDAR_CUTOFF_MAX }, (_, i) => i + 1)
const PAY_DAYS = Array.from({ length: 30 }, (_, i) => i + 1)
const MONTH_CHOICES = ['the same month', 'the next month', 'the month after that'] as const

export default function PayCalendarFields({ form, onChange, disabled = false, clauseLabel = 'Where the contract says it' }: { form: PayCalendar; onChange: (patch: Partial<PayCalendar>) => void; disabled?: boolean; clauseLabel?: string }) {
  const labelStyle = payCalendarLabelStyle
  const fieldStyle = payCalendarFieldStyle
  return (
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
          placeholder="Paid the 10th of the month after it is received."
          style={{ ...fieldStyle, flex: '1 1 200px', minWidth: 0 }}
        />
      </div>
    </>
  )
}
