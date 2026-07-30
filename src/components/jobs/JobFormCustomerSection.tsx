import { useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { filterActiveCustomersForPicker } from '../../lib/customerArchive'
import {
  customerListImpliesLinkedRow,
  customerTypeShortLabel,
  extractContactFromCustomer,
  getCustomerDisplay,
} from '../../lib/jobs/jobFormCustomerDisplay'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

type JobFormCustomerSectionProps = {
  /** Shell-owned: applyEditJob's highlight gates force-expand it. */
  expanded: boolean
  setExpanded: Dispatch<SetStateAction<boolean>>
  customerId: string | null
  setCustomerId: (v: string | null) => void
  /** Shell-owned: the create/link-similar handlers and the customerId sync effect also write it. */
  customerSearch: string
  setCustomerSearch: (v: string) => void
  customerName: string
  setCustomerName: (v: string) => void
  customerEmail: string
  setCustomerEmail: (v: string) => void
  customerPhone: string
  setCustomerPhone: (v: string) => void
  dateMet: string
  setDateMet: (v: string) => void
  googleDriveLink: string
  setGoogleDriveLink: (v: string) => void
  jobPicturesLink: string
  setJobPicturesLink: (v: string) => void
  /** Picker fills the job address only when it is still blank. */
  jobAddress: string
  setJobAddress: (v: string) => void
  customers: CustomerRow[]
  customersLoading: boolean
  /** The job's effective master for the "Not in Customers" chip heuristic. */
  masterForFormCustomer: string
  billingCustomerHighlight: boolean
  jobPicturesLinkHighlight: boolean
  /** Shell-owned refs — the highlight scroll/focus effects live in the shell. */
  billingCustomerHighlightRef: MutableRefObject<HTMLDivElement | null>
  jobPicturesLinkHighlightRef: MutableRefObject<HTMLDivElement | null>
  jobPicturesLinkInputRef: MutableRefObject<HTMLInputElement | null>
  googleDriveInputRef: MutableRefObject<HTMLInputElement | null>
  /** Shell handler: clipboard → parseCustomerImport → name/address/email/phone fields. */
  onImport: () => void
  onOpenCreateCustomerModal: () => void
}

/**
 * The collapsible Customer block of the New/Edit Job modal: header row with
 * the "Not in Customers" chip + clipboard Import; body with the
 * Link-to-customer search (billing-highlight wrapper), Create-customer /
 * Clear-link buttons, Customer Name/Phone/Email, Date Met (locked when the
 * linked customer already has one), Customer Files, and Customer Pictures
 * (highlight + focus target). All customer form fields are shell state
 * (controlled props) — the prefill appliers, project-implies-customer, and
 * the create/link-similar handlers write them from the shell. Only the
 * dropdown-open flag lives here.
 */
export function JobFormCustomerSection({
  expanded,
  setExpanded,
  customerId,
  setCustomerId,
  customerSearch,
  setCustomerSearch,
  customerName,
  setCustomerName,
  customerEmail,
  setCustomerEmail,
  customerPhone,
  setCustomerPhone,
  dateMet,
  setDateMet,
  googleDriveLink,
  setGoogleDriveLink,
  jobPicturesLink,
  setJobPicturesLink,
  jobAddress,
  setJobAddress,
  customers,
  customersLoading,
  masterForFormCustomer,
  billingCustomerHighlight,
  jobPicturesLinkHighlight,
  billingCustomerHighlightRef,
  jobPicturesLinkHighlightRef,
  jobPicturesLinkInputRef,
  googleDriveInputRef,
  onImport,
  onOpenCreateCustomerModal,
}: JobFormCustomerSectionProps) {
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: expanded ? '0.5rem' : 0 }}>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((p) => !p)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 'inherit',
            color: 'inherit',
            flex: 1,
            textAlign: 'left',
            minWidth: 0,
          }}
        >
          {/* Match Project | Plans | Bid row: fixed chevron slot + same gap as job-form-project-files-plans-trigger */}
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '1.25rem',
              flexShrink: 0,
            }}
          >
            {expanded ? '▼' : '▶'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', minWidth: 0 }}>
            Customer: {customerName.trim() || customerEmail.trim() || customerPhone.trim() ? (customerName.trim() || '—') : '—'}
            {(() => {
              const showFormNotInCustomers =
                !!(customerName.trim() || customerEmail.trim() || customerPhone.trim()) &&
                !customerId &&
                !customerListImpliesLinkedRow(customers, masterForFormCustomer, customerName)
              return showFormNotInCustomers ? (
                <span
                  style={{
                    padding: '0.15rem 0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    background: 'var(--bg-amber-100)',
                    color: 'var(--text-amber-800)',
                    borderRadius: 4,
                  }}
                >
                  Not in Customers
                </span>
              ) : null
            })()}
          </span>
        </button>
        {expanded && (
          <button
            type="button"
            onClick={onImport}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-subtle)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Import
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--border)' }}>
          <div
            ref={billingCustomerHighlightRef}
            style={{
              marginBottom: '0.75rem',
              position: 'relative',
              ...(billingCustomerHighlight
                ? {
                    padding: '0.75rem',
                    borderRadius: 8,
                    background: 'var(--bg-red-tint)',
                    border: '2px solid #fecaca',
                  }
                : {}),
            }}
          >
            {billingCustomerHighlight ? (
              <p
                role="status"
                aria-live="polite"
                style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#991b1c' }}
              >
                Link a customer before sending this invoice.
              </p>
            ) : null}
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Link to customer</label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                const value = e.target.value
                setCustomerSearch(value)
                setCustomerDropdownOpen(true)
                if (customerId) {
                  const selected = customers.find((c) => c.id === customerId)
                  if (!selected || !value || getCustomerDisplay(selected).toLowerCase() !== value.toLowerCase()) {
                    setCustomerId(null)
                  }
                }
              }}
              onFocus={() => setCustomerDropdownOpen(true)}
              onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
              placeholder="Search customers (residential & commercial)…"
              aria-label="Search customers to link, residential and commercial"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            {customerDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  maxHeight: 180,
                  overflowY: 'auto',
                  zIndex: 100,
                  marginTop: 2,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                {customersLoading ? (
                  <div style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Loading…</div>
                ) : (
                  (() => {
                    const q = customerSearch.toLowerCase()
                    // Archived customers can't be linked to new/edited jobs; the
                    // currently-linked one stays selectable (keepId) so editing an
                    // existing link keeps working.
                    const filtered = filterActiveCustomersForPicker(customers, customerId).filter((c) =>
                      (c.name || '').toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)
                    )
                    return (
                      <>
                        {filtered.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id)
                          setCustomerSearch(getCustomerDisplay(c))
                          setCustomerName(c.name)
                          setCustomerEmail(extractContactFromCustomer(c).email)
                          setCustomerPhone(extractContactFromCustomer(c).phone)
                          setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
                          if (!jobAddress.trim()) setJobAddress(c.address ?? '')
                          setCustomerDropdownOpen(false)
                        }}
                        style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500 }}>{c.name}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            {customerTypeShortLabel(c)}
                          </span>
                        </div>
                        {c.address && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.address}</div>}
                      </div>
                        ))}
                        {filtered.length === 0 && (
                          <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No customers found</div>
                        )}
                      </>
                    )
                  })()
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {!customerId && (
                <button
                  type="button"
                  disabled={!customerName.trim()}
                  onClick={onOpenCreateCustomerModal}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    background: !customerName.trim() ? 'var(--bg-muted)' : 'var(--bg-subtle)',
                    borderRadius: 4,
                    cursor: !customerName.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  Create customer from job
                </button>
              )}
              {customerId && (
                <button
                  type="button"
                  onClick={() => { setCustomerId(null); setCustomerSearch(''); setDateMet('') }}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  Clear link
                </button>
              )}
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Name</label>
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Phone</label>
            <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Email</label>
            <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
              Date Met
              {customerId && customers.find((c) => c.id === customerId)?.date_met && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(edit in Customers)</span>
              )}
            </label>
            <input
              type="date"
              value={dateMet}
              onChange={(e) => setDateMet(e.target.value)}
              disabled={!!(customerId && customers.find((c) => c.id === customerId)?.date_met)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: customerId && customers.find((c) => c.id === customerId)?.date_met ? 'var(--bg-subtle)' : 'var(--surface)',
                color: customerId && customers.find((c) => c.id === customerId)?.date_met ? 'var(--text-muted)' : 'inherit',
                cursor: customerId && customers.find((c) => c.id === customerId)?.date_met ? 'not-allowed' : 'text',
              }}
            />
          </div>
          <div style={{ marginBottom: 0 }}>
            <label htmlFor="job-form-customer-job-files" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
              Customer Files
            </label>
            <input
              id="job-form-customer-job-files"
              ref={googleDriveInputRef}
              type="url"
              value={googleDriveLink}
              onChange={(e) => setGoogleDriveLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            <a
              href="https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault()
                openInExternalBrowser('https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link')
              }}
              style={{ fontSize: '0.8125rem', color: 'var(--text-link)', marginTop: 4, display: 'inline-block' }}
            >
              customer and job folders
            </a>
          </div>
          <div
            ref={jobPicturesLinkHighlightRef}
            style={{
              marginBottom: 0,
              borderRadius: 8,
              ...(jobPicturesLinkHighlight
                ? {
                    padding: '0.75rem',
                    background: 'var(--bg-blue-tint)',
                    border: '2px solid #93c5fd',
                  }
                : {}),
            }}
          >
            <label htmlFor="job-form-customer-job-pictures" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
              Customer Pictures
            </label>
            <input
              id="job-form-customer-job-pictures"
              ref={jobPicturesLinkInputRef}
              type="url"
              value={jobPicturesLink}
              onChange={(e) => setJobPicturesLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            <a
              href="https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault()
                openInExternalBrowser('https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link')
              }}
              style={{ fontSize: '0.8125rem', color: 'var(--text-link)', marginTop: 4, display: 'inline-block' }}
            >
              customer and job folders
            </a>
          </div>
        </div>
      )}
    </>
  )
}
