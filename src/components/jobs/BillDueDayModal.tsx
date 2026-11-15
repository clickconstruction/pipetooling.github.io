import { useEffect, useId, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { BILL_OWN_DUE_PRESS, PAY_CALENDAR_CLAUSE_MAX, PAY_CALENDAR_WORDS_MAX, billOwnDuePreview, type BillOwnDue } from '../../lib/jobs/payCalendar'
import { dispatchPayCalendarChanged, saveInvoiceDueDay } from '../../lib/jobs/payCalendarIo'

/**
 * This bill is due on… (punch list #341, PR 4): one bill's own due day. A retainage release, a
 * dated draw once it is billed, a final payment: the contract names a date for that one bill, and
 * neither the job's Pay calendar nor its payer's says it. The day sits at the top of the ladder a
 * bill reads (bill, job, payer, guess), for this bill alone. The window shows what the bill read
 * before and what the day makes it. The save goes through `set_invoice_due_day`, which decides
 * who may.
 */
export default function BillDueDayModal({
  invoiceId,
  billLabel,
  payerName,
  stored,
  otherwise,
  onClose,
  onSaved,
}: {
  invoiceId: string
  /** The bill in the board's words: "1431 · Larkfield medical office". */
  billLabel: string
  payerName: string
  /** The day on record; null when the bill has none. */
  stored: BillOwnDue | null
  /** What the bill reads without a day of its own: the due day its calendar makes it, and whose calendar that is. Null with no calendar. */
  otherwise: { dueYmd: string; own: boolean } | null
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const isTopmost = useModalStackEntry()
  const titleId = useId()
  const [ymd, setYmd] = useState(stored?.dueYmd ?? '')
  const [clause, setClause] = useState(stored?.clause ?? '')
  const [words, setWords] = useState(stored?.words ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isTopmost() && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isTopmost, onClose, saving])

  const write = async (next: string | null) => {
    setSaving(true)
    try {
      await saveInvoiceDueDay(supabase, { invoiceId, dueYmd: next, clause: clause.trim(), words: words.trim() })
      showToast(next ? 'This bill’s due day saved.' : 'This bill’s own day cleared.', 'success')
      // Every screen that reads a calendar reads again: the day rides with the calendars.
      dispatchPayCalendarChanged()
      onSaved()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, next ? 'Could not save this bill’s due day' : 'Could not clear this bill’s own day'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const same = ymd === (stored?.dueYmd ?? '') && clause.trim() === (stored?.clause ?? '') && words.trim() === (stored?.words ?? '')
  const dead = saving || !ymd || same
  const preview = billOwnDuePreview(ymd || null, otherwise)
  const fieldStyle = { padding: '0.45rem 0.6rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', fontWeight: 400, minHeight: 36, boxSizing: 'border-box' } as const
  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', margin: '0.9rem 0 4px' } as const

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="bill-due-day-modal"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem', boxSizing: 'border-box' }}
      onClick={(e) => {
        e.stopPropagation()
        if (!saving) onClose()
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-base)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(440px, 100%)', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: '1.05rem' }}>
          {BILL_OWN_DUE_PRESS}
        </h2>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {billLabel} · {payerName}
        </p>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          For one bill whose contract names its own date, like a retainage release or a dated draw. The day wins over any pay calendar, for this bill alone.
        </p>

        <label style={labelStyle}>
          The day it is due
          <input type="date" aria-label="The day it is due" value={ymd} disabled={saving} onChange={(e) => setYmd(e.target.value)} style={{ ...fieldStyle, display: 'block', marginTop: 4 }} />
        </label>

        <div style={labelStyle}>Where the contract says it</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <input type="text" aria-label="Clause number" value={clause} disabled={saving} onChange={(e) => setClause(e.target.value.slice(0, PAY_CALENDAR_CLAUSE_MAX))} placeholder="§ 9.4" style={{ ...fieldStyle, width: 90 }} />
          <input
            type="text"
            aria-label="The clause in a few words"
            value={words}
            disabled={saving}
            onChange={(e) => setWords(e.target.value.slice(0, PAY_CALENDAR_WORDS_MAX))}
            placeholder="Retainage is released 60 days after final acceptance."
            style={{ ...fieldStyle, flex: '1 1 200px', minWidth: 0 }}
          />
        </div>

        <div data-testid="bill-due-day-preview" style={{ margin: '0.75rem 0 0', padding: '0.5rem 0.7rem', borderRadius: 8, fontSize: '0.8125rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>
          <div>{preview.otherwise}</div>
          <div style={{ fontWeight: preview.picked ? 700 : 400 }}>{preview.own}</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          {stored ? (
            <button type="button" onClick={() => void write(null)} disabled={saving} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-700)', border: '1px solid var(--border)', borderRadius: 6, cursor: saving ? 'default' : 'pointer' }}>
              Clear this bill’s own day
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
            {saving ? 'Saving…' : 'Save this bill’s due day'}
          </button>
        </div>
      </div>
    </div>
  )
}
