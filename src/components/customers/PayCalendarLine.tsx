import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOptionalAuth } from '../../hooks/useAuth'
import { usePayCalendarModal } from '../../contexts/PayCalendarModalContext'
import { isStagesOfficeRole } from '../../lib/jobs/stagesRoleGates'
import { loadPayerPayCalendars, onPayCalendarChanged } from '../../lib/jobs/payCalendarIo'
import { calendarSourceFor, indexPayCalendars, jobPayCalendarWords, payCalendarShort, payCalendarWords, type PayCalendarRow } from '../../lib/jobs/payCalendar'
import type { PayCalendarJob } from '../../lib/jobs/payCalendarJob'
import { draftPayTermsFromWords, draftPayTermsOffered } from '../../lib/jobs/draftPayTerms'
import type { DraftPayTermsOffer } from '../../lib/jobs/draftPayTermsIo'

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
 *
 * With an `offer` (punch list #323) the job's line also carries the pay terms an estimator read
 * on the bid, until the office answers them: *From Dana Whitfield's draft · In by the 25th, paid
 * the 10th · Check and use*, which opens the window filled in.
 */
export default function PayCalendarLine({
  payerId,
  payerName,
  job = null,
  variant = 'small',
  offer = null,
}: {
  payerId: string
  payerName: string
  job?: PayCalendarJob | null
  variant?: 'small' | 'row'
  /** Pay terms an estimator's job draft carried for this job; drawn only with a `job`, for a reader who may set a calendar. */
  offer?: DraftPayTermsOffer | null
}) {
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
    const source = calendarSourceFor(indexPayCalendars(rows), { payerId, jobId: job.id })
    const words = jobPayCalendarWords(source, payerName, canSet)
    const offered = canSet && offer && draftPayTermsOffered(offer.terms, source.from) ? offer : null
    if (offered) {
      const from = draftPayTermsFromWords(offered.from)
      const openOffer = () => opener.openPayCalendar({ id: payerId, name: payerName }, { onSaved, job, initial: { calendar: offered.terms.calendar, scope: offered.terms.scope, from } })
      return (
        <span data-testid="pay-calendar-line" style={style}>
          {/* A job that follows its payer still says so: the draft's terms are an offer beside it, never in its place. */}
          {words && source.from !== 'none' ? (
            <span style={{ display: 'block' }}>
              {words.lead ? <span data-testid="pay-calendar-line-lead">{words.lead} · </span> : null}
              <button type="button" className="payCalendarPress" data-testid="pay-calendar-line-press" title={words.title} onClick={open}>
                {words.press}
              </button>
            </span>
          ) : null}
          <span data-testid="pay-calendar-line-offer">
            From {from.replace(/^The draft$/, 'the draft')} · <span title={payCalendarWords(offered.terms.calendar)}>{payCalendarShort(offered.terms.calendar)}</span> ·{' '}
            <button type="button" className="payCalendarPress" data-testid="pay-calendar-line-offer-press" title="Opens the pay calendar filled in, with their record against it" onClick={openOffer}>
              Check and use
            </button>
          </span>
        </span>
      )
    }
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
