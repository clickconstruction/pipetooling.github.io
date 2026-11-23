import { useState, type CSSProperties, type ReactNode } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useConfirmDialog, usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { billDateWords } from '../../lib/materials/supplyBillGroups'
import { paidByBill, paymentView, supplyPayMethodWords, usd, type SupplyPayment, type SupplyPaymentLine } from '../../lib/materials/payments/supplyPayment'
import { MOVE_REASONS, ON_ACCOUNT, moveTargets, paymentHistory, paymentOnBill, planMove, type MoveBill, type MoveReason, type SupplyPaymentEvent } from '../../lib/materials/payments/supplyPaymentMove'
import type { MoveSupplyPaymentInput } from '../../lib/materials/payments/supplyPaymentsIo'
import { supplyBankLineWords, type SupplyBankCandidate, type SupplyBankLine } from '../../lib/materials/payments/supplyPaymentBank'
import { MoneyText } from '../Money'

/**
 * One payment to a supply house, with every bill it touched (the owner's ask of 2026-11-16). A paid row opens it.
 *
 * A typed payment is money that was sent, so Mark unpaid does not unmake it. Here it is changed the ways it really
 * changes: **Move…** puts an amount on another bill when the house applied the money differently, with a panel
 * that says what changes on both bills before the press; **Remove this payment…** takes a payment recorded by
 * mistake off the books, with why. Each move is listed under the bills and can be taken back.
 *
 * It draws and plans (`supplyPaymentMove.ts`); the host holds the payments and does the writes.
 */

const quiet: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.4 }
const linkPress: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }
const plainPress = (busy: boolean): CSSProperties => ({ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' })
const chip = (on: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.7rem', border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`, borderRadius: 999, background: on ? '#2563eb' : 'var(--surface)', color: on ? '#fff' : 'var(--text-700)', cursor: 'pointer' })

export function SupplyPaymentWindow({
  payment,
  payments,
  lines,
  events = [],
  bills,
  houseName,
  todayYmd,
  zIndex = 1003,
  onClose,
  onRemove,
  onMove,
  onUndoMove,
  onEditHow,
  bank,
}: {
  payment: SupplyPayment
  /** The house's payments, lines and events the host holds: what else sits on the same bills. */
  payments: ReadonlyArray<SupplyPayment>
  lines: ReadonlyArray<SupplyPaymentLine>
  events?: ReadonlyArray<SupplyPaymentEvent>
  /** Every bill of the house: the ones this payment touched, and the ones an amount could move to. */
  bills: ReadonlyArray<MoveBill>
  houseName: string
  todayYmd: string
  zIndex?: number
  onClose: () => void
  /** Removes the payment, with why; resolves when it is gone. A refusal throws with its reason. */
  onRemove: (payment: SupplyPayment, reason: string | null) => Promise<void>
  /** Moves an amount; resolves when the host has read the house again. */
  onMove: (input: MoveSupplyPaymentInput) => Promise<void>
  onUndoMove: (eventId: string) => Promise<void>
  /** Opens "how it was sent" for this payment: the method and its number, the day, the receipt link. */
  onEditHow?: () => void
  /** The bank side: the line it is matched to, or the lines it could be. Absent for a login that cannot read the bank. */
  bank?: {
    matched: SupplyBankLine | null
    /** It is matched, even when the line itself is not among the ones read. */
    hasMatch: boolean
    candidates: ReadonlyArray<SupplyBankCandidate>
    onMatch: (bankLineId: string) => Promise<void>
    onUnmatch: () => Promise<void>
  }
}) {
  useBodyScrollLock(true)
  const confirm = useConfirmDialog()
  const prompt = usePromptDialog()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The Move step: the bill the amount is on now (or the account), and the form. */
  const [moveFrom, setMoveFrom] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState<string | null>(null)
  const [moveAmount, setMoveAmount] = useState('')
  const [moveReason, setMoveReason] = useState<MoveReason | null>(null)

  const dayWords = (ymd: string): string => billDateWords(ymd, todayYmd)
  const paid = paidByBill(payments, lines)
  const paidOnBill = (id: string): number => paid.get(id) ?? 0
  const view = paymentView(payment, lines, bills, { house: houseName, dayWords, paidOnBill })
  const receipt = (payment.receipt_link ?? '').trim()
  const history = paymentHistory(payment.id, events, dayWords, calendarYmdInAppTzFromIso)

  function openMove(fromId: string) {
    const max = fromId === ON_ACCOUNT ? view.onAccount : paymentOnBill(payment.id, fromId, lines)
    setMoveFrom(fromId)
    setMoveTo(null)
    setMoveAmount(max > 0 ? max.toFixed(2) : '')
    setMoveReason(null)
    setError(null)
  }

  async function run(work: () => Promise<void>, failed: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(formatErrorMessage(e, failed))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    const why = await prompt({ title: view.removeConfirm.title, message: `${view.removeConfirm.message} Say why, so the record reads right later.`, placeholder: 'Typed twice, wrong house, the bank sent it back…', confirmLabel: view.removeConfirm.confirmLabel })
    if (why == null) return
    await run(() => onRemove(payment, why.trim() || null), 'The payment was not removed.')
  }

  const shell = (title: string, body: ReactNode) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="supply-payment-window"
        style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: 8, width: 'min(560px, calc(100vw - 1rem))', maxHeight: 'calc(100dvh - var(--app-top-chrome, 0px) - 1rem)', overflowY: 'auto', boxSizing: 'border-box' }}
      >
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem' }}>{title}</h2>
        {body}
      </div>
    </div>
  )

  if (moveFrom != null) {
    const fromBill = bills.find((b) => b.id === moveFrom)
    const targets = moveTargets(payment, lines, bills, paidOnBill, moveFrom)
    const plan = planMove({ payment, lines, bills, paidOnBill, house: houseName, fromId: moveFrom, toId: moveTo, amountText: moveAmount, reason: moveReason })
    const how = supplyPayMethodWords(payment)
    const dead = busy || plan.reason !== ''
    return shell(
      'Move this payment',
      <>
        <p style={{ ...quiet, margin: '0 0 0.9rem' }} data-testid="supply-payment-move-sub">
          <MoneyText text={usd(plan.max)} /> of the {dayWords(payment.paid_on)} {how || 'payment'} · now {moveFrom === ON_ACCOUNT ? `on account with ${houseName}` : `on ${fromBill?.invoice_number ?? 'a bill'}`}
        </p>
        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>How much to move</span>
          <input type="text" inputMode="decimal" value={moveAmount} disabled={busy} onChange={(e) => setMoveAmount(e.target.value)} placeholder="0.00" style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '100%', maxWidth: 200 }} />
        </label>
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 0.75rem', minWidth: 0 }}>
          <legend style={{ padding: 0, marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>To which bill at {houseName}</legend>
          {targets.length === 0 ? <EmptyState compact main={`Nothing waiting on a payment at ${houseName}.`} tail="Money moves only to a bill that is still open." /> : null}
          {targets.map((t) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0.25rem 0', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="radio" name="supply-payment-move-to" checked={moveTo === t.id} disabled={busy} onChange={() => setMoveTo(t.id)} />
              <span style={{ overflowWrap: 'anywhere' }}>{t.label}</span>
            </label>
          ))}
        </fieldset>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Why</span>
          <div role="group" aria-label="Why" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {MOVE_REASONS.map((r) => (
              <button key={r.key} type="button" aria-pressed={moveReason === r.key} disabled={busy} onClick={() => setMoveReason(r.key)} style={chip(moveReason === r.key)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {plan.changes.length > 0 ? (
          <div data-testid="supply-payment-move-changes" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.75rem', background: 'var(--bg-muted)' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>What changes</div>
            {plan.changes.map((c) => (
              <div key={c} style={{ fontSize: '0.8125rem', lineHeight: 1.5, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                {c}
              </div>
            ))}
          </div>
        ) : null}
        <p style={{ ...quiet, margin: '0 0 0.9rem', minHeight: '1.2em' }} data-testid="supply-payment-move-why">
          {plan.reason || 'A move can be taken back from this payment’s window.'}
        </p>
        {error ? (
          <p role="alert" style={{ margin: '0 0 0.75rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={() => setMoveFrom(null)} style={plainPress(busy)}>
            Cancel
          </button>
          <button
            type="button"
            disabled={dead}
            onClick={() => {
              const move = plan.move
              if (!move) return
              void run(async () => {
                await onMove(move)
                setMoveFrom(null)
              }, 'The payment was not moved.')
            }}
            style={{ padding: '0.5rem 1rem', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Moving…' : plan.pressLabel}
          </button>
        </div>
      </>,
    )
  }

  return shell(
    view.title,
    <>
      <p style={{ ...quiet, margin: '0 0 0.9rem' }} data-testid="supply-payment-window-sub">
        {view.sub}
        {receipt ? (
          <>
            {' · '}
            <a href={receipt} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Receipt ›
            </a>
          </>
        ) : null}
      </p>
      {/* The bank line this money left on: matched, or offered for one press. Nothing is drawn when the feed has none. */}
      {bank?.matched ? (
        <div data-testid="supply-payment-window-bank" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', margin: '0 0 0.6rem', padding: '0.45rem 0.75rem', borderRadius: 8, background: 'var(--bg-green-100)', fontSize: '0.8125rem' }}>
          <span style={{ flex: '1 1 240px', minWidth: 0, overflowWrap: 'anywhere' }}>
            <b style={{ color: 'var(--text-green-700)' }}>Bank agrees ✓</b> {supplyBankLineWords(bank.matched, dayWords)}
          </span>
          <button type="button" style={linkPress} disabled={busy} onClick={() => void run(() => bank.onUnmatch(), 'The match was not taken off.')}>
            Take it off
          </button>
        </div>
      ) : bank?.hasMatch ? (
        <p data-testid="supply-payment-window-bank" style={{ ...quiet, margin: '0 0 0.6rem' }}>
          <b style={{ color: 'var(--text-green-700)' }}>Bank agrees ✓</b> It is matched to a bank line that is older than the lines read here.{' '}
          <button type="button" style={linkPress} disabled={busy} onClick={() => void run(() => bank.onUnmatch(), 'The match was not taken off.')}>
            Take it off
          </button>
        </p>
      ) : bank && bank.candidates.length > 0 ? (
        <div data-testid="supply-payment-window-bank" style={{ margin: '0 0 0.6rem', padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.8125rem' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{bank.candidates.length === 1 ? 'The bank has a line for the same money.' : 'The bank has lines for the same money. Press the one that is this payment.'}</div>
          {bank.candidates.slice(0, 3).map((c) => (
            <div key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', lineHeight: 1.6 }}>
              <span style={{ flex: '1 1 240px', minWidth: 0, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>
                {supplyBankLineWords(c, dayWords)}
                {c.isHouse ? '' : ' · a different name at the bank'}
              </span>
              <button type="button" style={linkPress} disabled={busy} onClick={() => void run(() => bank.onMatch(c.id), 'The payment was not matched.')} aria-label={`Match to the bank line of ${dayWords(c.ymd)}`}>
                Match
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: '0.6rem' }}>
        {view.rows.map((r, i) => (
          <div key={r.billId} data-testid="supply-payment-window-line" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', padding: '0.5rem 0.75rem', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{r.label}</div>
              {r.state ? <div style={quiet}>{r.state}</div> : null}
            </div>
            <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.amount < 0 ? 'var(--text-green-700)' : 'var(--text-strong)' }}><MoneyText text={usd(r.amount)} /></div>
            {/* A credit memo's line is not money that moves. */}
            {r.amount > 0 ? (
              <button type="button" style={linkPress} disabled={busy} onClick={() => openMove(r.billId)} aria-label={`Move the ${usd(r.amount)} on ${r.label}`}>
                Move…
              </button>
            ) : null}
          </div>
        ))}
        {view.onAccount > 0 ? (
          <div data-testid="supply-payment-window-account" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', padding: '0.5rem 0.75rem', borderTop: view.rows.length > 0 ? '1px solid var(--border)' : undefined, background: 'var(--bg-muted)' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>On account with {houseName}</div>
              <div style={quiet}>not on a bill yet</div>
            </div>
            <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><MoneyText text={usd(view.onAccount)} /></div>
            <button type="button" style={linkPress} disabled={busy} onClick={() => openMove(ON_ACCOUNT)}>
              Put on a bill…
            </button>
          </div>
        ) : null}
      </div>
      <p style={{ ...quiet, margin: '0 0 0.75rem' }}>{view.foot}</p>
      {history.length > 0 ? (
        <div data-testid="supply-payment-window-history" style={{ marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>What happened to it</div>
          {history.map((h) => (
            <div key={h.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', alignItems: 'baseline', fontSize: '0.8125rem', lineHeight: 1.5 }}>
              <span style={{ flex: '1 1 240px', minWidth: 0, overflowWrap: 'anywhere' }}>{h.words}</span>
              {h.canUndo ? (
                <button
                  type="button"
                  style={linkPress}
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      if (!(await confirm({ title: 'Take this move back?', message: `${h.words}. The same amount goes back where it was.`, confirmLabel: 'Take it back' }))) return
                      await run(() => onUndoMove(h.id), 'The move was not taken back.')
                    })()
                  }}
                >
                  Take it back
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: '0 0 0.75rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => void remove()} style={{ ...plainPress(busy), color: 'var(--text-red-700)' }}>
          {busy ? 'Working…' : 'Remove this payment…'}
        </button>
        {onEditHow ? (
          <button type="button" disabled={busy} onClick={onEditHow} style={plainPress(busy)}>
            Edit how it was sent
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={onClose} style={plainPress(busy)}>
          Close
        </button>
      </div>
    </>,
  )
}
