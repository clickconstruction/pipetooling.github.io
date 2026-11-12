import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOptionalAuth } from '../../hooks/useAuth'
import { usePayCalendarModal } from '../../contexts/PayCalendarModalContext'
import { isStagesOfficeRole } from '../../lib/jobs/stagesRoleGates'
import { loadPayerPayCalendars } from '../../lib/jobs/payCalendarIo'
import { payCalendarShort, payCalendarWords, type PayCalendar } from '../../lib/jobs/payCalendar'

/**
 * One line of small words that names a payer's pay calendar and opens its window (punch list
 * #323): *In by month end, paid the 10th*, or *Set a pay calendar…* for the office when there
 * is none. It draws nothing for a reader with no calendar to see and no right to set one, and
 * nothing where the window has no opener (a public page, a render test without the provider).
 * A read that fails reads as none: the line is a door, never the place an error shows.
 */
export default function PayCalendarLine({ payerId, payerName }: { payerId: string; payerName: string }) {
  const opener = usePayCalendarModal()
  const role = useOptionalAuth()?.role ?? null
  const canSet = isStagesOfficeRole(role)
  const [calendar, setCalendar] = useState<PayCalendar | null>(null)
  const [loaded, setLoaded] = useState(false)

  const read = useCallback(async () => {
    try {
      const rows = await loadPayerPayCalendars(supabase, payerId)
      setCalendar(rows.find((r) => r.jobId == null)?.calendar ?? null)
    } catch {
      setCalendar(null)
    } finally {
      setLoaded(true)
    }
  }, [payerId])

  useEffect(() => {
    void read()
  }, [read])

  if (!opener || !loaded) return null
  if (!calendar && !canSet) return null
  return (
    <button
      type="button"
      className="payCalendarPress"
      data-testid="pay-calendar-line"
      title={calendar ? payCalendarWords(calendar) : 'For a payer who pays on a set day of the month'}
      onClick={() => opener.openPayCalendar({ id: payerId, name: payerName }, { onSaved: () => void read() })}
      style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}
    >
      {calendar ? payCalendarShort(calendar) : 'Set a pay calendar…'}
    </button>
  )
}
