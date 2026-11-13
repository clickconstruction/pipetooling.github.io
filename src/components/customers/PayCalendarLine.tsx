import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOptionalAuth } from '../../hooks/useAuth'
import { usePayCalendarModal } from '../../contexts/PayCalendarModalContext'
import { isStagesOfficeRole } from '../../lib/jobs/stagesRoleGates'
import { loadPayerPayCalendars, onPayCalendarChanged } from '../../lib/jobs/payCalendarIo'
import { calendarSourceFor, indexPayCalendars, jobPayCalendarWords, payCalendarShort, payCalendarWords, type PayCalendarRow } from '../../lib/jobs/payCalendar'
import type { PayCalendarJob } from '../../lib/jobs/payCalendarJob'

/**
 * One line of small words that names a payer's pay calendar and opens its window (punch list
 * #323): *In by month end, paid the 10th*, or *Set a pay calendar…* for the office when there
 * is none. It draws nothing for a reader with no calendar to see and no right to set one, and
 * nothing where the window has no opener (a public page, a render test without the provider).
 * A read that fails reads as none: the line is a door, never the place an error shows.
 *
 * With a `job` (punch list #341) the line is that job's: it says whose calendar the job reads
 * (*Follows Larkfield Construction*, *This job's own*, *No pay calendar on this job*) and
 * opens the window on the job, so one job's own calendar is a press from where the job is
 * named. `variant="row"` is the job window's fact row, at the row's own size.
 */
export default function PayCalendarLine({ payerId, payerName, job = null, variant = 'small' }: { payerId: string; payerName: string; job?: PayCalendarJob | null; variant?: 'small' | 'row' }) {
  const opener = usePayCalendarModal()
  const role = useOptionalAuth()?.role ?? null
  const canSet = isStagesOfficeRole(role)
  const [rows, setRows] = useState<PayCalendarRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const read = useCallback(async () => {
    try {
      setRows(await loadPayerPayCalendars(supabase, payerId))
    } catch {
      setRows([])
    } finally {
      setLoaded(true)
    }
  }, [payerId])

  useEffect(() => {
    void read()
    // A save through any other door (the board's row, the Their paper sheet) is read here too.
    return onPayCalendarChanged(() => void read())
  }, [read])

  if (!opener || !loaded) return null
  const onSaved = () => void read()
  const open = () => opener.openPayCalendar({ id: payerId, name: payerName }, job ? { onSaved, job } : { onSaved })
  const style = variant === 'row' ? undefined : ({ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 } as const)

  if (job) {
    const words = jobPayCalendarWords(calendarSourceFor(indexPayCalendars(rows), { payerId, jobId: job.id }), payerName, canSet)
    if (!words) return null
    return (
      <span data-testid="pay-calendar-line" style={style}>
        {words.lead ? <span data-testid="pay-calendar-line-lead">{words.lead} · </span> : null}
        <button type="button" className="payCalendarPress" data-testid="pay-calendar-line-press" title={words.title} onClick={open}>
          {words.press}
        </button>
        {words.tail ? <span style={{ color: 'var(--text-muted)' }}> · {words.tail}</span> : null}
      </span>
    )
  }

  const calendar = rows.find((r) => r.jobId == null)?.calendar ?? null
  if (!calendar && !canSet) return null
  return (
    <button type="button" className="payCalendarPress" data-testid="pay-calendar-line" title={calendar ? payCalendarWords(calendar) : 'For a payer who pays on a set day of the month'} onClick={open} style={style}>
      {calendar ? payCalendarShort(calendar) : 'Set a pay calendar…'}
    </button>
  )
}
