import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { calendarFor, indexPayCalendars, sendTodayCutoffWords, type PayCalendar } from '../../lib/jobs/payCalendar'
import { loadPayerPayCalendars } from '../../lib/jobs/payCalendarIo'

/**
 * Bill Customer's line for a payer on a Pay calendar (punch list #323, PR 3): what sending today
 * makes the bill, and what waiting past the cutoff costs. *Sent today, this bill is due Dec 10.
 * Their cutoff is Nov 30. After that, Jan 10.* Said where the bill goes out, the last place it can
 * still change the day. Never a gate on sending. Fail-soft: no line on a read that fails.
 */
export function BillCustomerPayCutoffLine({ payerCustomerId, jobId }: { payerCustomerId: string | null; jobId: string | null }) {
  const [calendar, setCalendar] = useState<PayCalendar | null>(null)
  useEffect(() => {
    setCalendar(null)
    if (!payerCustomerId) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadPayerPayCalendars(supabase, payerCustomerId)
        if (!cancelled) setCalendar(calendarFor(indexPayCalendars(rows), { payerId: payerCustomerId, jobId }))
      } catch {
        // an extra — the bill goes out without it
      }
    })()
    return () => {
      cancelled = true
    }
  }, [payerCustomerId, jobId])
  const words = calendar ? sendTodayCutoffWords(todayYmdInAppTz(), calendar) : null
  if (!words) return null
  return (
    <div
      data-testid="bill-customer-pay-cutoff"
      style={{
        marginTop: '0.6rem',
        padding: '0.5rem 0.7rem',
        border: `1px solid ${words.soon ? 'var(--border-amber)' : 'var(--border)'}`,
        background: words.soon ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)',
        borderRadius: 8,
        fontSize: '0.8125rem',
        color: words.soon ? 'var(--text-amber-800)' : 'var(--text-blue-800)',
      }}
    >
      <strong>{words.due}</strong> {words.cutoff}
    </div>
  )
}
