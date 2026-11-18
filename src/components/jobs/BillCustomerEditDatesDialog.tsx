import type { Dispatch, SetStateAction } from 'react'
import { BILL_CUSTOMER_DATE_INPUT_STYLE, BILL_CUSTOMER_FIELD_LABEL_STYLE } from './billCustomerStyles'

/**
 * The dates are the window's shared fields and the drafts are set by whichever tab opens the dialog, so every value is
 * the window's own state under the window's own name (SEND_RECORD_INVOICE_MODAL map, "Edit-dates dialog": opened from
 * the Stripe bill's due line and from the physical invoice's two date links). The window mounts it while it is open.
 */
export type BillCustomerEditDatesDialogProps = {
  /** The tab that opened it: the physical invoice also edits its service date. */
  tab: 'stripe' | 'housecallpro' | 'physical'
  overlayZIndex: number
  draftServiceYmd: string
  setDraftServiceYmd: (value: string) => void
  draftDueYmd: string
  setDraftDueYmd: (value: string) => void
  setEditDueDateOpen: Dispatch<SetStateAction<boolean>>
  /** The service date: HouseCall Pro's date and the physical invoice's. Written only when the physical tab opened the dialog. */
  setSentDate: (value: string) => void
  /** The due date, shared by the Stripe bill and the physical invoice. */
  setStripeDueDate: (value: string) => void
}

/** Bill Customer: the small window that edits the due date, and on the physical invoice the service date too. */
export function BillCustomerEditDatesDialog({
  tab,
  overlayZIndex,
  draftServiceYmd,
  setDraftServiceYmd,
  draftDueYmd,
  setDraftDueYmd,
  setEditDueDateOpen,
  setSentDate,
  setStripeDueDate,
}: BillCustomerEditDatesDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex + 20,
        padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem',
      }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) setEditDueDateOpen(false)
      }}
    >
      <div
        role="dialog"
        aria-labelledby="edit-bill-customer-dates-title"
        style={{
          background: 'var(--surface)',
          padding: '1.25rem',
          borderRadius: 8,
          minWidth: 280,
          maxWidth: 400,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="edit-bill-customer-dates-title" style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>
          {tab === 'physical' ? 'Edit dates' : 'Edit Due Date'}
        </h2>
        {tab === 'physical' ? (
          <>
            <label htmlFor="bill-customer-edit-service-date" style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, display: 'block' }}>
              Service date
            </label>
            <input
              id="bill-customer-edit-service-date"
              type="date"
              value={draftServiceYmd}
              onChange={(e) => setDraftServiceYmd(e.target.value)}
              style={{ ...BILL_CUSTOMER_DATE_INPUT_STYLE, marginBottom: '1rem' }}
            />
          </>
        ) : null}
        <label htmlFor="bill-customer-edit-due-date" style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, display: 'block' }}>
          Due date
        </label>
        <input
          id="bill-customer-edit-due-date"
          type="date"
          value={draftDueYmd}
          onChange={(e) => setDraftDueYmd(e.target.value)}
          style={{ ...BILL_CUSTOMER_DATE_INPUT_STYLE, marginBottom: '1rem' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setEditDueDateOpen(false)}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (tab === 'physical') {
                setSentDate(draftServiceYmd.trim())
              }
              setStripeDueDate(draftDueYmd.trim())
              setEditDueDateOpen(false)
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
