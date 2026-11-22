import { useEffect, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { loadCustomerNames } from '../../lib/research/bidSiteIo'
import { sameNameCustomerIds, sameNameRowsWords } from '../../lib/customers/customerDetailTabs'
import { BidGcPermits } from '../bids/BidGcPermits'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }

type Rows = { state: 'reading' } | { state: 'read'; ids: string[] } | { state: 'alone'; ids: string[]; reason: string }

/**
 * The customer page's Permits tab (v2.8302, punch list #307's last thing for this page): the panel
 * a bid's window draws under its GC, from the customer's side. The jobs we priced for them with
 * what the city shows on each address, then the names on permits tied to them, with Take back
 * and Find their names on permits. One GC under two customer rows of one name is read as one,
 * as the bid window reads it. When the other rows cannot be read, this row's own bids still show
 * and the tab says so.
 */
export function CustomerPermitsTab({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [rows, setRows] = useState<Rows>({ state: 'reading' })

  useEffect(() => {
    let live = true
    setRows({ state: 'reading' })
    loadCustomerNames()
      .then((customers) => {
        if (live) setRows({ state: 'read', ids: sameNameCustomerIds(customerId, customerName, customers) })
      })
      .catch((e: unknown) => {
        if (live) setRows({ state: 'alone', ids: [customerId], reason: formatErrorMessage(e) })
      })
    return () => {
      live = false
    }
  }, [customerId, customerName])

  if (rows.state === 'reading') {
    return (
      <p role="status" style={muted} data-testid="customer-permits-tab">
        Reading what the city has…
      </p>
    )
  }

  const sameName = sameNameRowsWords(rows.ids.length - 1)
  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }} data-testid="customer-permits-tab">
      <BidGcPermits customerIds={rows.ids} customerName={customerName} currentBidId={null} onItsOwnPage />
      {sameName ? <div style={muted}>{sameName}</div> : null}
      {rows.state === 'alone' ? (
        <div style={{ ...muted, color: 'var(--text-red-700)' }}>
          The other customer rows of this name could not be read, so these are this row’s bids alone. {rows.reason}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Where the Profile tab's Names on permits card stood (v2.6886): the door to the Permits tab,
 * which now holds the names and the press that finds more. It reads nothing, so the Profile tab
 * no longer asks the city's records on every open.
 */
export function CustomerPermitsDoor({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '4px 13px', marginBottom: 16, minWidth: 0 }}
      data-testid="customer-permit-names"
    >
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)' }}>Names on permits</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>the names a city lists for them, and the jobs you priced for them</span>
      <button
        type="button"
        onClick={onOpen}
        style={{ marginLeft: 'auto', minHeight: 36, background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }}
      >
        Open Permits →
      </button>
    </div>
  )
}
