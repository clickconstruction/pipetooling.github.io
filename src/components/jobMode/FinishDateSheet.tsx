import { useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { FINISH_CALL_WORDS, FINISH_WHY_MAX, finishChoices, finishDayOk } from '../../lib/jobMode/finishCall'
import { paceDayWords } from '../../lib/jobMode/paceCard'
import { saveFinishCall } from '../../lib/jobMode/finishCallIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { PhoneSheet } from '../PhoneSheet'

/**
 * My finish date (punch list #396, PR 3): the pace card's window for the day he says the job finishes. Quick
 * picks around the day in force, a date box for any other day, and one line for what is in the way.
 *
 * A save is one new row of `job_finish_calls` in his own name. It moves neither the planned finish nor the
 * score. `lib/jobMode/finishCall.ts` holds the picks and every word.
 */

const CHIP: CSSProperties = { minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '0.9rem', cursor: 'pointer' }
const CHIP_ON: CSSProperties = { ...CHIP, borderColor: '#2563eb', background: 'var(--bg-blue-tint)', fontWeight: 700 }
const FIELD: CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '1rem' }
const LABEL: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }

export function FinishDateSheet({ jobId, plannedYmd, saidYmd, saidWhy, onClose, onSaved }: {
  jobId: string
  plannedYmd: string | null
  /** His last word, when he has said a day: the picks centre on it and the window opens with it picked. */
  saidYmd: string | null
  saidWhy?: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const today = todayYmdInAppTz()
  const choices = useMemo(() => finishChoices({ plannedYmd, saidYmd, todayYmd: today }), [plannedYmd, saidYmd, today])
  const start = saidYmd && finishDayOk(saidYmd, today) ? saidYmd : plannedYmd && finishDayOk(plannedYmd, today) ? plannedYmd : ''
  const [day, setDay] = useState<string>(start)
  const [other, setOther] = useState<boolean>(choices.length === 0)
  const [why, setWhy] = useState<string>(saidWhy ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = finishDayOk(day, today) && !busy

  const save = async () => {
    if (!finishDayOk(day, today) || busy) return
    setBusy(true)
    setError(null)
    try {
      await saveFinishCall({ jobId, finishOn: day, planWas: plannedYmd, why })
      showToast(FINISH_CALL_WORDS.saved(paceDayWords(day) ?? day), 'success')
      onSaved()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e, FINISH_CALL_WORDS.failed))
      setBusy(false)
    }
  }

  return (
    <PhoneSheet label={FINISH_CALL_WORDS.label} title={FINISH_CALL_WORDS.title} width={440} zIndex={1100} dataAttrs={{ 'data-finish-date': '' }} onClose={onClose}>
      <div style={{ overflowY: 'auto', minHeight: 0, padding: '0.5rem 1rem 1rem', display: 'grid', gap: '0.75rem' }}>
        {choices.length > 0 ? (
          <div role="group" aria-label={FINISH_CALL_WORDS.dayLabel} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {choices.map((c) => (
              <button key={c.ymd} type="button" data-testid="finish-date-pick" data-ymd={c.ymd} aria-pressed={!other && day === c.ymd} onClick={() => { setDay(c.ymd); setOther(false) }} style={!other && day === c.ymd ? CHIP_ON : CHIP}>
                {c.words}
              </button>
            ))}
            <button type="button" data-testid="finish-date-another" aria-pressed={other} onClick={() => setOther(true)} style={other ? CHIP_ON : CHIP}>
              {FINISH_CALL_WORDS.another}
            </button>
          </div>
        ) : null}
        {other ? (
          <label style={LABEL}>
            {FINISH_CALL_WORDS.dayLabel}
            <input id="finish-date-day" type="date" data-testid="finish-date-day" value={day} min={today} onChange={(e) => setDay(e.target.value)} style={FIELD} />
          </label>
        ) : null}
        <label style={LABEL}>
          {FINISH_CALL_WORDS.whyLabel}
          <input id="finish-date-why" type="text" data-testid="finish-date-why" value={why} maxLength={FINISH_WHY_MAX} onChange={(e) => setWhy(e.target.value)} placeholder={FINISH_CALL_WORDS.whyPlaceholder} style={FIELD} />
        </label>
        {error ? <p role="alert" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
        <button
          type="button"
          data-testid="finish-date-save"
          disabled={!ready}
          onClick={() => void save()}
          style={{ minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: 'none', font: 'inherit', fontWeight: 700, fontSize: '0.95rem', cursor: ready ? 'pointer' : 'default', ...(ready ? { background: '#2563eb', color: '#fff' } : { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT }) }}
        >
          {busy ? FINISH_CALL_WORDS.saving : FINISH_CALL_WORDS.save}
        </button>
      </div>
    </PhoneSheet>
  )
}

export default FinishDateSheet
