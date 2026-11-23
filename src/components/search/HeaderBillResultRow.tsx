import { SignedAmountSmallCents } from '../AmountSmallCents'
import { invoiceDayWords } from '../../lib/jobs/supplyInvoiceList'
import { BILL_SEARCH_WORDS, type HeaderBillResult } from '../../lib/materials/bills/billSearch'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * A supply house bill as a row of the header search (punch list #431, PR 7): a tag that says what it is, the invoice
 * number and its house, then its day, its amount and, when a part or a word of its page found it, that line. The host
 * owns the press and the highlight, as it does for a job's or a bid's row.
 */
export function HeaderBillResultRow({ result }: { result: HeaderBillResult }) {
  return (
    <span data-testid="header-bill-row" style={{ display: 'block' }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap' }}>
        <span style={{ flex: 'none', padding: '0 0.35rem', borderRadius: 4, background: 'var(--bg-muted)', color: 'var(--text-700)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Bill</span>
        <span style={{ fontWeight: 600 }}>{result.invoice_number}</span>
        <span>{result.supply_house_name}</span>
        <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          <SignedAmountSmallCents value={result.amount} />
        </span>
      </span>
      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', overflowWrap: 'anywhere' }}>
        {invoiceDayWords(result.invoice_date, todayYmdInAppTz())}
        {result.on_paper ? ` · ${BILL_SEARCH_WORDS.onThePaper} ${result.on_paper}` : ''}
      </span>
    </span>
  )
}
