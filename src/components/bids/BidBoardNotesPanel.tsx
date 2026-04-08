import { BidNotesTable } from '../bidNotes/BidNotesTable'
import { CustomerNotesTable } from '../customerNotes/CustomerNotesTable'
import { UnifiedBidCustomerNotes } from '../bidBoard/UnifiedBidCustomerNotes'

export type BidBoardNotesTab = 'all' | 'bid' | 'customer'

export type BidBoardNotesPanelBid = {
  id: string
  customers?: { id: string; name: string | null } | null
}

type BidBoardNotesPanelProps = {
  bid: BidBoardNotesPanelBid
  notesTab: BidBoardNotesTab
  onNotesTabChange: (tab: BidBoardNotesTab) => void
  onLoadError: (message: string) => void
  onMutated: () => void
  onMutatedCustomer?: () => void
  /** Prefix for aria ids (e.g. bid-board vs working-board) */
  idPrefix: string
}

export function BidBoardNotesPanel({
  bid,
  notesTab,
  onNotesTabChange,
  onLoadError,
  onMutated,
  onMutatedCustomer,
  idPrefix,
}: BidBoardNotesPanelProps) {
  const panelId = `${idPrefix}-notes-panel-${bid.id}`
  const mutCustomer = onMutatedCustomer ?? onMutated

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '0.75rem' }}>
        <div
          role="tablist"
          aria-label="Notes type"
          style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}
        >
        <button
          type="button"
          role="tab"
          id={`${idPrefix}-tab-all-${bid.id}`}
          aria-selected={notesTab === 'all'}
          aria-controls={panelId}
          onClick={() => onNotesTabChange('all')}
          style={{
            padding: '0.25rem 0.65rem',
            border: 'none',
            borderRight: '1px solid #d1d5db',
            background: notesTab === 'all' ? '#3b82f6' : '#ffffff',
            color: notesTab === 'all' ? '#ffffff' : '#374151',
            cursor: 'pointer',
            fontWeight: notesTab === 'all' ? 600 : 400,
            fontSize: '0.875rem',
          }}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          id={`${idPrefix}-tab-bid-${bid.id}`}
          aria-selected={notesTab === 'bid'}
          aria-controls={panelId}
          onClick={() => onNotesTabChange('bid')}
          style={{
            padding: '0.25rem 0.65rem',
            border: 'none',
            borderRight: '1px solid #d1d5db',
            background: notesTab === 'bid' ? '#3b82f6' : '#ffffff',
            color: notesTab === 'bid' ? '#ffffff' : '#374151',
            cursor: 'pointer',
            fontWeight: notesTab === 'bid' ? 600 : 400,
            fontSize: '0.875rem',
          }}
        >
          Bid
        </button>
        <button
          type="button"
          role="tab"
          id={`${idPrefix}-tab-customer-${bid.id}`}
          aria-selected={notesTab === 'customer'}
          aria-controls={panelId}
          disabled={!bid.customers?.id}
          aria-disabled={!bid.customers?.id}
          title={!bid.customers?.id ? 'No linked customer on this bid.' : undefined}
          onClick={() => {
            if (bid.customers?.id) onNotesTabChange('customer')
          }}
          style={{
            padding: '0.25rem 0.65rem',
            border: 'none',
            background: notesTab === 'customer' ? '#3b82f6' : '#ffffff',
            color: notesTab === 'customer' ? '#ffffff' : '#374151',
            cursor: !bid.customers?.id ? 'not-allowed' : 'pointer',
            fontWeight: notesTab === 'customer' ? 600 : 400,
            fontSize: '0.875rem',
            opacity: !bid.customers?.id ? 0.5 : 1,
          }}
        >
          Customer
        </button>
        </div>
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={
          notesTab === 'bid'
            ? `${idPrefix}-tab-bid-${bid.id}`
            : notesTab === 'customer'
              ? `${idPrefix}-tab-customer-${bid.id}`
              : `${idPrefix}-tab-all-${bid.id}`
        }
      >
        {notesTab === 'bid' ? (
          <BidNotesTable bidId={bid.id} title="" onLoadError={onLoadError} onMutated={onMutated} />
        ) : notesTab === 'customer' ? (
          bid.customers?.id ? (
            <CustomerNotesTable
              customerId={bid.customers.id}
              customerName={bid.customers.name ?? 'Customer'}
              title=""
              hasBidsAbove={false}
              onLoadError={onLoadError}
              onMutated={mutCustomer}
            />
          ) : (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              No linked customer — customer notes are not available for this bid.
            </p>
          )
        ) : (
          <UnifiedBidCustomerNotes
            bidId={bid.id}
            customerId={bid.customers?.id ?? null}
            customerName={bid.customers?.name ?? 'Customer'}
            title=""
            onLoadError={onLoadError}
            onMutated={mutCustomer}
          />
        )}
      </div>
    </>
  )
}
