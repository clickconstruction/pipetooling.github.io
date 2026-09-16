/**
 * Est. bill date for a partial invoice (Stages tab decomposition, v2.3530).
 *
 * Moved verbatim out of `JobsStagesTab.tsx` (region 5 of the architecture map). Opened from
 * the unified table's ham pencil; the date state and the mutation (`setInvoiceEstimatedBillDate`)
 * stay with the parent, which passes the saving flag for this invoice.
 */
export type StagesEstBillDateTarget = { invoiceId: string; jobId: string; jobName: string; hcpNumber: string }

export function StagesEstBillDateModal({
  target,
  date,
  saving,
  onDateChange,
  onSave,
  onCancel,
}: {
  target: StagesEstBillDateTarget
  date: string
  /** True while this invoice's est. bill date is being written. */
  saving: boolean
  onDateChange: (value: string) => void
  onSave: () => void | Promise<void>
  onCancel: () => void
}) {
  const disabled = !date.trim() || saving
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480 }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Est. bill date for partial invoice</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {target.jobName} ({target.hcpNumber})
        </p>
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onSave()}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
