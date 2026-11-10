/**
 * Pays in kind, on the customer's page (punch list #301): the deal in a sentence, how far along it is and what is
 * left, with the doors to its ledger, Add a line and the terms. A customer with no deal gets one quiet press to set
 * one up. The office only: the tables behind it are the office's to read.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { dueMonths, inKindTotals, isMonthlyArrangement, lastCreditMonth, monthOf, monthYear } from '../../lib/inKind/inKindLedger'
import { bankLinesOfMonth, monthsWithBank, type BankPaidLine } from '../../lib/inKind/inKindBank'
import { loadCustomerInKind, loadInKindBankLines, type InKindLedgerData } from '../../lib/inKind/inKindIo'
import { IN_KIND_CHANGED_EVENT } from '../../lib/inKind/inKindCreditsDue'
import { IN_KIND_ADD_LINE, IN_KIND_CARD_TITLE, IN_KIND_OPEN_LEDGER, IN_KIND_SET_UP, billsWord, dueStripWords, jobsWord, kindWords, monthOpenPress, termsSentence, unbilledWords, usd } from '../../lib/inKind/inKindWords'
import InKindAddLineWindow from './InKindAddLineWindow'
import InKindLedgerWindow from './InKindLedgerWindow'
import InKindMonthWindow from './InKindMonthWindow'
import InKindTermsWindow from './InKindTermsWindow'
import { amberStrip, bluePress, cardBox, linePress, meterParts, pill, quietPress, redText, statBox, statKey, statSub, statValue } from './inKindStyles'

export interface CustomerInKindCardIo {
  load: (customerId: string) => Promise<InKindLedgerData[]>
  /** What left the bank to a deal's payee since its first month; a role that cannot read the bank rejects. */
  loadBank: (payee: string, firstMonth: string) => Promise<BankPaidLine[]>
}
const REAL_IO: CustomerInKindCardIo = { load: loadCustomerInKind, loadBank: loadInKindBankLines }

type Open = { kind: 'ledger' | 'line' | 'terms'; id: string } | { kind: 'month'; id: string; month: string } | { kind: 'new' } | null

export default function CustomerInKindCard({
  customerId,
  customerName,
  userId,
  canSetUp,
  onChanged,
  io = REAL_IO,
}: {
  customerId: string
  customerName: string
  userId: string
  /** Offer the press that sets a deal up. The page says yes for a customer with money open. */
  canSetUp: boolean
  /** A deal or a line changed the customer's money; the page reads itself again. */
  onChanged?: () => void
  io?: CustomerInKindCardIo
}) {
  const [deals, setDeals] = useState<InKindLedgerData[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [open, setOpen] = useState<Open>(null)
  /** Deal id → the bank's lines to its payee; null when the bank could not be read, absent when the deal has no payee. */
  const [bank, setBank] = useState<Map<string, BankPaidLine[] | null>>(new Map())
  const [searchParams, setSearchParams] = useSearchParams()

  const load = useCallback(async () => {
    try {
      const rows = await io.load(customerId)
      const read = new Map<string, BankPaidLine[] | null>()
      await Promise.all(
        rows.map(async (d) => {
          const a = d.arrangement
          if (a.ended_at || !isMonthlyArrangement(a) || !a.starts_on || !a.bank_payee.trim()) return
          try {
            read.set(a.id, await io.loadBank(a.bank_payee, a.starts_on))
          } catch {
            read.set(a.id, null)
          }
        }),
      )
      setBank(read)
      setDeals(rows)
      setFailed(null)
    } catch (e) {
      setFailed(formatErrorMessage(e, 'What this customer pays in kind could not be read.'))
    }
  }, [customerId, io])

  useEffect(() => {
    void load()
  }, [load])

  const changed = useCallback(() => {
    void load()
    onChanged?.()
    window.dispatchEvent(new Event(IN_KIND_CHANGED_EVENT))
  }, [load, onChanged])

  const openDeal = useMemo(() => (open && open.kind !== 'new' ? ((deals ?? []).find((d) => d.arrangement.id === open.id) ?? null) : null), [deals, open])
  const todayYmd = todayYmdInAppTz()
  const monthsById = useMemo(() => new Map((deals ?? []).map((d) => [d.arrangement.id, monthsWithBank(d.arrangement, d.lines, bank.get(d.arrangement.id), todayYmd)])), [deals, bank, todayYmd])

  // A door from Needs you: ?inKind=<deal>&month=YYYY-MM-01 opens that month's window, or the ledger when the month is settled.
  const doorDeal = searchParams.get('inKind')
  const doorMonth = searchParams.get('month')
  const doorNew = searchParams.get('inKindNew')
  useEffect(() => {
    // The list page's set-up press lands here with ?inKindNew=1: the terms window opens for a new deal, unless one is open already.
    if (doorNew && deals != null) {
      const live = deals.find((d) => !d.arrangement.ended_at)
      setOpen(live ? { kind: 'ledger', id: live.arrangement.id } : { kind: 'new' })
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.delete('inKindNew')
          return n
        },
        { replace: true },
      )
      return
    }
    if (!doorDeal || deals == null) return
    const d = deals.find((x) => x.arrangement.id === doorDeal)
    if (d) {
      const due = dueMonths(monthsById.get(doorDeal) ?? []).some((m) => m.month === doorMonth)
      setOpen(due && doorMonth ? { kind: 'month', id: doorDeal, month: doorMonth } : { kind: 'ledger', id: doorDeal })
    }
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.delete('inKind')
        n.delete('month')
        return n
      },
      { replace: true },
    )
  }, [doorDeal, doorMonth, doorNew, deals, monthsById, setSearchParams])

  if (failed) {
    return (
      <div style={cardBox} role="alert">
        <span style={redText}>{failed}</span>
        <button type="button" onClick={() => void load()} style={{ ...quietPress, alignSelf: 'flex-start' }}>
          Read it again
        </button>
      </div>
    )
  }
  if (deals == null) return null

  const live = deals.filter((d) => !d.arrangement.ended_at)
  const ended = deals.filter((d) => d.arrangement.ended_at)

  return (
    <>
      {live.map((d) => {
        const a = d.arrangement
        const t = inKindTotals(d.jobs, d.lines, d.payments)
        const { paidPct } = meterParts(t.paidInKind, t.work)
        const last = isMonthlyArrangement(a) ? lastCreditMonth(t.left, a.monthly_amount, monthOf(todayYmd)) : null
        const due = dueMonths(monthsById.get(a.id) ?? [])
        const firstDue = due[0] ?? null
        const firstDueBank = firstDue ? bankLinesOfMonth(bank.get(a.id) ?? [], firstDue.month) : []
        return (
          <div key={a.id} style={cardBox} data-testid="customer-in-kind-card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-strong)' }}>{IN_KIND_CARD_TITLE}</span>
                <span style={pill('blue')}>{kindWords(a)}</span>
              </div>
              <button type="button" onClick={() => setOpen({ kind: 'ledger', id: a.id })} style={quietPress}>
                {IN_KIND_OPEN_LEDGER} →
              </button>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{termsSentence(a)}</div>
            <div role="img" aria-label={`${usd(t.paidInKind)} of ${usd(t.work)} paid in kind`} style={{ height: 10, borderRadius: 9999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
              <div style={{ width: `${paidPct}%`, height: '100%', background: '#16a34a' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={statBox}>
                <span style={statKey}>Paid in kind so far</span>
                <span style={statValue}>{usd(t.paidInKind)}</span>
                <span style={statSub}>of {usd(t.work)} on {jobsWord(t.jobCount)}</span>
              </div>
              <div style={statBox}>
                <span style={statKey}>Still to come</span>
                <span style={statValue}>{usd(t.left)}</span>
                <span style={statSub}>{t.left > 0.005 ? `on ${billsWord(t.openJobCount)}, scheduled, not late` : 'nothing is left'}</span>
              </div>
              {last ? (
                <div style={statBox}>
                  <span style={statKey}>Last credit</span>
                  <span style={statValue}>{monthYear(last.month)}</span>
                  <span style={statSub}>
                    about {last.months} {last.months === 1 ? 'month' : 'months'} at {usd(a.monthly_amount ?? 0)}
                  </span>
                </div>
              ) : null}
            </div>
            {unbilledWords(t) ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{unbilledWords(t)}</div> : null}
            {firstDue ? (
              <div style={{ ...amberStrip, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }} data-testid="customer-in-kind-due">
                <span>
                  {dueStripWords(
                    due.map((m) => m.month),
                    firstDue.bankPaid,
                    firstDueBank.length > 0 ? firstDueBank[firstDueBank.length - 1]!.day : null,
                  )}
                </span>
                <button type="button" onClick={() => setOpen({ kind: 'month', id: a.id, month: firstDue.month })} style={bluePress()} data-testid="customer-in-kind-enter-month">
                  {monthOpenPress(firstDue.month)}
                </button>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setOpen({ kind: 'line', id: a.id })} style={firstDue ? linePress : bluePress()} data-testid="customer-in-kind-add-line">
                {IN_KIND_ADD_LINE}
              </button>
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', margin: '-8px 0 12px' }}>
        {ended.map((d) => (
          <button key={d.arrangement.id} type="button" onClick={() => setOpen({ kind: 'ledger', id: d.arrangement.id })} style={{ ...quietPress, color: 'var(--text-muted)', fontWeight: 500 }}>
            Ended: {d.arrangement.what_given}
          </button>
        ))}
        {live.length === 0 && canSetUp ? (
          <button type="button" onClick={() => setOpen({ kind: 'new' })} style={{ ...quietPress, fontWeight: 500 }} data-testid="customer-in-kind-set-up">
            {IN_KIND_SET_UP}
          </button>
        ) : null}
      </div>

      {open?.kind === 'ledger' && openDeal ? (
        <InKindLedgerWindow
          data={openDeal}
          onClose={() => setOpen(null)}
          onChanged={changed}
          onAddLine={() => setOpen({ kind: 'line', id: openDeal.arrangement.id })}
          onChangeTerms={() => setOpen({ kind: 'terms', id: openDeal.arrangement.id })}
          months={monthsById.get(openDeal.arrangement.id) ?? []}
          onEnterMonth={(month) => setOpen({ kind: 'month', id: openDeal.arrangement.id, month })}
        />
      ) : null}
      {open?.kind === 'month' && openDeal ? (
        <InKindMonthWindow
          data={openDeal}
          month={open.month}
          bankLines={bank.has(openDeal.arrangement.id) ? (bank.get(openDeal.arrangement.id) == null ? null : bankLinesOfMonth(bank.get(openDeal.arrangement.id) ?? [], open.month)) : null}
          onClose={() => setOpen(null)}
          onEntered={() => {
            setOpen(null)
            changed()
          }}
        />
      ) : null}
      {open?.kind === 'line' && openDeal ? (
        <InKindAddLineWindow
          data={openDeal}
          zIndex={1100}
          onClose={() => setOpen({ kind: 'ledger', id: openDeal.arrangement.id })}
          onAdded={() => {
            setOpen({ kind: 'ledger', id: openDeal.arrangement.id })
            changed()
          }}
        />
      ) : null}
      {open?.kind === 'terms' && openDeal ? (
        <InKindTermsWindow
          customerId={customerId}
          customerName={customerName}
          existing={openDeal}
          userId={userId}
          zIndex={1100}
          onClose={() => setOpen({ kind: 'ledger', id: openDeal.arrangement.id })}
          onSaved={() => {
            setOpen(null)
            changed()
          }}
        />
      ) : null}
      {open?.kind === 'new' ? (
        <InKindTermsWindow
          customerId={customerId}
          customerName={customerName}
          existing={null}
          userId={userId}
          zIndex={1100}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null)
            changed()
          }}
        />
      ) : null}
    </>
  )
}
