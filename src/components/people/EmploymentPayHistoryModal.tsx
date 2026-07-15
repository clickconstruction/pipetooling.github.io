import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'
import type { PayStubRow } from './PeoplePayStubsTab'

/** Below People.tsx's Z_PEOPLE_PAY_MODAL (1100) so the pay-report view stacks above this modal. */
const MODAL_Z = 1090
const TITLE_ID = 'employment-pay-history-title'
const WINDOW_STEP_DAYS = 90

type PaymentRow = {
  id: string
  paid_at: string
  amount: number
  memo: string | null
  stub: PayStubRow
}

function ymdDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatPaidDate(s: string): string {
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s)
  if (Number.isNaN(d.getTime())) return s
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

function periodShortLabel(startYmd: string, endYmd: string): string {
  const s = new Date(startYmd + 'T12:00:00')
  const e = new Date(endYmd + 'T12:00:00')
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${startYmd} – ${endYmd}`
  const sm = s.getMonth() + 1
  const em = e.getMonth() + 1
  return sm === em ? `${sm}/${s.getDate()}–${e.getDate()}` : `${sm}/${s.getDate()}–${em}/${e.getDate()}`
}

export type EmploymentPayHistoryModalProps = {
  personName: string
  onClose: () => void
  /** Opens the stub's full pay-report view (stacks above this modal at Z_PEOPLE_PAY_MODAL). */
  onOpenPayReport: (stub: PayStubRow) => void
}

/**
 * Payment installments (`pay_stub_payments`) for one person, newest first, over a rolling
 * window that starts at 90 days and extends 90 days per click of the button at the list's end.
 */
export function EmploymentPayHistoryModal({ personName, onClose, onOpenPayReport }: EmploymentPayHistoryModalProps) {
  const { showToast } = useToastContext()
  const [windowDays, setWindowDays] = useState(WINDOW_STEP_DAYS)
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [extending, setExtending] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (windowDays === WINDOW_STEP_DAYS) setLoading(true)
      else setExtending(true)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('pay_stub_payments')
              .select(
                'id, paid_at, amount, memo, pay_stubs!inner(id, person_name, period_start, period_end, hours_total, gross_pay, created_at, paid_at, paid_by, paid_note)',
              )
              .eq('pay_stubs.person_name', personName.trim())
              .gte('paid_at', ymdDaysAgo(windowDays))
              .order('paid_at', { ascending: false }),
          'employment pay history',
        )
        if (cancelled) return
        const mapped: PaymentRow[] = ((data ?? []) as unknown as Array<
          { id: string; paid_at: string; amount: number; memo: string | null; pay_stubs: PayStubRow }
        >).map((r) => ({ id: r.id, paid_at: r.paid_at, amount: Number(r.amount), memo: r.memo, stub: r.pay_stubs }))
        setRows(mapped)
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Failed to load pay history'), 'error')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setExtending(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [personName, windowDays, showToast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const total = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: 'min(94vw, 720px)',
          maxHeight: 'min(85vh, 900px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <h2 id={TITLE_ID} style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            Pay history — {personName}
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Last {windowDays} days · {rows.length} payment{rows.length === 1 ? '' : 's'} · ${formatCurrency(total)}
          </span>
        </div>

        <div style={{ overflow: 'auto', flex: 1, minHeight: 0, padding: '0.75rem 1rem' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No payments recorded in the last {windowDays} days.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {rows.map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.35rem 0.75rem',
                    flexWrap: 'wrap',
                    padding: '0.5rem 0.6rem',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg-page)',
                  }}
                >
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text)', minWidth: '5.5rem' }}>
                    {formatPaidDate(r.paid_at)}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)', minWidth: '5.5rem' }}>
                    ${formatCurrency(r.amount)}
                  </span>
                  <span style={{ flex: '1 1 10rem', color: r.memo ? 'var(--text-700)' : 'var(--text-faint)', fontSize: '0.875rem' }}>
                    {r.memo ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenPayReport(r.stub)}
                    title={`Open pay report for ${periodShortLabel(r.stub.period_start, r.stub.period_end)}`}
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #2563eb',
                      borderRadius: 4,
                      background: 'var(--bg-blue-tint)',
                      color: 'var(--text-blue-700)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Pay report · {periodShortLabel(r.stub.period_start, r.stub.period_end)}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
              <button
                type="button"
                disabled={extending}
                onClick={() => setWindowDays((d) => d + WINDOW_STEP_DAYS)}
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  color: 'var(--text-700)',
                  cursor: extending ? 'wait' : 'pointer',
                }}
              >
                {extending ? 'Loading…' : `Show ${WINDOW_STEP_DAYS} more days`}
              </button>
            </div>
          ) : null}
        </div>

        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--border)',
            padding: '0.5rem 1rem 0.75rem',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              color: 'var(--text-700)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
