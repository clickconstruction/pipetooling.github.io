import { useState } from 'react'
import PayCalendarFields, { payCalendarLabelStyle } from '../customers/PayCalendarFields'
import { PAY_CALENDAR_DEFAULT, payCalendarPreview, payCalendarShort, payCalendarWords, type PayCalendar } from '../../lib/jobs/payCalendar'
import { DRAFT_PAY_TERMS_SCOPE_DEFAULT, draftPayTermsScopeHint, draftPayTermsScopeWords, type DraftPayTerms, type DraftPayTermsScope } from '../../lib/jobs/draftPayTerms'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * The winning GC's pay terms on an estimator's job draft (punch list #323, the owner's call of
 * 2026-11-13): one line of small words under the GC, closed until pressed. **Add their pay
 * terms** opens the Pay calendar's own choices in place, with whose the terms are and the
 * plain-date read-back; **Done** closes them to one line again. No payment record is drawn:
 * an estimator reads none. The terms go with the draft and the office makes them the calendar.
 */

const quiet = { fontSize: '0.8125rem', color: 'var(--text-muted)' } as const
const pressStyle = { fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 } as const
const plainBtn = { padding: '0.35rem 0.7rem', fontFamily: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-700)' } as const

export default function DraftPayTermsPart({ gcName, value, onChange }: { gcName: string; value: DraftPayTerms | null; onChange: (next: DraftPayTerms | null) => void }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<DraftPayTermsScope>(value?.scope ?? DRAFT_PAY_TERMS_SCOPE_DEFAULT)
  const [form, setForm] = useState<PayCalendar>(value?.calendar ?? PAY_CALENDAR_DEFAULT)

  const start = () => {
    setScope(value?.scope ?? DRAFT_PAY_TERMS_SCOPE_DEFAULT)
    setForm(value?.calendar ?? PAY_CALENDAR_DEFAULT)
    setOpen(true)
  }

  if (!open) {
    return (
      <div data-testid="draft-pay-terms-line" style={{ ...quiet, display: 'flex', flexWrap: 'wrap', gap: '2px 8px', alignItems: 'baseline', margin: '4px 0 2px' }}>
        {value ? (
          <>
            <strong style={{ color: 'var(--text-base)', fontWeight: 600 }} title={payCalendarWords(value.calendar)}>
              {payCalendarShort(value.calendar)}
            </strong>
            <span>{draftPayTermsScopeWords(value.scope)}</span>
            <button type="button" onClick={start} style={pressStyle} aria-label="Change their pay terms">
              Change
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={start} style={pressStyle}>
              + Add their pay terms
            </button>
            <span>if they pay on a set day of the month</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div data-testid="draft-pay-terms-part" role="group" aria-label={`${gcName}’s pay terms`} style={{ margin: '6px 0 4px', padding: '0.6rem 0.75rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
      <DraftPayTermsEditor gcName={gcName} scope={scope} form={form} onScope={setScope} onForm={setForm} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setOpen(false)
          }}
          style={{ ...plainBtn, color: 'var(--text-muted)' }}
        >
          Leave it out
        </button>
        <button
          type="button"
          onClick={() => {
            onChange({ scope, calendar: { ...form, clause: form.clause.trim(), words: form.words.trim() } })
            setOpen(false)
          }}
          style={{ ...plainBtn, fontWeight: 600 }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

/** The choices themselves: whose the terms are, the calendar's fields and the plain-date read-back. No frame and no buttons, so a sheet can hold them too. */
export function DraftPayTermsEditor({
  gcName,
  scope,
  form,
  onScope,
  onForm,
}: {
  gcName: string
  scope: DraftPayTermsScope
  form: PayCalendar
  onScope: (scope: DraftPayTermsScope) => void
  onForm: (next: PayCalendar) => void
}) {
  const preview = payCalendarPreview(form, todayYmdInAppTz())
  const scopePress = (key: DraftPayTermsScope, words: string) => {
    const on = scope === key
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => onScope(key)}
        style={{ flex: '1 1 130px', minWidth: 0, textAlign: 'left', padding: '0.4rem 0.6rem', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: on ? 700 : 400, border: `1px solid ${on ? 'var(--text-link)' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-base)', borderRadius: 8, cursor: 'pointer' }}
      >
        {words}
      </button>
    )
  }
  return (
    <>
      <div style={{ ...payCalendarLabelStyle, marginTop: 0 }}>These terms are for</div>
      <div role="radiogroup" aria-label="These terms are for" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {scopePress('job', 'Only this job')}
        {scopePress('payer', `Every job ${gcName} pays`)}
      </div>
      <p style={{ ...quiet, margin: '6px 0 0', fontSize: '0.75rem' }}>{draftPayTermsScopeHint(scope)}</p>

      <PayCalendarFields form={form} onChange={(patch) => onForm({ ...form, ...patch })} clauseLabel="Where it says so" />

      <div data-testid="draft-pay-terms-preview" style={{ margin: '0.75rem 0 0', padding: '0.5rem 0.7rem', borderRadius: 8, fontSize: '0.8125rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>
        <div style={{ fontWeight: 700 }}>{preview?.inBy ?? payCalendarWords(form)}</div>
        {preview ? <div>{preview.dayLate}</div> : null}
      </div>
    </>
  )
}
