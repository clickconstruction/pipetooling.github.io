import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import {
  type PayStubDeductionRow,
  stubNetPay,
  sumPayStubDeductionAmounts,
} from '../../lib/payStubDeductions'
import { isPayStubFullyPaid, sumPayStubPaymentAmounts, type PayStubPaymentRow } from '../../lib/payStubPayments'
import { withSupabaseRetry } from '../../utils/errorHandling'

type StubPick = {
  id: string
  person_name: string
  period_start: string
  period_end: string
  gross_pay: number
}

type PendingOffsetRow = {
  id: string
  person_name: string
  type: string
  amount: number
  description: string | null
  occurred_date: string
}

function offsetSnapshotDescription(type: string, description: string | null): string {
  const label =
    type === 'backcharge' ? 'Backcharge' : type === 'damage' ? 'Damage' : type === 'employee_credit' ? 'Employee credit' : 'Offset'
  const d = description?.trim()
  return d ? `${label}: ${d}` : label
}

function ledgerPeriodLabel(periodStartYmd: string, periodEndYmd: string): string {
  const md = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  return `${md(periodStartYmd)}–${md(periodEndYmd)}`
}

export type PayStubLessModalProps = {
  stub: StubPick | null
  deductions: PayStubDeductionRow[]
  /** Sum of Additional lines on this stub (for Net Pay and installment lock). */
  additionalSum?: number
  payments: PayStubPaymentRow[]
  authUserId: string | null
  onClose: () => void
  onSaved: () => void | Promise<void>
  showToast: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void
}

export function PayStubLessModal({
  stub,
  deductions,
  additionalSum = 0,
  payments,
  authUserId,
  onClose,
  onSaved,
  showToast,
}: PayStubLessModalProps) {
  const [pendingOffsets, setPendingOffsets] = useState<PendingOffsetRow[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [manualAmount, setManualAmount] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [attachingOffsetId, setAttachingOffsetId] = useState<string | null>(null)
  const [deletingDeductionId, setDeletingDeductionId] = useState<string | null>(null)

  const paidSum = stub ? sumPayStubPaymentAmounts(payments) : 0
  const dedSum = sumPayStubDeductionAmounts(deductions)
  const netPay = stub ? stubNetPay(stub.gross_pay, dedSum, additionalSum) : 0
  /** When installments fully cover Net Pay, lock Less edits (see Pay History plan). */
  const deductionsLocked = stub ? isPayStubFullyPaid(netPay, paidSum) : false

  const loadPending = useCallback(async () => {
    if (!stub) return
    setPendingLoading(true)
    try {
      const { data, error } = await supabase
        .from('person_offsets')
        .select('id, person_name, type, amount, description, occurred_date')
        .eq('person_name', stub.person_name.trim())
        .is('pay_stub_id', null)
        .order('occurred_date', { ascending: false })
      if (error) throw new Error(error.message)
      setPendingOffsets((data ?? []) as PendingOffsetRow[])
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load pending offsets', 'error')
      setPendingOffsets([])
    } finally {
      setPendingLoading(false)
    }
  }, [stub, showToast])

  useEffect(() => {
    if (!stub) {
      setPendingOffsets([])
      setManualAmount('')
      setManualDescription('')
      return
    }
    void loadPending()
  }, [stub, loadPending])

  if (!stub) return null

  const activeStub = stub

  async function addManual() {
    const amtRaw = manualAmount.trim().replace(/,/g, '')
    const amount = parseFloat(amtRaw)
    const desc = manualDescription.trim()
    if (!authUserId) {
      showToast('You must be signed in.', 'error')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid amount greater than zero.', 'warning')
      return
    }
    if (!desc) {
      showToast('Enter a description for this charge.', 'warning')
      return
    }
    const newDedTotal = dedSum + amount
    const newNet = stubNetPay(activeStub.gross_pay, newDedTotal, additionalSum)
    if (newNet < -0.01) {
      showToast('Total Less cannot exceed Gross Pay.', 'warning')
      return
    }
    if (paidSum > newNet + 0.01) {
      showToast('Reduce installments first; payments exceed Net Pay if this charge is added.', 'warning')
      return
    }
    setSavingManual(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('pay_stub_deductions').insert({
            pay_stub_id: activeStub.id,
            amount,
            source: 'manual',
            description: desc,
            created_by: authUserId,
          }),
        'add pay stub deduction',
      )
      setManualAmount('')
      setManualDescription('')
      showToast('Charge added.', 'success')
      await onSaved()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add charge', 'error')
    } finally {
      setSavingManual(false)
    }
  }

  async function attachOffset(row: PendingOffsetRow) {
    if (row.type === 'employee_credit') {
      showToast('Employee credit cannot be applied from Less (use Offsets or a future flow to add to Net Pay).', 'warning')
      return
    }
    if (!authUserId) {
      showToast('You must be signed in.', 'error')
      return
    }
    const newDedTotal = dedSum + row.amount
    const newNet = stubNetPay(activeStub.gross_pay, newDedTotal, additionalSum)
    if (newNet < -0.01) {
      showToast('Total Less cannot exceed Gross Pay.', 'warning')
      return
    }
    if (paidSum > newNet + 0.01) {
      showToast('Reduce installments first; payments exceed Net Pay if this offset is applied.', 'warning')
      return
    }
    setAttachingOffsetId(row.id)
    const description = offsetSnapshotDescription(row.type, row.description)
    try {
      const { data: insData, error: insErr } = await supabase
        .from('pay_stub_deductions')
        .insert({
          pay_stub_id: activeStub.id,
          amount: row.amount,
          source: 'offset',
          person_offset_id: row.id,
          description,
          created_by: authUserId,
        })
        .select('id')
        .single()
      if (insErr) throw new Error(insErr.message)
      const deductionId = (insData as { id: string }).id
      const { error: offErr } = await supabase.from('person_offsets').update({ pay_stub_id: activeStub.id }).eq('id', row.id)
      if (offErr) {
        await supabase.from('pay_stub_deductions').delete().eq('id', deductionId)
        throw new Error(offErr.message)
      }
      showToast('Offset applied to this pay report.', 'success')
      await onSaved()
      void loadPending()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to attach offset', 'error')
    } finally {
      setAttachingOffsetId(null)
    }
  }

  async function removeDeduction(row: PayStubDeductionRow) {
    if (!window.confirm('Remove this charge from this pay report?')) return
    setDeletingDeductionId(row.id)
    try {
      const { error: delErr } = await supabase.from('pay_stub_deductions').delete().eq('id', row.id)
      if (delErr) throw new Error(delErr.message)
      if (row.person_offset_id) {
        const { error: unErr } = await supabase
          .from('person_offsets')
          .update({ pay_stub_id: null })
          .eq('id', row.person_offset_id)
        if (unErr) throw new Error(unErr.message)
      }
      showToast('Charge removed.', 'success')
      await onSaved()
      void loadPending()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to remove charge', 'error')
    } finally {
      setDeletingDeductionId(null)
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1110 }}
    >
      <div
        role="dialog"
        aria-labelledby="pay-stub-less-title"
        style={{
          background: 'white',
          padding: '1.25rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 520,
          width: '100%',
          maxHeight: '88vh',
          overflow: 'auto',
          margin: '1rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pay-stub-less-title" style={{ margin: '0 0 0.35rem', fontSize: '1.2rem' }}>
          Less — {activeStub.person_name}
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Period {ledgerPeriodLabel(activeStub.period_start, activeStub.period_end)} · Gross ${formatCurrency(activeStub.gross_pay)} · Net Pay $
          {formatCurrency(netPay)}
        </p>
        {deductionsLocked ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#059669', fontWeight: 500 }}>
            Installments fully cover Net Pay — add or remove charges only after adjusting payments.
          </p>
        ) : null}

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>Charges on this report</div>
          {deductions.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>None — totals reflect Gross only.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.875rem' }}>
              {deductions.map((d) => (
                <li key={d.id} style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 500 }}>${formatCurrency(d.amount)}</span>
                  {' · '}
                  <span style={{ color: '#6b7280' }}>{d.source === 'offset' ? 'Offset' : 'Manual'}</span>
                  {' — '}
                  {d.description}
                  <button
                    type="button"
                    disabled={deductionsLocked || deletingDeductionId === d.id}
                    onClick={() => void removeDeduction(d)}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '1px 6px',
                      fontSize: '0.75rem',
                      border: '1px solid #fecaca',
                      background: 'white',
                      color: '#dc2626',
                      borderRadius: 4,
                      cursor: deductionsLocked || deletingDeductionId === d.id ? 'not-allowed' : 'pointer',
                      opacity: deductionsLocked ? 0.5 : 1,
                    }}
                  >
                    {deletingDeductionId === d.id ? '…' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Add manual charge</div>
          <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem' }}>
            Amount ($)
            <input
              type="text"
              inputMode="decimal"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              disabled={deductionsLocked || savingManual}
              style={{ display: 'block', marginTop: '0.2rem', padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', maxWidth: 160 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
            Description
            <input
              type="text"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              disabled={deductionsLocked || savingManual}
              placeholder="Reason for deduction"
              style={{ display: 'block', marginTop: '0.2rem', padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%' }}
            />
          </label>
          <button
            type="button"
            disabled={deductionsLocked || savingManual}
            onClick={() => void addManual()}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8125rem',
              background: deductionsLocked || savingManual ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: deductionsLocked || savingManual ? 'not-allowed' : 'pointer',
            }}
          >
            {savingManual ? 'Saving…' : 'Add'}
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>Apply pending offset</div>
          {pendingLoading ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Loading…</p>
          ) : pendingOffsets.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No pending offsets for this person.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8125rem' }}>
              {pendingOffsets.map((o) => {
                const typeLabel =
                  o.type === 'backcharge' ? 'Backcharge' : o.type === 'damage' ? 'Damage' : o.type === 'employee_credit' ? 'Employee credit' : o.type
                const creditBlocked = o.type === 'employee_credit'
                return (
                <li key={o.id} style={{ marginBottom: '0.45rem' }}>
                  ${formatCurrency(o.amount)} · {typeLabel}
                  {o.description?.trim() ? ` — ${o.description.trim()}` : ''}
                  <button
                    type="button"
                    disabled={deductionsLocked || attachingOffsetId !== null || creditBlocked}
                    title={creditBlocked ? 'Applying employee credit to Net Pay is not wired from here yet.' : undefined}
                    onClick={() => void attachOffset(o)}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '1px 8px',
                      fontSize: '0.75rem',
                      background:
                        deductionsLocked || attachingOffsetId !== null || creditBlocked ? '#9ca3af' : '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor:
                        deductionsLocked || attachingOffsetId !== null || creditBlocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {attachingOffsetId === o.id ? '…' : 'Apply'}
                  </button>
                </li>
              )})}
            </ul>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
