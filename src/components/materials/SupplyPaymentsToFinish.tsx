import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { billDateWords } from '../../lib/materials/supplyBillGroups'
import { usd } from '../../lib/materials/payments/supplyPayment'
import { finishHeading, finishRows, type PaymentToFinish } from '../../lib/materials/payments/supplyPaymentsFinish'
import type { SupplyFinishIo } from '../../lib/materials/payments/supplyPaymentsFinishIo'
import { SupplyPaymentHowEditor } from './SupplyPaymentHowEditor'
import { MoneyText } from '../Money'

/**
 * Payments that still need how they were paid, under Accounts payable (the owner's call 4, 2026-11-16).
 *
 * Mark paid on a row stays one press: it makes a payment with the day and the amount. That payment waits here until
 * someone says how it was sent. The strip is not drawn while nothing waits, which is the good state.
 */
export function SupplyPaymentsToFinish({
  io,
  todayYmd,
  reloadKey = 0,
  openAtStart = false,
  onChanged,
  bankFor,
  onUseLine,
}: {
  io: SupplyFinishIo
  todayYmd: string
  /** Bump it to read the list again: a bill was marked paid, or a payment recorded, elsewhere on the page. */
  reloadKey?: number
  /** The Needs you line's door lands with the list open. */
  openAtStart?: boolean
  /** A payment was finished: whatever else shows payments reads again. */
  onChanged?: () => void
  /** The bank line for the same money, when the feed holds one to this house: its words and its id. */
  bankFor?: (payment: PaymentToFinish) => { id: string; words: string } | null
  /** Use this line: the payment takes the line's day and its kind as the method, and is matched to it. */
  onUseLine?: (paymentId: string, bankLineId: string) => Promise<void>
}) {
  const { showToast } = useToastContext()
  const [payments, setPayments] = useState<PaymentToFinish[]>([])
  const [open, setOpen] = useState(openAtStart)
  const [finishing, setFinishing] = useState<PaymentToFinish | null>(null)
  const [localKey, setLocalKey] = useState(0)
  const [usingId, setUsingId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    io.loadToFinish()
      .then((rows) => {
        if (alive) setPayments(rows)
      })
      // A read that fails draws no strip: the bills above still read right, and the count comes back on the next read.
      .catch(() => {
        if (alive) setPayments([])
      })
    return () => {
      alive = false
    }
  }, [io, reloadKey, localKey])

  useEffect(() => {
    if (openAtStart) setOpen(true)
  }, [openAtStart])

  const rows = finishRows(payments, (ymd) => billDateWords(ymd, todayYmd))
  if (rows.length === 0) return null
  const finishingRow = finishing ? rows.find((r) => r.id === finishing.id) : null

  return (
    <div data-testid="supply-payments-to-finish" style={{ margin: '0.5rem 0', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, width: '100%', padding: '0.5rem 0.75rem', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-amber-800)', cursor: 'pointer' }}
      >
        <span>
          {finishHeading(rows.length)} {open ? '▾' : '▸'}
        </span>
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}><MoneyText text={usd(rows.reduce((s, r) => s + r.amount, 0))} /></span>
      </button>
      {open ? (
        <div>
          <p style={{ margin: 0, padding: '0 0.75rem 0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Each was recorded with the day and the amount. Say how it was sent and it leaves this list.</p>
          {rows.map((r) => (
            <div key={r.id} data-testid="supply-payment-to-finish" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', padding: '0.45rem 0.75rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{r.title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                {(() => {
                  const payment = payments.find((p) => p.id === r.id)
                  const line = payment && bankFor ? bankFor(payment) : null
                  if (!line || !onUseLine) return null
                  return (
                    <div data-testid="supply-payment-to-finish-bank" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px', marginTop: 2, fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>The bank has it: {line.words}</span>
                      <button
                        type="button"
                        disabled={usingId != null}
                        onClick={() => {
                          setUsingId(r.id)
                          onUseLine(r.id, line.id)
                            .then(() => {
                              showToast('The bank line filled the day and how it was sent.', 'success')
                              setLocalKey((k) => k + 1)
                              onChanged?.()
                            })
                            .catch((e: unknown) => showToast(formatErrorMessage(e, 'The bank line was not used.'), 'error', 6000))
                            .finally(() => setUsingId(null))
                        }}
                        style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: usingId != null ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {usingId === r.id ? 'Using it…' : 'Use this line'}
                      </button>
                    </div>
                  )
                })()}
              </div>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><MoneyText text={usd(r.amount)} /></div>
              <button type="button" onClick={() => setFinishing(payments.find((p) => p.id === r.id) ?? null)} aria-label={`Finish ${r.title}`} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.25rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Finish…
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {finishing && finishingRow ? (
        <SupplyPaymentHowEditor
          payment={finishing}
          title={`${finishingRow.title} · ${finishingRow.sub}`}
          onClose={() => setFinishing(null)}
          onSave={async (paymentId, patch, words) => {
            await io.saveHowSent(paymentId, patch)
            setFinishing(null)
            showToast(words, 'success')
            setLocalKey((k) => k + 1)
            onChanged?.()
          }}
        />
      ) : null}
    </div>
  )
}
