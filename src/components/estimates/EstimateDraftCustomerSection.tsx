import { estInputBlock } from './estimatesPageStyles'
import { useToastContext } from '../../contexts/ToastContext'
import CustomerSearchCombobox from '../customers/CustomerSearchCombobox'
import { filterActiveCustomersForPicker } from '../../lib/customerArchive'
import { CustomerNotesTable } from '../customerNotes/CustomerNotesTable'
import {
  extractContactFromCustomer,
  type CustomerRow,
} from '../../lib/customerContactDisplay'
import type { ComponentProps, Dispatch, ReactNode, RefObject, SetStateAction } from 'react'

type NotesState = NonNullable<ComponentProps<typeof CustomerNotesTable>['contactsState']>

export interface EstimateDraftCustomerSectionProps {
  /** The box the customer gate scrolls to and focuses. */
  customerSearchSectionRef: RefObject<HTMLDivElement>
  /** The gate just asked for a customer: the box pulses. */
  customerSearchHighlight: boolean
  /** The step rail just jumped here. */
  flash: boolean
  /** The rail's numbered dot for this step. */
  stepDot: ReactNode
  customers: CustomerRow[]
  customerId: string | null
  customersLoading: boolean
  customerSearch: string
  handleCustomerSearchChange: (value: string) => void
  handleSelectCustomer: (customer: CustomerRow) => void
  setCustomerId: (id: string | null) => void
  setCustomerSearch: (text: string) => void
  setSendEmailOverride: (email: string) => void
  setForAddress: (address: string) => void
  setCreateCustomerOpen: (open: boolean) => void
  selectedCustomer: CustomerRow | undefined
  /** The picked customer's own email ('' when they have none). */
  crmEmailForSelected: string
  showSendEmailOverride: boolean
  emailOverrideRevealed: boolean
  sendEmailOverride: string
  setEmailOverrideRevealed: (revealed: boolean) => void
  sendEmailOverrideInputRef: RefObject<HTMLInputElement>
  /** The Edit customer window can be opened from here. */
  editCustomerModal: boolean
  openDraftCustomerForEdit: () => void
  /** The customer's notes. The page reads them once and keeps them across its reloads. */
  showRecentCustomerNotePreview: boolean
  customerNotesLoading: boolean
  customerNotesEntries: NotesState['entries']
  recentNotePreviewText: string | undefined
  customerNotesExpanded: boolean
  setCustomerNotesExpanded: Dispatch<SetStateAction<boolean>>
  draftNotesToggleLabel: string
  refetchCustomerNotes: NotesState['refetch']
}

/**
 * The customer on a draft estimate: the search box, and under it the picked customer's email (or the
 * Send to box when they have none), phone, the Edit customer door and their notes.
 *
 * Moved whole from `EstimateDetail` (v2.7633, punch list #46 row 3, cut 8 of the Estimates map); the
 * markup is the page's own. Every value is the page's, handed in: its reload unmounts this section, so
 * the notes, the open Send to box and the expanded notes are kept there.
 */
export default function EstimateDraftCustomerSection({
  customerSearchSectionRef,
  customerSearchHighlight,
  flash,
  stepDot,
  customers,
  customerId,
  customersLoading,
  customerSearch,
  handleCustomerSearchChange,
  handleSelectCustomer,
  setCustomerId,
  setCustomerSearch,
  setSendEmailOverride,
  setForAddress,
  setCreateCustomerOpen,
  selectedCustomer,
  crmEmailForSelected,
  showSendEmailOverride,
  emailOverrideRevealed,
  sendEmailOverride,
  setEmailOverrideRevealed,
  sendEmailOverrideInputRef,
  editCustomerModal,
  openDraftCustomerForEdit,
  showRecentCustomerNotePreview,
  customerNotesLoading,
  customerNotesEntries,
  recentNotePreviewText,
  customerNotesExpanded,
  setCustomerNotesExpanded,
  draftNotesToggleLabel,
  refetchCustomerNotes,
}: EstimateDraftCustomerSectionProps) {
  const { showToast } = useToastContext()
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginBottom: '1rem',
      }}
    >
      <div
        id="est-step-customer"
        ref={customerSearchSectionRef}
        className={
          'est-region-tint' +
          (customerSearchHighlight || flash ? ' estimate-customer-search-highlight' : '')
        }
        style={{ width: '100%', maxWidth: 480, textAlign: 'left' }}
      >
        <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>{stepDot}Customer</span>
        <CustomerSearchCombobox
          customers={filterActiveCustomersForPicker(customers, customerId)}
          loading={customersLoading}
          valueId={customerId}
          searchText={customerSearch}
          onSearchTextChange={handleCustomerSearchChange}
          onSelect={handleSelectCustomer}
          onClear={() => {
            setCustomerId(null)
            setCustomerSearch('')
            setSendEmailOverride('')
            setForAddress('')
          }}
          onRequestCreateNew={() => setCreateCustomerOpen(true)}
          placeholder="Search customers…"
        />
        {selectedCustomer && (
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.875rem',
              color: 'var(--text-700)',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-subtle)',
              borderRadius: 6,
              maxWidth: 480,
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.35rem',
                  rowGap: '0.25rem',
                }}
              >
                <strong>Email:</strong>{' '}
                {crmEmailForSelected ? (
                  <span>{crmEmailForSelected}</span>
                ) : showSendEmailOverride ? (
                  emailOverrideRevealed || sendEmailOverride.trim() ? null : (
                    <button
                      type="button"
                      aria-label="Add email for acceptance delivery"
                      onClick={() => {
                        setEmailOverrideRevealed(true)
                        queueMicrotask(() => sendEmailOverrideInputRef.current?.focus())
                      }}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-red-700)',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontSize: '0.875rem',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        maxWidth: '100%',
                        textAlign: 'left',
                      }}
                    >
                      required, click to add
                    </button>
                  )
                ) : (
                  <span>—</span>
                )}
              </div>
              {showSendEmailOverride && !crmEmailForSelected && (emailOverrideRevealed || sendEmailOverride.trim()) ? (
                <input
                  ref={sendEmailOverrideInputRef}
                  type="email"
                  autoComplete="email"
                  value={sendEmailOverride}
                  onChange={(e) => setSendEmailOverride(e.target.value)}
                  placeholder="Address for acceptance link"
                  style={estInputBlock({ marginTop: '0.35rem' })}
                />
              ) : null}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.35rem',
                marginTop: '0.35rem',
              }}
            >
              <div>
                <strong>Phone:</strong> {extractContactFromCustomer(selectedCustomer).phone.trim() || '—'}
              </div>
              {editCustomerModal && customerId ? (
                <button
                  type="button"
                  onClick={openDraftCustomerForEdit}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-link)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.875rem',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    flexShrink: 0,
                    marginLeft: 'auto',
                  }}
                >
                  Edit customer
                </button>
              ) : null}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                }}
              >
                {showRecentCustomerNotePreview ? (
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <strong>Most recent note:</strong>{' '}
                    {customerNotesLoading && customerNotesEntries.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
                    ) : (
                      <span
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}
                      >
                        {recentNotePreviewText}
                      </span>
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  aria-expanded={customerNotesExpanded}
                  onClick={() => setCustomerNotesExpanded((v) => !v)}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-link)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.875rem',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    flexShrink: 0,
                    ...(!showRecentCustomerNotePreview ? { marginLeft: 'auto' } : {}),
                  }}
                >
                  {draftNotesToggleLabel}
                </button>
              </div>
              {customerNotesExpanded && customerId ? (
                <div
                  style={{
                    marginTop: '0.75rem',
                    maxWidth: '100%',
                    minWidth: 0,
                    overflowX: 'auto',
                  }}
                >
                  <CustomerNotesTable
                    customerId={customerId}
                    customerName={selectedCustomer.name?.trim() || 'Customer'}
                    title=""
                    hasBidsAbove={false}
                    contactsState={{
                      entries: customerNotesEntries,
                      loading: customerNotesLoading,
                      refetch: refetchCustomerNotes,
                    }}
                    onLoadError={(m) => showToast(m, 'error')}
                    onMutated={() => {
                      void refetchCustomerNotes()
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
