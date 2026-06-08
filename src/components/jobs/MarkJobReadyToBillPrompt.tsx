import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { markJobReadyToBill } from '../../lib/markJobReadyToBill'

type Props = {
  job: { id: string; hcpNumber: string; jobName: string }
  /**
   * Called when the prompt is finished — either the move succeeded or the user dismissed it.
   * The report has already been saved by this point, so the caller should finalize/close its flow.
   */
  onClose: () => void
}

/**
 * Post-report prompt offering to advance a Working job to "Ready to bill" after a 100%-complete
 * report. Mirrors the Stages-board confirm modal's two attestations. The underlying RPC
 * (`update_job_status`) authorizes any job team member — including helpers.
 */
export function MarkJobReadyToBillPrompt({ job, onClose }: Props) {
  const { showToast } = useToastContext()
  const [partsReported, setPartsReported] = useState(false)
  const [customerSatisfied, setCustomerSatisfied] = useState(false)
  const [busy, setBusy] = useState(false)

  const canConfirm = partsReported && customerSatisfied && !busy

  async function confirm() {
    if (!canConfirm) return
    setBusy(true)
    const result = await markJobReadyToBill(job.id)
    showToast(result.message, result.ok ? 'success' : result.variant)
    if (result.ok) {
      onClose()
      return
    }
    setBusy(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 480,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Move to Ready to Bill?</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
          You marked this job 100% complete.
          <br />
          {job.hcpNumber} · {job.jobName}
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}
          >
            <input
              type="checkbox"
              checked={partsReported}
              onChange={(e) => setPartsReported(e.target.checked)}
              disabled={busy}
            />
            <span>I have reported all the Job Parts I've used</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={customerSatisfied}
              onChange={(e) => setCustomerSatisfied(e.target.checked)}
              disabled={busy}
            />
            <span>The customer knows the work is done and is satisfied</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!canConfirm}
            style={{
              padding: '0.5rem 1rem',
              background: canConfirm ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? '…' : 'Move to Ready to Bill'}
          </button>
        </div>
      </div>
    </div>
  )
}
