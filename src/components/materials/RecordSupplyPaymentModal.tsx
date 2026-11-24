import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AmountPaidField, PaidDateField, PayMethodPicker, RecordPaymentFooter } from '../pay/RecordPaymentPieces'
import { EmptyState } from '../EmptyState'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { billDateWords, billDayName } from '../../lib/materials/supplyBillGroups'
import { ordinalDay } from '../../lib/materials/supplyHousePhone'
import {
  SUPPLY_PAY_CHIPS,
  SUPPLY_PAY_LATER,
  houseOnAccount,
  lastMethodUsed,
  paidByBill,
  supplyBillOpen,
  supplyPayMethodLabel,
  supplyPayMethodRefField,
  supplyPayMethodWrite,
  usd,
  type SupplyPayChip,
} from '../../lib/materials/payments/supplyPayment'
import {
  EMPTY_PAY_WINDOW,
  NO_INTEREST,
  amountBoxText,
  dueByCount,
  fillOldestFirst,
  nextPayDay,
  orderBillsOldestFirst,
  payWindowSummaryWords,
  planSupplyPayment,
  setBillBox,
  setInterest,
  setUseAccount,
  tickBill,
  tickCredit,
  tickDueBy,
  typeAmount,
  type PayWindowBill,
  type PayWindowContext,
  type PayWindowCredit,
  type PayWindowState,
} from '../../lib/materials/payments/supplyPaymentWindow'
import type { HousePayments, RecordSupplyPaymentResult, SupplyPaymentsIo } from '../../lib/materials/payments/supplyPaymentsIo'
import { MoneyText } from '../Money'

/**
 * Record a payment to a supply house (the owner's ask of 2026-11-16): the People pay window's pieces, with the
 * house's open bills under them. Ticking bills leads and the amount adds itself; typing the amount fills the
 * oldest bills first. The press names what it records and is dead with its reason until the amounts agree.
 *
 * The house is paid in its own portal as before. This window writes down what was sent: it never moves money.
 *
 * It draws and plans (`supplyPaymentWindow.ts`); the host hands it the house, its bills and the io, and reads
 * again when a payment is recorded.
 */

export type RecordSupplyPaymentBill = {
  id: string
  invoice_number: string
  due_date: string | null
  amount: number
  is_paid: boolean
  /** What the bill is for, as the card names it: the job, or the PO's words. */
  title: string
  /** It is interest or a late fee itself, so it is never the bill that ran late. */
  is_interest?: boolean | null
}

const quiet: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.4 }
const linkPress: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }
const daysBetween = (fromYmd: string, toYmd: string): number => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000)

export function RecordSupplyPaymentModal({
  house,
  bills,
  io,
  todayYmd,
  parts = false,
  zIndex = 1003,
  start,
  onClose,
  onRecorded,
}: {
  house: { id: string; name: string; monthlyPaymentDay: number | null }
  /** Every bill of the house the host holds, paid or not: the window keeps the open ones. */
  bills: ReadonlyArray<RecordSupplyPaymentBill>
  io: SupplyPaymentsIo
  todayYmd: string
  /** Part payments, credit memos and money on account. */
  parts?: boolean
  zIndex?: number
  /** Opened from a bank line: its amount, its day and its method are filled, and only the bills are left to tick. */
  start?: { amount: number; paidOn: string; chip: SupplyPayChip; words: string }
  onClose: () => void
  onRecorded: (result: RecordSupplyPaymentResult, words: string) => void
}) {
  useBodyScrollLock(true)
  const houseName = house.name.trim() || 'this house'
  const [loaded, setLoaded] = useState<HousePayments | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<PayWindowState>(EMPTY_PAY_WINDOW)
  const [paidOn, setPaidOn] = useState(start?.paidOn || todayYmd)
  const [receiptLink, setReceiptLink] = useState('')
  const [chip, setChip] = useState<SupplyPayChip | null>(start?.chip ?? null)
  const [startApplied, setStartApplied] = useState(false)
  const [methodRef, setMethodRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoadError(null)
    io.loadHouse(house.id)
      .then((data) => {
        if (!alive) return
        setLoaded(data)
        // The chips open on how the house was paid last.
        setChip((now) => now ?? lastMethodUsed(data.payments) ?? SUPPLY_PAY_LATER)
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(formatErrorMessage(e, 'The payments could not be read.'))
      })
    return () => {
      alive = false
    }
  }, [io, house.id, reloadKey])

  const ctx: PayWindowContext = useMemo(() => {
    const paid = loaded ? paidByBill(loaded.payments, loaded.lines) : new Map<string, number>()
    const open: PayWindowBill[] = []
    const credits: PayWindowCredit[] = []
    for (const b of bills) {
      const left = supplyBillOpen(b, paid.get(b.id) ?? 0)
      if (left > 0) open.push({ id: b.id, number: b.invoice_number, title: b.title, dueYmd: b.due_date, open: left })
      else if (left < 0) credits.push({ id: b.id, number: b.invoice_number, open: -left })
    }
    return {
      bills: orderBillsOldestFirst(open),
      credits: parts ? credits : [],
      account: parts && loaded ? houseOnAccount(loaded.payments, loaded.lines).map((x) => ({ paymentId: x.payment.id, amount: x.amount })) : [],
      parts,
    }
  }, [bills, loaded, parts])

  // From a bank line: once what is open is read, its amount is typed in and fills the oldest bills first.
  useEffect(() => {
    if (!start || startApplied || !loaded) return
    setStartApplied(true)
    setState((s) => typeAmount(s, start.amount.toFixed(2), ctx))
  }, [start, startApplied, loaded, ctx])

  const lastMethod = loaded ? lastMethodUsed(loaded.payments) : null
  const plan = planSupplyPayment(state, ctx, { chip, paidOn, dayWords: billDateWords(paidOn, todayYmd), house: houseName })
  const payDay = nextPayDay(house.monthlyPaymentDay, todayYmd)
  const dueBy = payDay ?? todayYmd
  const dueByN = dueByCount(ctx, dueBy)
  const accountTotal = ctx.account.reduce((s, a) => s + a.amount, 0)
  const refField = supplyPayMethodRefField(chip)
  const interest = state.interest ?? NO_INTEREST
  // The bills interest can be tied to: this house's bills that are not credits or interest themselves, the open ones first.
  const lateBills = useMemo(() => {
    const open = new Set(ctx.bills.map((b) => b.id))
    return bills
      .filter((b) => b.amount > 0 && !b.is_interest)
      .sort((a, b) => Number(open.has(b.id)) - Number(open.has(a.id)) || (b.due_date ?? '').localeCompare(a.due_date ?? ''))
      .slice(0, 40)
      .map((b) => ({ id: b.id, label: [b.invoice_number, b.title].filter(Boolean).join(' · ') }))
  }, [bills, ctx.bills])

  async function record() {
    if (!plan.record || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const { method, method_ref } = supplyPayMethodWrite(chip, methodRef)
      const result = await io.record({
        supplyHouseId: house.id,
        paidOn,
        amount: plan.record.amount,
        lines: plan.record.lines,
        fromAccount: plan.record.fromAccount,
        keepOnAccount: plan.record.keepOnAccount,
        interest: plan.record.interest,
        method,
        methodRef: method_ref,
        receiptLink: receiptLink.trim() || null,
        memo: null,
      })
      onRecorded(result, plan.sent > 0 ? `${usd(plan.sent)} to ${houseName} is recorded.` : `${houseName}'s bills are settled.`)
    } catch (e) {
      setSaveError(formatErrorMessage(e, 'The payment was not recorded.'))
    } finally {
      setSaving(false)
    }
  }

  const nothingToPay = loaded != null && ctx.bills.length === 0 && !parts
  const title = `Record a payment to ${houseName}`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="record-supply-payment"
        style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: 8, width: 'min(640px, calc(100vw - 1rem))', maxHeight: 'calc(100dvh - var(--app-top-chrome, 0px) - 1rem)', overflowY: 'auto', boxSizing: 'border-box' }}
      >
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem' }}>{title}</h2>
        <p style={{ ...quiet, margin: '0 0 0.9rem' }} data-testid="record-supply-payment-summary">
          {loaded ? payWindowSummaryWords(ctx, house.monthlyPaymentDay ? `pays on the ${ordinalDay(house.monthlyPaymentDay)}` : '') : loadError ? '' : 'Reading what is open…'}
        </p>

        {start ? (
          <p style={{ ...quiet, margin: '0 0 0.75rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-muted)' }} data-testid="record-supply-payment-from-bank">
            From the bank: {start.words}. Tick the bills it paid.
          </p>
        ) : null}
        {loadError ? (
          <div role="alert" style={{ marginBottom: '1rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {loadError}{' '}
            <button type="button" style={linkPress} onClick={() => setReloadKey((k) => k + 1)}>
              Read again
            </button>
          </div>
        ) : null}

        {nothingToPay ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: '1rem' }}>
            <EmptyState compact main={`Nothing waiting on a payment at ${houseName}.`} />
          </div>
        ) : loaded ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 1.25rem' }}>
              <div style={{ flex: '0 1 200px' }}>
                <AmountPaidField label="Amount sent" value={amountBoxText(state, plan)} disabled={saving} onChange={(v) => setState((s) => typeAmount(s, v, ctx))} />
              </div>
              <div style={{ flex: '0 1 200px' }}>
                <PaidDateField label="Date sent" value={paidOn} disabled={saving} onChange={setPaidOn} />
              </div>
            </div>
            <label style={{ display: 'block', margin: '0.4rem 0 0.75rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Receipt link (optional)</span>
              <input type="text" value={receiptLink} disabled={saving} onChange={(e) => setReceiptLink(e.target.value)} placeholder="Payment or receipt link…" style={{ width: '100%', padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
            </label>

            <PayMethodPicker
              options={SUPPLY_PAY_CHIPS}
              value={chip}
              disabled={saving}
              onChange={(v) => setChip(v ?? SUPPLY_PAY_LATER)}
              refBox={refField ? { id: 'supply-pay-ref', label: refField.label, placeholder: refField.placeholder } : null}
              refValue={methodRef}
              onRefChange={setMethodRef}
            />
            <p style={{ ...quiet, margin: '-0.4rem 0 0.9rem' }} data-testid="record-supply-payment-method-hint">
              {chip === SUPPLY_PAY_LATER
                ? 'The payment is recorded now. It waits until someone says how it was sent.'
                : lastMethod && chip === lastMethod
                  ? `${supplyPayMethodLabel(lastMethod)} is how the last payment to this house went.`
                  : ''}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 12px', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>What it paid · oldest due first</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                {dueByN > 0 ? (
                  <button type="button" style={linkPress} disabled={saving} onClick={() => setState((s) => tickDueBy(s, ctx, dueBy))} data-testid="record-supply-payment-due-by">
                    {payDay ? `Tick everything due by ${billDayName(payDay, todayYmd)}` : 'Tick everything due'}
                  </button>
                ) : null}
                <button type="button" style={linkPress} disabled={saving} onClick={() => setState((s) => fillOldestFirst(s, ctx))}>
                  Fill oldest first
                </button>
                <button type="button" style={linkPress} disabled={saving} onClick={() => setState(EMPTY_PAY_WINDOW)}>
                  Clear
                </button>
              </span>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: '0.75rem' }}>
              {accountTotal > 0 ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem', background: 'var(--bg-muted)', fontSize: '0.875rem' }} data-testid="record-supply-payment-account">
                  <input type="checkbox" checked={state.useAccount} disabled={saving} onChange={(e) => setState((s) => setUseAccount(s, e.target.checked, ctx))} />
                  <span>
                    <b>Use <MoneyText text={usd(accountTotal)} /> on account first</b>
                    <span style={{ ...quiet, display: 'block' }}>An earlier payment sent more than its bills. It goes on the oldest bills ticked.</span>
                  </span>
                </label>
              ) : null}
              {ctx.bills.length === 0 ? <EmptyState compact main={`Nothing waiting on a payment at ${houseName}.`} tail="A round sum can still be kept on account." /> : null}
              {ctx.bills.map((b) => {
                const on = state.boxes[b.id] != null
                const late = b.dueYmd && b.dueYmd < todayYmd ? daysBetween(b.dueYmd, todayYmd) : 0
                const note = plan.notes[b.id]
                return (
                  <div key={b.id} data-testid="record-supply-payment-bill" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)' }}>
                    <input id={`pay-tick-${b.id}`} type="checkbox" checked={on} disabled={saving} aria-label={`Pay ${b.number}`} onChange={(e) => setState((s) => tickBill(s, b, e.target.checked))} />
                    <label htmlFor={`pay-tick-${b.id}`} style={{ flex: '1 1 220px', minWidth: 0, cursor: 'pointer' }}>
                      <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                        {b.title}
                        {late > 0 ? <span style={{ marginLeft: 6, padding: '1px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, background: late >= 60 ? 'var(--bg-red-100)' : 'var(--bg-amber-100)', color: late >= 60 ? 'var(--text-red-800)' : 'var(--text-amber-800)' }}>{late}d past due</span> : null}
                      </span>
                      <span style={{ ...quiet, display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                        {b.number} · {b.dueYmd ? `due ${billDateWords(b.dueYmd, todayYmd)}` : 'no due date'} · <MoneyText text={usd(b.open)} /> open
                      </span>
                    </label>
                    {parts ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={state.boxes[b.id] ?? ''}
                        disabled={saving}
                        placeholder="0.00"
                        aria-label={`Amount on ${b.number}`}
                        onChange={(e) => setState((s) => setBillBox(s, b.id, e.target.value))}
                        style={{ width: 110, padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                      />
                    ) : (
                      <span style={{ minWidth: 96, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: on ? 'var(--text-strong)' : 'var(--text-muted)' }}><MoneyText text={usd(b.open)} /></span>
                    )}
                    {note && (parts || note.tone === 'bad') ? <span style={{ flexBasis: '100%', paddingLeft: 26, fontSize: '0.78rem', color: note.tone === 'bad' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{note.words}</span> : null}
                  </div>
                )
              })}
              {ctx.credits.map((c) => {
                const on = state.credits.includes(c.id)
                return (
                  <div key={c.id} data-testid="record-supply-payment-credit" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)' }}>
                    <input id={`pay-credit-${c.id}`} type="checkbox" checked={on} disabled={saving} aria-label={`Use credit memo ${c.number}`} onChange={(e) => setState((s) => tickCredit(s, c.id, e.target.checked, ctx))} />
                    <label htmlFor={`pay-credit-${c.id}`} style={{ flex: '1 1 220px', minWidth: 0, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                      Credit memo {c.number}
                    </label>
                    <span style={{ minWidth: 96, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-green-700)' }}>− <MoneyText text={usd(c.open)} /></span>
                    {on ? <span style={{ flexBasis: '100%', paddingLeft: 26, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Covers <MoneyText text={usd(c.open)} /> of the bills ticked. The credit memo will read used by this payment.</span> : null}
                  </div>
                )
              })}
              {/* Interest or a late fee: a bill of its own, tied to the bill that ran late, and paid by this payment. */}
              {parts && interest.on ? (
                <div data-testid="record-supply-payment-interest" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '4px 10px', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)' }}>
                  <input id="pay-interest-on" type="checkbox" checked disabled={saving} aria-label="The house added interest or a late fee" onChange={() => setState((s) => setInterest(s, { on: false }, ctx))} style={{ marginTop: 4 }} />
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <label htmlFor="pay-interest-on" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', cursor: 'pointer' }}>
                      Interest or a late fee
                    </label>
                    <label style={{ display: 'block', marginTop: 4, fontSize: '0.8125rem' }}>
                      <span style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Which bill was late (optional)</span>
                      <select value={interest.lateBillId ?? ''} disabled={saving} onChange={(e) => setState((s) => setInterest(s, { lateBillId: e.target.value || null }, ctx))} style={{ maxWidth: '100%', padding: '0.3rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }}>
                        <option value="">Not tied to a bill</option>
                        {lateBills.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span style={{ ...quiet, display: 'block', marginTop: 4 }}>Kept as a bill of its own, marked Interest, and paid by this payment. It is not put on a job.</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={interest.amountText}
                    disabled={saving}
                    placeholder="0.00"
                    aria-label="Interest or late fee amount"
                    onChange={(e) => setState((s) => setInterest(s, { amountText: e.target.value }, ctx))}
                    style={{ width: 110, padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
              ) : null}
              {parts && !interest.on ? (
                <div style={{ padding: '0.45rem 0.75rem', borderTop: '1px solid var(--border)' }}>
                  <button type="button" style={linkPress} disabled={saving} onClick={() => setState((s) => setInterest(s, { on: true }, ctx))}>
                    + The house added interest or a late fee
                  </button>
                </div>
              ) : null}
            </div>

            <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} data-testid="record-supply-payment-placed">
              {plan.placedWords}
            </p>
            {plan.leftWords ? <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: plan.leftTone === 'bad' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{plan.leftWords}</p> : null}
            {parts && plan.left > 0 ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 0.5rem', fontSize: '0.875rem' }} data-testid="record-supply-payment-keep">
                <input type="checkbox" checked={state.keepOnAccount} disabled={saving} onChange={(e) => setState((s) => ({ ...s, keepOnAccount: e.target.checked }))} />
                Keep <MoneyText text={usd(plan.left)} /> on account with {houseName}
              </label>
            ) : null}
            <p style={{ ...quiet, margin: '0 0 0.9rem', minHeight: '1.2em' }} data-testid="record-supply-payment-why">
              {plan.reason || plan.afterWords}
            </p>
          </>
        ) : null}

        {saveError ? (
          <p role="alert" style={{ margin: '0 0 0.75rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {saveError}
          </p>
        ) : null}
        <RecordPaymentFooter onCancel={onClose} onConfirm={() => void record()} confirmLabel={plan.pressLabel} busy={saving} busyLabel="Recording…" disabled={!loaded || nothingToPay || plan.reason !== ''} />
      </div>
    </div>
  )
}
