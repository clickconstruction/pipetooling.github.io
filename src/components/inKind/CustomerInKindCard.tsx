/**
 * Pays in kind, on the customer's page (punch list #301): the deal in a sentence, how far along it is and what is
 * left, with the doors to its ledger, Add a line and the terms. A customer with no deal gets one quiet press to set
 * one up. The office only: the tables behind it are the office's to read.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { inKindTotals, isMonthlyArrangement, lastCreditMonth, monthOf, monthYear } from '../../lib/inKind/inKindLedger'
import { loadCustomerInKind, type InKindLedgerData } from '../../lib/inKind/inKindIo'
import { IN_KIND_ADD_LINE, IN_KIND_CARD_TITLE, IN_KIND_OPEN_LEDGER, IN_KIND_SET_UP, billsWord, jobsWord, kindWords, termsSentence, unbilledWords, usd } from '../../lib/inKind/inKindWords'
import InKindAddLineWindow from './InKindAddLineWindow'
import InKindLedgerWindow from './InKindLedgerWindow'
import InKindTermsWindow from './InKindTermsWindow'
import { bluePress, cardBox, meterParts, pill, quietPress, redText, statBox, statKey, statSub, statValue } from './inKindStyles'

export interface CustomerInKindCardIo {
  load: (customerId: string) => Promise<InKindLedgerData[]>
}
const REAL_IO: CustomerInKindCardIo = { load: loadCustomerInKind }

type Open = { kind: 'ledger' | 'line' | 'terms'; id: string } | { kind: 'new' } | null

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

  const load = useCallback(async () => {
    try {
      setDeals(await io.load(customerId))
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
  }, [load, onChanged])

  const openDeal = useMemo(() => (open && open.kind !== 'new' ? ((deals ?? []).find((d) => d.arrangement.id === open.id) ?? null) : null), [deals, open])

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
        const last = isMonthlyArrangement(a) ? lastCreditMonth(t.left, a.monthly_amount, monthOf(todayYmdInAppTz())) : null
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setOpen({ kind: 'line', id: a.id })} style={bluePress()} data-testid="customer-in-kind-add-line">
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
