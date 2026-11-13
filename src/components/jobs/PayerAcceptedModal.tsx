import { useEffect, useId, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { dueDayFor, payCalendarMonthDay, payCalendarWords, type PayCalendar } from '../../lib/jobs/payCalendar'
import { saveInvoiceAcceptance } from '../../lib/jobs/payCalendarIo'

/**
 * They accepted it on… (punch list #323, PR 4): the day a payer accepted one bill, for a payer
 * on a Pay calendar. The contract counts its cutoff from the day an acceptable application is
 * received, and the app only knows the day the bill went in. Most bills need nothing here. A
 * bill that was sent back and accepted the next month is due a whole month later, and this is
 * where the office says so. The window shows what each day makes the bill before it is saved.
 * The save goes through `set_invoice_payer_accepted_on`, which decides who may.
 */
export default function PayerAcceptedModal({
  invoiceId,
  billLabel,
  payerName,
  calendar,
  wentInYmd,
  acceptedYmd,
  onClose,
  onSaved,
}: {
  invoiceId: string
  /** The bill in the board's words: "1406 · Larkfield clinic, rough-in". */
  billLabel: string
  payerName: string
  calendar: PayCalendar
  /** The day the bill went in, as the board reads it; null when it has none. */
  wentInYmd: string | null
  /** The accepted day on record; null when there is none. */
  acceptedYmd: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const isTopmost = useModalStackEntry()
  const titleId = useId()
  const [ymd, setYmd] = useState(acceptedYmd ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isTopmost() && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isTopmost, onClose, saving])

  const sentDue = useMemo(() => (wentInYmd ? dueDayFor(wentInYmd, calendar) : null), [wentInYmd, calendar])
  const acceptedDue = useMemo(() => (ymd ? dueDayFor(ymd, calendar) : null), [ymd, calendar])
  const moves = acceptedDue != null && sentDue != null && acceptedDue !== sentDue

  const write = async (next: string | null) => {
    setSaving(true)
    try {
      await saveInvoiceAcceptance(supabase, { invoiceId, acceptedYmd: next })
      showToast(next ? 'Accepted day saved.' : 'Accepted day cleared.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, next ? 'Could not save the accepted day' : 'Could not clear the accepted day'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const dead = saving || !ymd || ymd === (acceptedYmd ?? '')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="payer-accepted-modal"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem', boxSizing: 'border-box' }}
      onClick={(e) => {
        e.stopPropagation()
        if (!saving) onClose()
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-base)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(440px, 100%)', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: '1.05rem' }}>
          They accepted it on…
        </h2>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {billLabel} · {payerName}
        </p>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          {payCalendarWords(calendar)} Their cutoff counts from the day they accept a bill. Set this only when that is not the day it went in.
        </p>

        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', margin: '0.9rem 0 4px' }}>
          The day they accepted it
          <input
            type="date"
            aria-label="The day they accepted it"
            value={ymd}
            disabled={saving}
            onChange={(e) => setYmd(e.target.value)}
            style={{ display: 'block', marginTop: 4, padding: '0.45rem 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', fontWeight: 400, minHeight: 36 }}
          />
        </label>

        <div data-testid="payer-accepted-preview" style={{ margin: '0.75rem 0 0', padding: '0.5rem 0.7rem', borderRadius: 8, fontSize: '0.8125rem', background: moves ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)', color: moves ? 'var(--text-amber-800)' : 'var(--text-blue-800)' }}>
          {sentDue && wentInYmd ? (
            <div>
              In on {payCalendarMonthDay(wentInYmd)}, it is due {payCalendarMonthDay(sentDue)}.
            </div>
          ) : null}
          {acceptedDue && ymd ? (
            <div style={{ fontWeight: 700 }}>
              Accepted {payCalendarMonthDay(ymd)}, it is due {payCalendarMonthDay(acceptedDue)}.
            </div>
          ) : (
            <div>Pick the day to see what it makes the bill.</div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          {acceptedYmd ? (
            <button type="button" onClick={() => void write(null)} disabled={saving} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-700)', border: '1px solid var(--border)', borderRadius: 6, cursor: saving ? 'default' : 'pointer' }}>
              Clear the accepted day
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void write(ymd)}
            disabled={dead}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 6, cursor: dead ? 'default' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save the accepted day'}
          </button>
        </div>
      </div>
    </div>
  )
}
