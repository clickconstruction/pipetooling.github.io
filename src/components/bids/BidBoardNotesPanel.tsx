import { useEffect, useState } from 'react'
import { BidNotesTable } from '../bidNotes/BidNotesTable'
import { CustomerNotesTable } from '../customerNotes/CustomerNotesTable'
import {
  UnifiedBidCustomerNotes,
  UnifiedBidCustomerNotesActionButtons,
  type UnifiedNotesAddingKind,
} from '../bidBoard/UnifiedBidCustomerNotes'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { BidBoardFieldReportsList } from './BidBoardFieldReportsList'

export type BidBoardNotesTab = 'all' | 'bid' | 'customer' | 'reports'

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
  const narrow = useNarrowViewport640()
  const previewDesktopSplit = idPrefix === 'bid-preview' && !narrow
  const [unifiedAddingKind, setUnifiedAddingKind] = useState<UnifiedNotesAddingKind>(null)

  useEffect(() => {
    setUnifiedAddingKind(null)
  }, [notesTab, bid.id])

  const tablist = (
    <div
      role="tablist"
      aria-label="Notes type"
      style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}
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
          borderRight: '1px solid var(--border-strong)',
          background: notesTab === 'all' ? '#3b82f6' : 'var(--surface)',
          color: notesTab === 'all' ? '#ffffff' : 'var(--text-700)',
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
          borderRight: '1px solid var(--border-strong)',
          background: notesTab === 'bid' ? '#3b82f6' : 'var(--surface)',
          color: notesTab === 'bid' ? '#ffffff' : 'var(--text-700)',
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
          borderRight: '1px solid var(--border-strong)',
          background: notesTab === 'customer' ? '#16a34a' : 'var(--surface)',
          color: notesTab === 'customer' ? '#ffffff' : 'var(--text-700)',
          cursor: !bid.customers?.id ? 'not-allowed' : 'pointer',
          fontWeight: notesTab === 'customer' ? 600 : 400,
          fontSize: '0.875rem',
          opacity: !bid.customers?.id ? 0.5 : 1,
        }}
      >
        Customer
      </button>
      <button
        type="button"
        role="tab"
        id={`${idPrefix}-tab-reports-${bid.id}`}
        aria-selected={notesTab === 'reports'}
        aria-controls={panelId}
        onClick={() => onNotesTabChange('reports')}
        style={{
          padding: '0.25rem 0.65rem',
          border: 'none',
          background: notesTab === 'reports' ? '#3b82f6' : 'var(--surface)',
          color: notesTab === 'reports' ? '#ffffff' : 'var(--text-700)',
          cursor: 'pointer',
          fontWeight: notesTab === 'reports' ? 600 : 400,
          fontSize: '0.875rem',
        }}
      >
        Reports
      </button>
    </div>
  )

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: previewDesktopSplit ? 'row' : 'column',
          alignItems: previewDesktopSplit ? 'center' : 'stretch',
          gap: '0.75rem',
          marginBottom: '0.75rem',
          width: '100%',
        }}
      >
        {previewDesktopSplit && notesTab === 'all' ? (
          <UnifiedBidCustomerNotesActionButtons
            addingKind={unifiedAddingKind}
            onAddingKindChange={setUnifiedAddingKind}
            customerId={bid.customers?.id ?? null}
            customerName={bid.customers?.name ?? 'Customer'}
          />
        ) : null}
        <div
          style={{
            display: 'flex',
            justifyContent: previewDesktopSplit ? 'flex-end' : 'center',
            flex: previewDesktopSplit ? '1 1 auto' : undefined,
            width: previewDesktopSplit ? undefined : '100%',
            minWidth: 0,
          }}
        >
          {tablist}
        </div>
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={
          notesTab === 'all'
            ? `${idPrefix}-tab-all-${bid.id}`
            : notesTab === 'bid'
              ? `${idPrefix}-tab-bid-${bid.id}`
              : notesTab === 'customer'
                ? `${idPrefix}-tab-customer-${bid.id}`
                : `${idPrefix}-tab-reports-${bid.id}`
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
              useBidBoardCustomerChrome
            />
          ) : (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No linked customer — customer notes are not available for this bid.
            </p>
          )
        ) : notesTab === 'reports' ? (
          <BidBoardFieldReportsList bidId={bid.id} onLoadError={onLoadError} />
        ) : (
          <UnifiedBidCustomerNotes
            bidId={bid.id}
            customerId={bid.customers?.id ?? null}
            customerName={bid.customers?.name ?? 'Customer'}
            title=""
            onLoadError={onLoadError}
            onMutated={mutCustomer}
            {...(previewDesktopSplit
              ? {
                  addingKind: unifiedAddingKind,
                  onAddingKindChange: setUnifiedAddingKind,
                  hideActionButtons: true,
                }
              : {})}
          />
        )}
      </div>
    </>
  )
}
