import type { BulkGenerateConfirm } from '../../hooks/useBulkGeneratePayStubs'

/** Above Draft Payroll, which it is asked from. */
const Z_BULK_GENERATE_CONFIRM = 1200

/** Draft Payroll → Generate Remaining: how many reports, for which period, before anything is made. */
export function BulkGeneratePayStubsConfirm({
  confirm,
  onCancel,
  onConfirm,
}: {
  /** Who was picked when the button was pressed; `null` while nothing is being asked. */
  confirm: BulkGenerateConfirm | null
  onCancel: () => void
  onConfirm: (candidates: string[]) => void
}) {
  if (!confirm) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_BULK_GENERATE_CONFIRM }}>
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-generate-confirm-title" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
        <h2 id="bulk-generate-confirm-title" style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Generate pay reports?</h2>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>
          Generate {confirm.candidates.length} pay report(s) for {confirm.start} through {confirm.end}?
        </p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          People who already have a report for this period are skipped, and so is anyone whose week comes to $0.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(confirm.candidates)}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            Generate {confirm.candidates.length} report(s)
          </button>
        </div>
      </div>
    </div>
  )
}
