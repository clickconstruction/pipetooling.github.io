import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useIsDigitalTwin } from '../../hooks/useIsDigitalTwin'
import { useToastContext } from '../../contexts/ToastContext'
import { createDispatchRequest, notifyDispatchRequestsChanged } from '../../lib/dispatchRequestHelpers'
import { formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { PAY_CALENDAR_DEFAULT, payCalendarMonthDay, payCalendarShort, type PayCalendar } from '../../lib/jobs/payCalendar'
import { DRAFT_PAY_TERMS_SCOPE_DEFAULT, draftPayTermsLine, draftPayTermsScopeWords, payTermsRequestTitle, type DraftPayTerms, type DraftPayTermsScope } from '../../lib/jobs/draftPayTerms'
import { PAY_TERMS_FROM_BID_ACTION, loadMySentPayTerms } from '../../lib/jobs/draftPayTermsIo'
import { bidHandoffLabel } from '../../lib/bids/wonDispatchHandoff'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { DraftPayTermsEditor } from './DraftPayTermsPart'

/**
 * The estimator's second door for a GC's pay terms (punch list #323, the owner's call of
 * 2026-11-13): a won bid whose job is already open, or whose signed contract came after the
 * draft went. One small line in the Job block, **Send their pay terms to the office**, opens the
 * same choices the draft sheet holds and files them with Dispatch as a row of their own. The
 * office makes them the calendar. Once sent the line says so, with the terms and the day.
 *
 * For a role that sends a job draft, never a digital twin. The caller draws it only once the
 * bid has a job: before that the terms go with the draft.
 */
const pressStyle = { fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 } as const

export function BidPayTermsToOffice({ bidId }: { bidId: string }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const isTwin = useIsDigitalTwin()
  const [sent, setSent] = useState<{ terms: DraftPayTerms; sentAt: string | null } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<DraftPayTermsScope>(DRAFT_PAY_TERMS_SCOPE_DEFAULT)
  const [form, setForm] = useState<PayCalendar>(PAY_CALENDAR_DEFAULT)
  const [sending, setSending] = useState(false)
  const userId = user?.id ?? null

  const read = useCallback(async () => {
    if (!userId) return
    setSent(await loadMySentPayTerms(supabase, bidId, userId))
    setLoaded(true)
  }, [bidId, userId])
  useEffect(() => {
    void read()
  }, [read])

  if (isTwin || !userId || !loaded) return null

  const start = () => {
    setScope(sent?.terms.scope ?? DRAFT_PAY_TERMS_SCOPE_DEFAULT)
    setForm(sent?.terms.calendar ?? PAY_CALENDAR_DEFAULT)
    setOpen(true)
  }

  const send = async () => {
    if (sending) return
    setSending(true)
    try {
      const terms: DraftPayTerms = { scope, calendar: { ...form, clause: form.clause.trim(), words: form.words.trim() } }
      const { data: bid } = await supabase.from('bids').select('bid_number, project_name').eq('id', bidId).maybeSingle()
      const bidLabel = bidHandoffLabel({ bidNumber: bid?.bid_number ?? null, projectName: bid?.project_name ?? null })
      await createDispatchRequest({
        fromUserId: userId,
        title: payTermsRequestTitle(terms, bidLabel),
        bidId,
        referenceSummary: bidLabel,
        pendingAction: PAY_TERMS_FROM_BID_ACTION,
        pendingPayload: { pay_terms: terms },
      })
      notifyDispatchRequestsChanged()
      showToast('Their pay terms went to the office.', 'success')
      setOpen(false)
      await read()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not send their pay terms'), 'error')
    } finally {
      setSending(false)
    }
  }

  const sentYmd = sent?.sentAt ? calendarYmdInAppTzFromIso(sent.sentAt) : ''
  return (
    <span data-testid="bid-pay-terms-to-office" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
      {sent ? (
        <>
          Pay terms sent to the office{sentYmd ? ` ${payCalendarMonthDay(sentYmd)}` : ''} · <span title={draftPayTermsLine(sent.terms)}>{payCalendarShort(sent.terms.calendar)}</span>, {draftPayTermsScopeWords(sent.terms.scope)} ·{' '}
          <button type="button" onClick={start} style={pressStyle}>
            Send a change
          </button>
        </>
      ) : (
        <button type="button" onClick={start} style={pressStyle}>
          + Send their pay terms to the office
        </button>
      )}
      {open ? (
        <ResponsiveModalShell
          title="Their pay terms"
          onRequestClose={() => (sending ? undefined : setOpen(false))}
          maxWidthDesktop={480}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setOpen(false)} disabled={sending} style={{ padding: '0.4rem 0.8rem', fontFamily: 'inherit', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-700)' }}>
                Cancel
              </button>
              <button type="button" onClick={() => void send()} disabled={sending} style={{ padding: '0.4rem 0.8rem', fontFamily: 'inherit', fontWeight: 600, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1 }}>
                {sending ? 'Sending…' : 'Send to the office'}
              </button>
            </div>
          }
        >
          <div style={{ padding: '0.25rem 0 0.5rem' }}>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>For a GC who pays on a set day of the month. The office checks them and sets the pay calendar.</p>
            <DraftPayTermsEditor gcName="the GC" scope={scope} form={form} onScope={setScope} onForm={setForm} />
          </div>
        </ResponsiveModalShell>
      ) : null}
    </span>
  )
}
