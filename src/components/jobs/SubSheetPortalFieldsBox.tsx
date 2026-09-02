import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * "Shown on the sub's portal" box (sub-portal train) — the three per-sheet
 * fields the portal's job card reads: status override, payable-after date,
 * and the plain-words hold reason the sub reads verbatim. Self-contained:
 * saves through the set_sub_sheet_portal_fields RPC (office-gated), so the
 * 2.5k-line form modal only mounts it.
 *
 * Initial values arrive via props (the sheet row, cast by the caller — the
 * columns land with the sub-portal migration; until it applies, fields start
 * blank and save reports the friendly error).
 */

export type SubSheetPortalFieldsBoxProps = {
  laborJobId: string
  initialStatus: string | null
  initialPayableAfter: string | null
  initialHoldReason: string | null
}

export function SubSheetPortalFieldsBox({
  laborJobId,
  initialStatus,
  initialPayableAfter,
  initialHoldReason,
}: SubSheetPortalFieldsBoxProps) {
  const { showToast } = useToastContext()
  const [status, setStatus] = useState('')
  const [payableAfter, setPayableAfter] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(initialStatus === 'in_progress' || initialStatus === 'complete' ? initialStatus : '')
    setPayableAfter(initialPayableAfter ?? '')
    setHoldReason(initialHoldReason ?? '')
    setDirty(false)
  }, [laborJobId, initialStatus, initialPayableAfter, initialHoldReason])

  async function save() {
    setSaving(true)
    try {
      const { data, error } = (await withSupabaseRetry(
        () =>
          supabase.rpc('set_sub_sheet_portal_fields' as never, {
            p_labor_job_id: laborJobId,
            p_portal_status: status || null,
            p_payable_after: payableAfter || null,
            p_pay_hold_reason: holdReason.trim() || null,
          } as never),
        'set sub sheet portal fields',
      )) as { data: unknown; error: { message: string } | null }
      const errMsg = error?.message ?? (data as { error?: string } | null)?.error
      if (errMsg) {
        showToast(`Could not save portal fields: ${errMsg}`, 'error')
      } else {
        setDirty(false)
        showToast('Portal fields saved', 'success')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save portal fields', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.45rem 0.55rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    background: 'var(--surface)',
    color: 'var(--text-900)',
  } as const

  return (
    <div
      style={{
        marginTop: '1.25rem',
        border: '1.5px solid #93c5fd',
        borderRadius: 9,
        padding: '0.7rem 0.8rem',
        background: 'var(--bg-subtle)',
      }}
    >
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-blue-700)', letterSpacing: '0.05em' }}>
        SHOWN ON THE SUB&#8217;S PORTAL
      </div>
      <div style={{ display: 'flex', gap: '0.7rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>
            Status
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setDirty(true)
            }}
            disabled={saving}
            style={inputStyle}
          >
            <option value="">Auto (from linked step)</option>
            <option value="in_progress">In progress</option>
            <option value="complete">Work complete</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>
            Payable after
          </label>
          <input
            type="date"
            value={payableAfter}
            onChange={(e) => {
              setPayableAfter(e.target.value)
              setDirty(true)
            }}
            disabled={saving}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ marginTop: '0.6rem' }}>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>
          Why the wait (plain words — the sub reads this)
        </label>
        <input
          type="text"
          value={holdReason}
          onChange={(e) => {
            setHoldReason(e.target.value)
            setDirty(true)
          }}
          disabled={saving}
          placeholder={'e.g. Builder’s walk-through — scheduled Sep 9'}
          style={inputStyle}
        />
        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Leave blank and the portal simply shows the open balance with no promise.
        </p>
      </div>
      {dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{
              padding: '0.4rem 0.9rem',
              background: saving ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save portal fields'}
          </button>
        </div>
      )}
    </div>
  )
}

export default SubSheetPortalFieldsBox
