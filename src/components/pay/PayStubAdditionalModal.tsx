import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import {
  type PayStubAdditionalLineRow,
  type PayStubDeductionRow,
  stubNetPay,
  sumPayStubAdditionalAmounts,
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

function ledgerPeriodLabel(periodStartYmd: string, periodEndYmd: string): string {
  const md = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  return `${md(periodStartYmd)}–${md(periodEndYmd)}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function lineTotalPreview(qty: number, rate: number): number {
  return round2(qty * rate)
}

export type PayStubAdditionalModalProps = {
  stub: StubPick | null
  lines: PayStubAdditionalLineRow[]
  deductions: PayStubDeductionRow[]
  payments: PayStubPaymentRow[]
  authUserId: string | null
  onClose: () => void
  onSaved: () => void | Promise<void>
  showToast: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void
}

export function PayStubAdditionalModal({
  stub,
  lines,
  deductions,
  payments,
  authUserId,
  onClose,
  onSaved,
  showToast,
}: PayStubAdditionalModalProps) {
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [targetStr, setTargetStr] = useState('')
  const [solveLineId, setSolveLineId] = useState<string | null>(null)
  const [solveMode, setSolveMode] = useState<'rate' | 'quantity'>('rate')
  const [idealAmountStr, setIdealAmountStr] = useState('')
  const [idealBasis, setIdealBasis] = useState<'gross' | 'net'>('gross')

  const paidSum = stub ? sumPayStubPaymentAmounts(payments) : 0
  const lessSum = sumPayStubDeductionAmounts(deductions)
  const addSum = sumPayStubAdditionalAmounts(lines)
  const netPay = stub ? stubNetPay(stub.gross_pay, lessSum, addSum) : 0
  const locked = stub ? isPayStubFullyPaid(netPay, paidSum) : false

  useEffect(() => {
    if (stub && lines.length > 0 && (!solveLineId || !lines.some((l) => l.id === solveLineId))) {
      setSolveLineId(lines[0]?.id ?? null)
    }
    if (!stub || lines.length === 0) {
      setSolveLineId(null)
    }
  }, [stub, lines, solveLineId])

  const persistUpdate = useCallback(
    async (id: string, patch: { description: string; quantity: number; rate: number }) => {
      if (!stub) return
      const nextTotal = lineTotalPreview(patch.quantity, patch.rate)
      const others = sumPayStubAdditionalAmounts(lines.filter((l) => l.id !== id))
      const newAddSum = round2(others + nextTotal)
      const newNet = stubNetPay(stub.gross_pay, lessSum, newAddSum)
      if (paidSum > newNet + 0.01) {
        showToast('Reduce installments first; payments would exceed Net Pay with this line.', 'warning')
        return
      }
      setSavingRowId(id)
      try {
        await withSupabaseRetry(
          async () =>
            await supabase
              .from('pay_stub_additional_lines')
              .update({
                description: patch.description,
                quantity: patch.quantity,
                rate: patch.rate,
              })
              .eq('id', id),
          'update pay stub additional line',
        )
        showToast('Line saved.', 'success')
        await onSaved()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to save line', 'error')
      } finally {
        setSavingRowId(null)
      }
    },
    [stub, lines, lessSum, paidSum, showToast, onSaved],
  )

  async function addLine(opts?: { quantity?: number; description?: string; rate?: number }) {
    if (!stub || !authUserId) {
      showToast(!authUserId ? 'You must be signed in.' : 'No stub.', 'error')
      return
    }
    const q = opts?.quantity ?? 1
    const r = opts?.rate ?? 0
    const nextLine = lineTotalPreview(q, r)
    const newAddSum = round2(addSum + nextLine)
    const newNet = stubNetPay(stub.gross_pay, lessSum, newAddSum)
    if (paidSum > newNet + 0.01) {
      showToast('Reduce installments first; payments would exceed Net Pay if this line is added.', 'warning')
      return
    }
    setAdding(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('pay_stub_additional_lines').insert({
            pay_stub_id: stub.id,
            description: opts?.description ?? '',
            quantity: q,
            rate: r,
            created_by: authUserId,
          }),
        'add pay stub additional line',
      )
      showToast('Line added.', 'success')
      await onSaved()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add line', 'error')
    } finally {
      setAdding(false)
    }
  }

  async function removeLine(id: string) {
    if (!window.confirm('Remove this additional line?')) return
    setDeletingId(id)
    try {
      await withSupabaseRetry(
        async () => await supabase.from('pay_stub_additional_lines').delete().eq('id', id),
        'delete pay stub additional line',
      )
      showToast('Line removed.', 'success')
      await onSaved()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to remove', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  function applyTargetToSelectedLine() {
    if (!stub || locked) return
    const target = parseFloat(targetStr.replace(/,/g, ''))
    if (!Number.isFinite(target) || target < 0) {
      showToast('Enter a valid target total for Additional.', 'warning')
      return
    }
    const selId = solveLineId ?? lines[0]?.id
    if (!selId) {
      showToast('Add a line first, then use the solver.', 'warning')
      return
    }
    const sel = lines.find((l) => l.id === selId)
    if (!sel) return
    const othersSum = round2(
      lines.filter((l) => l.id !== selId).reduce((s, l) => s + Number(l.line_total), 0),
    )
    let remaining = round2(target - othersSum)
    if (remaining < 0) {
      showToast('Target is below the sum of other lines.', 'warning')
      return
    }
    let qty = Number(sel.quantity)
    let rate = Number(sel.rate)
    if (solveMode === 'rate') {
      if (qty <= 0) {
        showToast('Set quantity > 0 to solve for rate, or switch to solve for quantity.', 'warning')
        return
      }
      rate = round2(remaining / qty)
      let lt = lineTotalPreview(qty, rate)
      if (lt < remaining - 0.001) {
        rate = Math.round((remaining / qty) * 10000) / 10000
        lt = lineTotalPreview(qty, rate)
      }
      if (lt > remaining + 0.001) {
        rate = Math.floor((remaining / qty) * 10000) / 10000
      }
    } else {
      if (rate <= 0) {
        showToast('Set rate > 0 to solve for quantity, or switch to solve for rate.', 'warning')
        return
      }
      qty = round2(remaining / rate)
      let lt = lineTotalPreview(qty, rate)
      if (lt < remaining - 0.001) {
        qty = Math.round((remaining / rate) * 10000) / 10000
        lt = lineTotalPreview(qty, rate)
      }
      if (lt > remaining + 0.001) {
        qty = Math.floor((remaining / rate) * 10000) / 10000
      }
    }
    void persistUpdate(selId, { description: sel.description, quantity: qty, rate })
    setTargetStr('')
  }

  async function addIdealRemainder() {
    if (!stub) return
    const idealNum = parseFloat(idealAmountStr.replace(/,/g, ''))
    const basisAmount = idealBasis === 'gross' ? stub.gross_pay : netPay
    const remainder = round2(idealNum - basisAmount)
    if (!Number.isFinite(idealNum) || remainder <= 0) {
      showToast('Enter an ideal amount above the selected basis so the remainder is positive.', 'warning')
      return
    }
    setIdealAmountStr('')
    await addLine({ quantity: 1, rate: round2(remainder), description: 'Additional' })
  }

  if (!stub) return null

  const activeStub = stub
  const idealParsed = parseFloat(idealAmountStr.replace(/,/g, ''))
  const idealBasisAmount = idealBasis === 'gross' ? activeStub.gross_pay : netPay
  const idealRemainderDisplay = Number.isFinite(idealParsed) ? round2(idealParsed - idealBasisAmount) : null

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1110 }}
    >
      <div
        className="payStubAdditionalModal"
        role="dialog"
        aria-labelledby="pay-stub-additional-title"
        style={{
          background: 'white',
          padding: '1.25rem',
          borderRadius: 8,
          minWidth: 340,
          maxWidth: 900,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          margin: '1rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pay-stub-additional-title" style={{ margin: '0 0 0.35rem', fontSize: '1.2rem' }}>
          Additional — {activeStub.person_name}
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Period {ledgerPeriodLabel(activeStub.period_start, activeStub.period_end)} · Gross ${formatCurrency(activeStub.gross_pay)} · Less $
          {formatCurrency(lessSum)} · Subtotal Additional ${formatCurrency(addSum)} · Net Pay ${formatCurrency(netPay)}
        </p>
        {locked ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#059669', fontWeight: 500 }}>
            Installments fully cover Net Pay — adjust payments before changing Additional lines.
          </p>
        ) : null}

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>Lines (quantity × rate)</div>
          {lines.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>None — Net Pay follows Gross minus Less only.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: '0.8125rem' }}>
              {lines.map((row) => (
                <LineEditor
                  key={row.id}
                  row={row}
                  disabled={locked || savingRowId === row.id || deletingId === row.id}
                  onSave={(patch) => void persistUpdate(row.id, patch)}
                  onRemove={() => void removeLine(row.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            disabled={locked || adding}
            onClick={() => void addLine()}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8125rem',
              background: locked || adding ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: locked || adding ? 'not-allowed' : 'pointer',
            }}
          >
            {adding ? 'Adding…' : 'Add line'}
          </button>
        </div>

        <div className="payStubAdditionalModal__toolsRow">
          <div
            className="payStubAdditionalModal__toolPanel"
            style={{ padding: '0.75rem', background: '#faf5ff', borderRadius: 6, border: '1px solid #e9d5ff' }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Ideal amount</div>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#6b21a8' }}>
              Compare your ideal $ to <strong>Gross</strong> on this stub or to <strong>current Net Pay</strong> (after Less and Additional). Remainder adds as a flat qty × 1 line.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="radio"
                  name="payStubIdealBasis"
                  checked={idealBasis === 'gross'}
                  onChange={() => setIdealBasis('gross')}
                  disabled={locked || adding}
                />
                Gross
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="radio"
                  name="payStubIdealBasis"
                  checked={idealBasis === 'net'}
                  onChange={() => setIdealBasis('net')}
                  disabled={locked || adding}
                />
                Current Net Pay
              </label>
            </div>
            <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
              Ideal $
              <input
                type="text"
                inputMode="decimal"
                value={idealAmountStr}
                onChange={(e) => setIdealAmountStr(e.target.value)}
                disabled={locked || adding}
                style={{ display: 'block', marginTop: '0.2rem', padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', maxWidth: 140, boxSizing: 'border-box' }}
              />
            </label>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#374151' }}>
              Remainder:{' '}
              {idealRemainderDisplay === null ? (
                <span style={{ color: '#9ca3af' }}>—</span>
              ) : (
                <strong>${formatCurrency(idealRemainderDisplay)}</strong>
              )}
            </p>
            <button
              type="button"
              disabled={locked || adding || idealRemainderDisplay === null || idealRemainderDisplay <= 0}
              onClick={() => void addIdealRemainder()}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8125rem',
                background:
                  locked || adding || idealRemainderDisplay === null || idealRemainderDisplay <= 0 ? '#9ca3af' : '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor:
                  locked || adding || idealRemainderDisplay === null || idealRemainderDisplay <= 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Add remainder as flat line
            </button>
          </div>

          <div
            className="payStubAdditionalModal__toolPanel"
            style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Target total Additional</div>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#166534' }}>
              Sets the selected line&apos;s quantity or rate so the Additional subtotal matches the target (nearest cent per line).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.8125rem' }}>
                Target $
                <input
                  type="text"
                  inputMode="decimal"
                  value={targetStr}
                  onChange={(e) => setTargetStr(e.target.value)}
                  disabled={locked || lines.length === 0}
                  style={{ display: 'block', marginTop: '0.2rem', padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: 120 }}
                />
              </label>
              <label style={{ fontSize: '0.8125rem' }}>
                Line
                <select
                  value={solveLineId ?? ''}
                  onChange={(e) => setSolveLineId(e.target.value || null)}
                  disabled={locked || lines.length === 0}
                  style={{ display: 'block', marginTop: '0.2rem', padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 160 }}
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.description.trim() || 'Line'} (${formatCurrency(l.line_total)})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <input type="radio" name="solveMode" checked={solveMode === 'rate'} onChange={() => setSolveMode('rate')} disabled={locked} />
                Solve for rate
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <input type="radio" name="solveMode" checked={solveMode === 'quantity'} onChange={() => setSolveMode('quantity')} disabled={locked} />
                Solve for quantity
              </label>
            </div>
            <button
              type="button"
              disabled={locked || lines.length === 0}
              onClick={() => applyTargetToSelectedLine()}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8125rem',
                background: locked || lines.length === 0 ? '#9ca3af' : '#059669',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: locked || lines.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Apply target to line
            </button>
          </div>
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

type LineEditorProps = {
  row: PayStubAdditionalLineRow
  disabled: boolean
  onSave: (patch: { description: string; quantity: number; rate: number }) => void
  onRemove: () => void
}

function LineEditor({ row, disabled, onSave, onRemove }: LineEditorProps) {
  const [desc, setDesc] = useState(row.description)
  const [qtyStr, setQtyStr] = useState(String(row.quantity))
  const [rateStr, setRateStr] = useState(String(row.rate))

  useEffect(() => {
    setDesc(row.description)
    setQtyStr(String(row.quantity))
    setRateStr(String(row.rate))
  }, [row.id, row.description, row.quantity, row.rate])

  const preview = lineTotalPreview(parseFloat(qtyStr.replace(/,/g, '')) || 0, parseFloat(rateStr.replace(/,/g, '')) || 0)

  function commit() {
    const q = parseFloat(qtyStr.replace(/,/g, ''))
    const r = parseFloat(rateStr.replace(/,/g, ''))
    if (!Number.isFinite(q) || q < 0 || !Number.isFinite(r) || r < 0) return
    if (desc.trim() === row.description && q === Number(row.quantity) && r === Number(row.rate)) return
    onSave({ description: desc.trim(), quantity: q, rate: r })
  }

  return (
    <li
      style={{
        marginBottom: '0.75rem',
        padding: '0.5rem',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        background: '#fafafa',
      }}
    >
      <div style={{ display: 'grid', gap: '0.35rem', gridTemplateColumns: '1fr 80px 90px', alignItems: 'end' }}>
        <label style={{ fontSize: '0.75rem', color: '#374151' }}>
          Description
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => commit()}
            disabled={disabled}
            style={{ display: 'block', width: '100%', marginTop: '0.15rem', padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.8125rem' }}
          />
        </label>
        <label style={{ fontSize: '0.75rem', color: '#374151' }}>
          Qty
          <input
            type="text"
            inputMode="decimal"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            onBlur={() => commit()}
            disabled={disabled}
            style={{ display: 'block', width: '100%', marginTop: '0.15rem', padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ fontSize: '0.75rem', color: '#374151' }}>
          Rate
          <input
            type="text"
            inputMode="decimal"
            value={rateStr}
            onChange={(e) => setRateStr(e.target.value)}
            onBlur={() => commit()}
            disabled={disabled}
            style={{ display: 'block', width: '100%', marginTop: '0.15rem', padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.8125rem' }}
          />
        </label>
      </div>
      <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
          Line: ${formatCurrency(preview)} (saved ${formatCurrency(row.line_total)})
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          style={{
            padding: '2px 8px',
            fontSize: '0.75rem',
            border: '1px solid #fecaca',
            background: 'white',
            color: '#dc2626',
            borderRadius: 4,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Remove
        </button>
      </div>
    </li>
  )
}
