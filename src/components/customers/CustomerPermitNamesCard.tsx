import { BidGcTiedNames } from '../bids/BidGcTiedNames'

/**
 * Names on permits, on a customer's page (punch list #307, PR 9): the names a city lists that
 * are tied to this customer, with what each is listed on, and the press that finds more. The
 * same panel half and the same sheet a bid's window carries, from the customer's side. It draws
 * nothing until the answers table is on the database.
 */
export function CustomerPermitNamesCard({ customerId, customerName }: { customerId: string; customerName: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '12px 14px', display: 'grid', gap: 8, minWidth: 0 }} data-testid="customer-permit-names">
      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>Names on permits</div>
      <BidGcTiedNames customerIds={[customerId]} customerName={customerName} />
    </div>
  )
}
