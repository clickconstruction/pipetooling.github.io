import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { usePayCalendarModal } from '../../contexts/PayCalendarModalContext'
import { isStagesOfficeRole } from '../../lib/jobs/stagesRoleGates'
import { PAY_TERMS_NOT_A_CALENDAR_NOTE, PAY_TERMS_SET_NOTE, draftPayTermsFromWords, type DraftPayTerms } from '../../lib/jobs/draftPayTerms'
import { loadJobAndPayerForBid } from '../../lib/jobs/draftPayTermsIo'

/**
 * The Dispatch row's two presses for pay terms an estimator sent on their own (punch list #323):
 * **Open the pay calendar** opens the window on the bid's job, filled in, with the payer's
 * record in front of the office, and a save closes the row and tells the estimator. **Not a
 * calendar payer** closes it with that answer. For the roles that set a calendar: an estimator
 * in the Dispatch group reads the row and gets neither press.
 */
const btn = { padding: '0.35rem 0.75rem', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, flexShrink: 0, fontFamily: 'inherit' } as const

export default function PayTermsRequestActions({
  requestId,
  bidId,
  terms,
  from,
  role,
  onCloseRequestWithNote,
}: {
  requestId: string
  bidId: string
  terms: DraftPayTerms
  from: string | null
  role: string | null | undefined
  onCloseRequestWithNote?: (requestId: string, note: string) => Promise<void> | void
}) {
  const opener = usePayCalendarModal()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  if (!opener || !isStagesOfficeRole(role)) return null

  const open = async () => {
    if (busy) return
    setBusy(true)
    try {
      const found = await loadJobAndPayerForBid(supabase, bidId)
      if (!found) {
        showToast('This bid has no job that names who to bill yet. Open the job first, then set its pay calendar.', 'info')
        return
      }
      opener.openPayCalendar(found.payer, {
        job: found.job,
        initial: { calendar: terms.calendar, scope: terms.scope, from: draftPayTermsFromWords(from).replace(/draft$/, 'read') },
        onSaved: () => void onCloseRequestWithNote?.(requestId, PAY_TERMS_SET_NOTE),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="pay-terms-request-open"
        onClick={(e) => {
          e.stopPropagation()
          void open()
        }}
        disabled={busy}
        title="Opens the pay calendar on this bid's job, filled in, with their record against it. Saving it closes this to-do."
        style={{ ...btn, border: '1px solid var(--border-blue)', color: 'var(--text-link)' }}
      >
        Open the pay calendar
      </button>
      {onCloseRequestWithNote ? (
        <button
          type="button"
          data-testid="pay-terms-request-not"
          onClick={(e) => {
            e.stopPropagation()
            void onCloseRequestWithNote(requestId, PAY_TERMS_NOT_A_CALENDAR_NOTE)
          }}
          title="Closes this to-do and tells the estimator no pay calendar was set"
          style={{ ...btn, border: '1px solid var(--border-strong)', color: 'var(--text-700)', fontWeight: 500 }}
        >
          Not a calendar payer
        </button>
      ) : null}
    </>
  )
}
