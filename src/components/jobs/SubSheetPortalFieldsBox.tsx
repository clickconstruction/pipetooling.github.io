import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import {
  SUB_SHEET_STAGES,
  SUB_SHEET_STAGE_HINT,
  SUB_SHEET_STAGE_LABEL,
  normalizeSubSheetStage,
  normalizeSubSheetStageSource,
  subSheetStageStamp,
  type SubSheetStage,
} from '../../lib/subSheetStage'
import type { SetSubSheetStageResult, SubPortalOfficeWriteResult } from '../../types/database-functions'

/**
 * "Shown on the sub's portal" box — the stage the sheet is at (v2.2767:
 * working → walkthrough → customer_pay, either direction), the payable-after
 * date, and the plain-words hold reason the sub reads verbatim. Self-
 * contained: the stage saves through set_sub_sheet_stage and the two pay
 * fields through set_sub_sheet_portal_fields (both office-gated), so the
 * 2.5k-line form modal only mounts it.
 */

export type SubSheetPortalFieldsBoxProps = {
  laborJobId: string
  contractorName: string | null
  initialStage: string | null
  initialStageChangedAt: string | null
  initialStageSource: string | null
  initialStageNote: string | null
  initialStageChangedByName: string | null
  initialPayableAfter: string | null
  initialHoldReason: string | null
  /** Lets the parent patch its row after a save (the ledger chip reads it). */
  onStageSaved?: (stage: SubSheetStage) => void
}

export function SubSheetPortalFieldsBox({
  laborJobId,
  contractorName,
  initialStage,
  initialStageChangedAt,
  initialStageSource,
  initialStageNote,
  initialStageChangedByName,
  initialPayableAfter,
  initialHoldReason,
  onStageSaved,
}: SubSheetPortalFieldsBoxProps) {
  const { showToast } = useToastContext()
  const [stage, setStage] = useState<SubSheetStage>('working')
  const [savedStage, setSavedStage] = useState<SubSheetStage>('working')
  const [payableAfter, setPayableAfter] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = normalizeSubSheetStage(initialStage)
    setStage(s)
    setSavedStage(s)
    setPayableAfter(initialPayableAfter ?? '')
    setHoldReason(initialHoldReason ?? '')
    setDirty(false)
  }, [laborJobId, initialStage, initialPayableAfter, initialHoldReason])

  const stamp = subSheetStageStamp({
    source: normalizeSubSheetStageSource(initialStageSource),
    changedAt: initialStageChangedAt,
    changedByName: initialStageChangedByName,
    contractorName,
  })

  async function save() {
    setSaving(true)
    try {
      if (stage !== savedStage) {
        const { data, error } = (await withSupabaseRetry(
          () =>
            supabase.rpc('set_sub_sheet_stage' as never, {
              p_labor_job_id: laborJobId,
              p_stage: stage,
              p_note: null,
            } as never),
          'set sub sheet stage',
        )) as { data: unknown; error: { message: string } | null }
        const errMsg = error?.message ?? (data as SetSubSheetStageResult | null)?.error
        if (errMsg) {
          showToast(`Could not move the stage: ${errMsg}`, 'error')
          return
        }
        setSavedStage(stage)
        onStageSaved?.(stage)
      }
      const { data, error } = (await withSupabaseRetry(
        () =>
          supabase.rpc('set_sub_sheet_portal_fields' as never, {
            p_labor_job_id: laborJobId,
            p_portal_status: null,
            p_payable_after: payableAfter || null,
            p_pay_hold_reason: holdReason.trim() || null,
          } as never),
        'set sub sheet portal fields',
      )) as { data: unknown; error: { message: string } | null }
      const errMsg = error?.message ?? (data as SubPortalOfficeWriteResult | null)?.error
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
      <div style={{ marginTop: '0.6rem' }}>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>
          Stage
        </label>
        <div role="radiogroup" aria-label="Sheet stage" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden', flexWrap: 'wrap' }}>
          {SUB_SHEET_STAGES.map((s, i) => {
            const on = stage === s
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                title={SUB_SHEET_STAGE_HINT[s]}
                disabled={saving}
                onClick={() => {
                  setStage(s)
                  setDirty(true)
                }}
                style={{
                  padding: '0.4rem 0.7rem',
                  fontSize: '0.8rem',
                  fontWeight: on ? 700 : 500,
                  border: 'none',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--border-strong)',
                  background: on ? 'var(--bg-violet-100)' : 'var(--surface)',
                  color: on ? 'var(--text-violet-700)' : 'var(--text-700)',
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {SUB_SHEET_STAGE_LABEL[s]}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {stamp ? (
            <>
              Last moved by {stamp}
              {initialStageNote ? <> · &#8220;{initialStageNote}&#8221;</> : null}
            </>
          ) : (
            'Paid sets itself when the balance hits $0. Every move writes a line on the job’s Activity feed.'
          )}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.7rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
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
          Leave blank and the stage sentence speaks for itself.
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
