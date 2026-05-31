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
import {
  buildPrevailingWageHumanPart,
  existingLineForSession,
  stripPrevailingWageTag,
} from '../../lib/payStubPrevailingWageLine'
import { CLOCK_SESSION_CALENDAR_SELECT } from '../../lib/clockSessionSelect'
import { shortJobOrBidLabelFromEmbeds, type ClockSessionRow } from '../../types/clockSessions'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'

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

function PrevailingWagesMyTimeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} aria-hidden style={{ display: 'block' }}>
      <path
        fill="currentColor"
        d="M568.4 196.5C563.9 207 550 206.3 543.5 196.9C515.7 156.9 477.4 124.7 432.5 104.3C422.1 99.6 418.8 86 428.4 79.7C443.4 69.8 461.4 64 480.7 64C533.3 64 575.9 106.6 575.9 159.2C575.9 172.4 573.2 185 568.3 196.5zM96.5 196.9C90 206.3 76 207 71.6 196.5C66.7 185 64 172.4 64 159.2C64 106.6 106.6 64 159.2 64C178.5 64 196.5 69.8 211.5 79.7C221.1 86 217.8 99.6 207.4 104.3C162.6 124.7 124.3 156.9 96.4 196.9zM454.2 531.4C416.8 559.4 370.3 576 320 576C269.7 576 223.2 559.4 185.9 531.4L150.6 566.6C138.1 579.1 117.8 579.1 105.3 566.6C92.8 554.1 92.8 533.8 105.3 521.3L140.5 486.1C112.6 448.8 96 402.3 96 352C96 228.3 196.3 128 320 128C443.7 128 544 228.3 544 352C544 402.3 527.4 448.8 499.4 486.2L534.6 521.4C547.1 533.9 547.1 554.2 534.6 566.7C522.1 579.2 501.8 579.2 489.3 566.7L454.1 531.5zM344 248C344 234.7 333.3 224 320 224C306.7 224 296 234.7 296 248L296 352C296 358.4 298.5 364.5 303 369L359 425C368.4 434.4 383.6 434.4 392.9 425C402.2 415.6 402.3 400.4 392.9 391.1L343.9 342.1L343.9 248z"
      />
    </svg>
  )
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
  /** Resolved from People roster: required to load clock sessions for prevailing wages. */
  subjectUserId?: string | null
  /** From `people_pay_config.hourly_wage` for stub person (Option A base rate). */
  baseHourlyWage?: number
  /** Opens Dashboard My Time for the session work date (e.g. from People page). */
  onOpenMyTimeForDay?: (args: { dateStr: string; subjectUserId: string; subjectDisplayName: string }) => void
}

type PrevailingSessionRow = Pick<
  ClockSessionRow,
  | 'id'
  | 'work_date'
  | 'clocked_in_at'
  | 'clocked_out_at'
  | 'approved_at'
  | 'notes'
  | 'job_ledger_id'
  | 'bid_id'
  | 'jobs_ledger'
  | 'bids'
>

export function PayStubAdditionalModal({
  stub,
  lines,
  deductions,
  payments,
  authUserId,
  onClose,
  onSaved,
  showToast,
  subjectUserId = null,
  baseHourlyWage = 0,
  onOpenMyTimeForDay,
}: PayStubAdditionalModalProps) {
  const prefixMap = useLedgerPrefixMap()
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [targetStr, setTargetStr] = useState('')
  const [solveLineId, setSolveLineId] = useState<string | null>(null)
  const [solveMode, setSolveMode] = useState<'rate' | 'quantity'>('rate')
  const [idealAmountStr, setIdealAmountStr] = useState('')
  const [idealBasis, setIdealBasis] = useState<'gross' | 'net'>('gross')
  const [prevailingWageStr, setPrevailingWageStr] = useState('')
  const [pwSessions, setPwSessions] = useState<PrevailingSessionRow[]>([])
  const [pwSessionsLoading, setPwSessionsLoading] = useState(false)
  const [pwAddingSessionId, setPwAddingSessionId] = useState<string | null>(null)

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

  useEffect(() => {
    setPrevailingWageStr('')
  }, [stub?.id])

  useEffect(() => {
    let cancelled = false
    async function loadPwSessions() {
      if (!stub || !subjectUserId?.trim()) {
        setPwSessions([])
        setPwSessionsLoading(false)
        return
      }
      setPwSessionsLoading(true)
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase
              .from('clock_sessions')
              .select(CLOCK_SESSION_CALENDAR_SELECT)
              .eq('user_id', subjectUserId.trim())
              .gte('work_date', stub.period_start)
              .lte('work_date', stub.period_end)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .order('work_date', { ascending: true })
              .order('clocked_in_at', { ascending: true }),
          'load clock sessions for prevailing wages',
        )
        if (!cancelled) setPwSessions((data ?? []) as PrevailingSessionRow[])
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Failed to load clock sessions', 'error')
          setPwSessions([])
        }
      } finally {
        if (!cancelled) setPwSessionsLoading(false)
      }
    }
    void loadPwSessions()
    return () => {
      cancelled = true
    }
  }, [stub?.id, stub?.period_start, stub?.period_end, subjectUserId, showToast])

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

  async function addLine(opts?: {
    quantity?: number
    description?: string
    rate?: number
    source_clock_session_id?: string | null
  }) {
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
            ...(opts?.source_clock_session_id ? { source_clock_session_id: opts.source_clock_session_id } : {}),
          }),
        'add pay stub additional line',
      )
      showToast('Line added.', 'success')
      await onSaved()
    } catch (e: unknown) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : ''
      if (code === '23505') {
        showToast('Already added for this session.', 'warning')
      } else {
        showToast(e instanceof Error ? e.message : 'Failed to add line', 'error')
      }
    } finally {
      setAdding(false)
    }
  }

  async function addOrReplacePrevailingLine(session: PrevailingSessionRow) {
    if (!stub || locked || !authUserId) return
    if (!session.clocked_out_at) {
      showToast('Session is still open.', 'warning')
      return
    }
    const prevailing = parseFloat(prevailingWageStr.replace(/,/g, ''))
    if (!Number.isFinite(prevailing) || prevailing < 0) {
      showToast('Enter a valid prevailing wage ($/hr).', 'warning')
      return
    }
    const base = Number(baseHourlyWage)
    const delta = round2(prevailing - base)
    if (delta <= 0) {
      showToast('Prevailing wage must be above base hourly rate.', 'warning')
      return
    }
    const hours = round2(
      (new Date(session.clocked_out_at).getTime() - new Date(session.clocked_in_at).getTime()) / 3_600_000,
    )
    if (!Number.isFinite(hours) || hours <= 0) {
      showToast('Invalid session duration.', 'warning')
      return
    }
    const humanPart = buildPrevailingWageHumanPart({
      workDateYmd: session.work_date,
      prevailingRate: prevailing,
      baseRate: base,
    })
    const description = humanPart
    const existing = existingLineForSession(lines, session.id)
    if (existing) {
      if (!window.confirm('Replace existing prevailing line for this session?')) return
      await persistUpdate(existing.id, { description, quantity: hours, rate: delta })
      return
    }
    const nextLine = lineTotalPreview(hours, delta)
    const newAddSum = round2(addSum + nextLine)
    const newNet = stubNetPay(stub.gross_pay, lessSum, newAddSum)
    if (paidSum > newNet + 0.01) {
      showToast('Reduce installments first; payments would exceed Net Pay if this line is added.', 'warning')
      return
    }
    setPwAddingSessionId(session.id)
    try {
      await addLine({
        quantity: hours,
        rate: delta,
        description,
        source_clock_session_id: session.id,
      })
    } finally {
      setPwAddingSessionId(null)
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
    const remaining = round2(target - othersSum)
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
    void persistUpdate(selId, { description: stripPrevailingWageTag(sel.description), quantity: qty, rate })
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
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Add line to hit Ideal Total</div>
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
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Change Line to hit Target</div>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#166534' }}>
              Sets the selected line&apos;s quantity or rate so the Additional subtotal matches the target (nearest cent per line).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
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
                      {stripPrevailingWageTag(l.description) || 'Line'} (${formatCurrency(l.line_total)})
                    </option>
                  ))}
                </select>
              </label>
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
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <input type="radio" name="solveMode" checked={solveMode === 'quantity'} onChange={() => setSolveMode('quantity')} disabled={locked} />
                Solve for quantity
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <input type="radio" name="solveMode" checked={solveMode === 'rate'} onChange={() => setSolveMode('rate')} disabled={locked} />
                Solve for rate
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

        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#fffbeb',
            borderRadius: 6,
            border: '1px solid #fcd34d',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>Prevailing Wages</div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#92400e' }}>
            Stub period {ledgerPeriodLabel(activeStub.period_start, activeStub.period_end)}. Base rate uses pay config hourly wage (
            {`$${formatCurrency(baseHourlyWage)}/hr`}). Add creates an Additional line: hours × (prevailing − base). Sessions exclude rejected/revoked; pending
            approval is labeled.
          </p>
          {baseHourlyWage <= 0 ? (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>
              Base hourly rate is $0 — set hourly wage in People pay config (Hours tab) before using prevailing top-ups.
            </p>
          ) : null}
          {!subjectUserId?.trim() ? (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
              No user linked to this person name — clock sessions are not loaded. Match roster name to a user account.
            </p>
          ) : null}
          <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.5rem', maxWidth: 200 }}>
            Prevailing wage $/hr
            <input
              type="text"
              inputMode="decimal"
              value={prevailingWageStr}
              onChange={(e) => setPrevailingWageStr(e.target.value)}
              disabled={locked}
              style={{
                display: 'block',
                marginTop: '0.2rem',
                padding: '0.35rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>
          {pwSessionsLoading ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>Loading sessions…</p>
          ) : pwSessions.length === 0 && subjectUserId?.trim() ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>No clock sessions in this period.</p>
          ) : pwSessions.length > 0 ? (
            <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#fef3c7', borderBottom: '1px solid #fcd34d' }}>
                    <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Date & time</th>
                    <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Job & notes</th>
                    <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Hrs & base</th>
                    <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>At base</th>
                    <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Add</th>
                  </tr>
                </thead>
                <tbody>
                  {pwSessions.map((s) => {
                    const closed = Boolean(s.clocked_out_at)
                    const hrs = closed
                      ? round2(
                          (new Date(s.clocked_out_at!).getTime() - new Date(s.clocked_in_at).getTime()) / 3_600_000,
                        )
                      : 0
                    const base = Number(baseHourlyWage)
                    const atBase = closed ? round2(hrs * base) : 0
                    const t0 = new Date(s.clocked_in_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                    const t1 = s.clocked_out_at
                      ? new Date(s.clocked_out_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                      : '—'
                    const weekdayShort = new Date(s.work_date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      timeZone: APP_CALENDAR_TZ,
                    })
                    const dateLine = `${s.work_date} (${weekdayShort})`
                    const prevailingNum = parseFloat(prevailingWageStr.replace(/,/g, ''))
                    const delta =
                      Number.isFinite(prevailingNum) && baseHourlyWage > 0 ? round2(prevailingNum - base) : null
                    const canAdd =
                      !locked &&
                      closed &&
                      delta !== null &&
                      delta > 0 &&
                      hrs > 0 &&
                      Boolean(subjectUserId?.trim()) &&
                      pwAddingSessionId === null &&
                      !adding
                    const hasLine = Boolean(existingLineForSession(lines, s.id))
                    const jobLine =
                      shortJobOrBidLabelFromEmbeds(
                        {
                          jobs_ledger: s.jobs_ledger ?? null,
                          bids: s.bids ?? null,
                        },
                        prefixMap,
                      ) ?? '—'
                    const notesTrim = (s.notes ?? '').trim()
                    const notesLine = notesTrim.length > 0 ? notesTrim : '—'
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #fde68a' }}>
                        <td style={{ padding: '0.35rem 0.5rem', verticalAlign: 'top' }}>
                          <div style={{ lineHeight: 1.35 }}>{dateLine}</div>
                          <div style={{ whiteSpace: 'nowrap', fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.35 }}>
                            {t0}–{t1}
                          </div>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', verticalAlign: 'top', maxWidth: 280 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                            {onOpenMyTimeForDay && subjectUserId?.trim() ? (
                              <button
                                type="button"
                                aria-label={`Open My Time for ${s.work_date}`}
                                title="Open My Time for this day"
                                onClick={() =>
                                  onOpenMyTimeForDay({
                                    dateStr: s.work_date,
                                    subjectUserId: subjectUserId.trim(),
                                    subjectDisplayName: activeStub.person_name,
                                  })
                                }
                                style={{
                                  flexShrink: 0,
                                  marginTop: 1,
                                  padding: 2,
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  color: '#d97706',
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <PrevailingWagesMyTimeIcon />
                              </button>
                            ) : (
                              <span
                                style={{
                                  flexShrink: 0,
                                  width: 22,
                                  display: 'inline-flex',
                                  justifyContent: 'center',
                                  alignItems: 'flex-start',
                                  paddingTop: 2,
                                  color: '#9ca3af',
                                  fontSize: '0.7rem',
                                }}
                              >
                                —
                              </span>
                            )}
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              <div style={{ lineHeight: 1.35 }}>{jobLine}</div>
                              <div style={{ lineHeight: 1.35, fontSize: '0.7rem', color: '#6b7280' }}>{notesLine}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', verticalAlign: 'top' }}>
                          <div style={{ lineHeight: 1.35 }}>{closed ? hrs.toFixed(2) : '—'}</div>
                          <div style={{ lineHeight: 1.35, fontSize: '0.7rem', color: '#6b7280' }}>
                            ${formatCurrency(base)}
                          </div>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{closed ? `$${formatCurrency(atBase)}` : '—'}</td>
                        <td style={{ padding: '0.35rem 0.5rem' }}>
                          {s.approved_at ? (
                            <span style={{ color: '#059669' }}>Approved</span>
                          ) : (
                            <span style={{ color: '#ca8a04' }}>Pending</span>
                          )}
                          {hasLine ? <span style={{ marginLeft: 6, color: '#2563eb' }}>· Line</span> : null}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            disabled={!canAdd}
                            title={
                              !closed
                                ? 'Session open'
                                : delta !== null && delta <= 0
                                  ? 'Prevailing must exceed base rate'
                                  : hasLine
                                    ? 'Replace existing line (click to confirm)'
                                    : 'Add top-up line'
                            }
                            onClick={() => void addOrReplacePrevailingLine(s)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.7rem',
                              background: canAdd ? '#d97706' : '#9ca3af',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: canAdd ? 'pointer' : 'not-allowed',
                            }}
                          >
                            {pwAddingSessionId === s.id ? '…' : hasLine ? 'Replace' : 'Add'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
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
  const [desc, setDesc] = useState(() => stripPrevailingWageTag(row.description))
  const [qtyStr, setQtyStr] = useState(String(row.quantity))
  const [rateStr, setRateStr] = useState(String(row.rate))

  useEffect(() => {
    setDesc(stripPrevailingWageTag(row.description))
    setQtyStr(String(row.quantity))
    setRateStr(String(row.rate))
  }, [row.id, row.description, row.quantity, row.rate])

  const preview = lineTotalPreview(parseFloat(qtyStr.replace(/,/g, '')) || 0, parseFloat(rateStr.replace(/,/g, '')) || 0)

  function commit() {
    const q = parseFloat(qtyStr.replace(/,/g, ''))
    const r = parseFloat(rateStr.replace(/,/g, ''))
    if (!Number.isFinite(q) || q < 0 || !Number.isFinite(r) || r < 0) return
    const rowDescNorm = stripPrevailingWageTag(row.description)
    if (desc.trim() === rowDescNorm && q === Number(row.quantity) && r === Number(row.rate)) return
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
