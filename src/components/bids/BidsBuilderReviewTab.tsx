import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { CustomerNotesTable } from '../customerNotes/CustomerNotesTable'
import { ModalShell } from './ModalShell'
import { formatBidNameWithValue, formatDateYYMMDD, formatTimeSinceLastContact } from '../../lib/bids/bidFormatting'
import { extractContactInfo } from '../../lib/bids/bidContactInfo'
import { getBidStatusLabel } from '../../lib/bids/bidStatusLabel'
import type { useNewCustomerModal } from '../../contexts/NewCustomerModalContext'
import type { useEditCustomerModal } from '../../contexts/EditCustomerModalContext'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerContact = Database['public']['Tables']['customer_contacts']['Row']
type CustomerContactPerson = Database['public']['Tables']['customer_contact_persons']['Row']

type BidsBuilderReviewTabProps = {
  bids: BidWithBuilder[]
  customers: Customer[]
  customerContacts: CustomerContact[]
  customerContactPersons: CustomerContactPerson[]
  lastContactFromEntries: Record<string, string>
  authUser: { id: string } | null
  narrowViewport640: boolean
  deepLinkHighlightCustomerId: string | null
  deepLinkHighlightGen: number
  onLoadCustomers: () => void
  onReloadCustomerContacts: () => void
  onReloadContactPersons: () => void
  onReloadBids: () => void
  onError: (msg: string | null) => void
  onEditBid: (bid: BidWithBuilder) => void
  onNewBidWithCustomer: (c: Customer) => void
  onViewSubmissions: (bid: BidWithBuilder) => void
  onSetCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
  newCustomerModal: ReturnType<typeof useNewCustomerModal> | null
  editCustomerModal: ReturnType<typeof useEditCustomerModal> | null
}

export function BidsBuilderReviewTab({
  bids,
  customers,
  customerContacts,
  customerContactPersons,
  lastContactFromEntries,
  authUser,
  narrowViewport640,
  deepLinkHighlightCustomerId,
  deepLinkHighlightGen,
  onLoadCustomers,
  onReloadCustomerContacts,
  onReloadContactPersons,
  onReloadBids,
  onError,
  onEditBid,
  onNewBidWithCustomer,
  onViewSubmissions,
  onSetCustomers,
  newCustomerModal,
  editCustomerModal,
}: BidsBuilderReviewTabProps) {
  const [addContactPersonModalCustomer, setAddContactPersonModalCustomer] = useState<Customer | null>(null)
  const [editingContactPerson, setEditingContactPerson] = useState<CustomerContactPerson | null>(null)
  const [contactPersonName, setContactPersonName] = useState('')
  const [contactPersonPhones, setContactPersonPhones] = useState<string[]>([''])
  const [contactPersonEmail, setContactPersonEmail] = useState('')
  const [contactPersonNote, setContactPersonNote] = useState('')
  const [savingContactPerson, setSavingContactPerson] = useState(false)
  const [builderReviewSectionOpen, setBuilderReviewSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [builderReviewCardExpanded, setBuilderReviewCardExpanded] = useState<Record<string, boolean>>({})
  const [builderReviewSearchQuery, setBuilderReviewSearchQuery] = useState('')
  const [builderReviewSortOrder, setBuilderReviewSortOrder] = useState<'oldest-first' | 'newest-first'>('oldest-first')
  const [builderReviewPiaCustomerIds, setBuilderReviewPiaCustomerIds] = useState<Set<string>>(() => new Set())

  // Builder Review PIA: load from localStorage (per user)
  useEffect(() => {
    if (!authUser?.id || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(`bids_builder_review_pia_${authUser.id}`)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) setBuilderReviewPiaCustomerIds(new Set(arr))
      }
    } catch {
      // ignore parse errors
    }
  }, [authUser?.id])

  function toggleBuilderReviewSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    setBuilderReviewSectionOpen((prev: typeof builderReviewSectionOpen) => ({ ...prev, [key]: !prev[key] }))
  }
  function toggleBuilderReviewCard(customerId: string) {
    setBuilderReviewCardExpanded((prev) => ({ ...prev, [customerId]: !(prev[customerId] !== false) }))
  }

  const builderReviewCustomersSorted = useMemo(() => {
    function getLastContactForCustomer(customerId: string): string | null {
      const customerBids = bids.filter((b) => b.customer_id === customerId)
      const customerContactDates = customerContacts.filter((c: CustomerContact) => c.customer_id === customerId).map((c: CustomerContact) => c.contact_date)
      const dates: string[] = [...customerContactDates]
      for (const bid of customerBids) {
        if (bid.last_contact) dates.push(bid.last_contact)
        const entryDate = lastContactFromEntries[bid.id]
        if (entryDate) dates.push(entryDate)
      }
      if (dates.length === 0) return null
      return dates.reduce((a, b) => (new Date(b) > new Date(a) ? b : a))
    }
    const asc = builderReviewSortOrder === 'oldest-first'
    return [...customers].sort((a, b) => {
      const aDate = getLastContactForCustomer(a.id)
      const bDate = getLastContactForCustomer(b.id)
      if (!aDate && !bDate) return a.name.localeCompare(b.name)
      if (!aDate) return 1
      if (!bDate) return -1
      return asc ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate)
    })
  }, [customers, bids, customerContacts, lastContactFromEntries, builderReviewSortOrder])

  const builderReviewCustomersFiltered = useMemo(() => {
    let list = builderReviewCustomersSorted
    // When Oldest first: exclude PIA customers (they are ignored in the sort order)
    if (builderReviewSortOrder === 'oldest-first' && builderReviewPiaCustomerIds.size > 0) {
      list = list.filter((c) => !builderReviewPiaCustomerIds.has(c.id))
    }
    if (!builderReviewSearchQuery.trim()) return list
    const q = builderReviewSearchQuery.toLowerCase().trim()
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address?.toLowerCase().includes(q) ?? false)
    )
  }, [builderReviewCustomersSorted, builderReviewSearchQuery, builderReviewSortOrder, builderReviewPiaCustomerIds])

  // When Oldest first: PIA customers that were excluded (for showing in "PIA (excluded)" section)
  const builderReviewPiaCustomersExcluded = useMemo(() => {
    if (builderReviewSortOrder !== 'oldest-first' || builderReviewPiaCustomerIds.size === 0) return []
    let list = builderReviewCustomersSorted.filter((c) => builderReviewPiaCustomerIds.has(c.id))
    if (builderReviewSearchQuery.trim()) {
      const q = builderReviewSearchQuery.toLowerCase().trim()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.address?.toLowerCase().includes(q) ?? false)
      )
    }
    return list
  }, [builderReviewCustomersSorted, builderReviewSearchQuery, builderReviewSortOrder, builderReviewPiaCustomerIds])

  // Deep-link: when the parent's highlight signal changes to a customer, clear the
  // search, expand that card, and scroll it into view. The parent owns the highlight
  // styling state + its auto-clear timeout (controlled prop).
  useEffect(() => {
    const customerId = deepLinkHighlightCustomerId
    if (!customerId) return
    setBuilderReviewSearchQuery('')
    setBuilderReviewCardExpanded((prev) => ({ ...prev, [customerId]: true }))
    const t = window.setTimeout(() => {
      document.getElementById(`builder-review-customer-${customerId}`)?.scrollIntoView({ behavior: 'auto', block: 'center' })
    }, 175)
    return () => window.clearTimeout(t)
  }, [deepLinkHighlightGen, deepLinkHighlightCustomerId])

  function renderBuilderReviewContactPersonsBlock(customer: Customer, containerStyle: CSSProperties) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Contact persons</div>
        {customerContactPersons
          .filter((cp) => cp.customer_id === customer.id)
          .map((cp) => (
            <div key={cp.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.25rem' }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{cp.name}</div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContactPerson(cp)
                      setAddContactPersonModalCustomer(customer)
                      setContactPersonName(cp.name)
                      const phones = (cp.phone ?? '').split('\n').filter(Boolean)
                      setContactPersonPhones(phones.length > 0 ? phones : [''])
                      setContactPersonEmail(cp.email ?? '')
                      setContactPersonNote(cp.note ?? '')
                    }}
                    title="Edit"
                    style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="12" height="12" fill="currentColor"><path d="M416 128L512 224L192 544L96 544L96 448L416 128zM444 64L544 64L576 96L576 196L544 228L444 196L444 64zM128 480L176 480L496 160L448 112L128 432L128 480z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Delete this contact?')) return
                      await supabase.from('customer_contact_persons').delete().eq('id', cp.id)
                      onReloadContactPersons()
                    }}
                    title="Delete"
                    style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-red-700)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="12" height="12" fill="currentColor"><path d="M160 128H96V96H256V64H160V128zM288 64V96H544V128H480V512C480 547.3 451.3 576 416 576H224C188.7 576 160 547.3 160 512V128H96V512C96 569.4 142.6 616 200 616H440C497.4 616 544 569.4 544 512V128H288V64zM224 128H416V512H224V128zM288 192V480H352V192H288zM416 192V480H480V192H416z" /></svg>
                  </button>
                </div>
              </div>
              {(cp.phone ?? '').split('\n').filter(Boolean).map((phone, i) => (
                <a key={i} href={`tel:${phone}`} style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none', display: 'block' }}>{phone}</a>
              ))}
              {cp.email && (
                <a href={`mailto:${cp.email}`} style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none', display: 'block' }}>{cp.email}</a>
              )}
              {cp.note && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>{cp.note}</div>
              )}
            </div>
          ))}
        {customerContactPersons.filter((cp) => cp.customer_id === customer.id).length === 0 && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No contacts yet</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => newCustomerModal?.openNewCustomerModal({ onCreated: onLoadCustomers })}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            New Customer
          </button>
          <input
            type="text"
            placeholder="Search builders..."
            value={builderReviewSearchQuery}
            onChange={(e) => setBuilderReviewSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={() => setBuilderReviewSortOrder((prev) => (prev === 'oldest-first' ? 'newest-first' : 'oldest-first'))}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-strong)',
              background: builderReviewSortOrder === 'oldest-first' ? 'var(--bg-muted)' : 'var(--bg-blue-tint)',
              color: builderReviewSortOrder === 'oldest-first' ? 'var(--text-700)' : 'var(--text-blue-500)',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {builderReviewSortOrder === 'oldest-first' ? 'Oldest first' : 'Newest first'}
          </button>
          <button
            type="button"
            onClick={() => setBuilderReviewCardExpanded(Object.fromEntries(builderReviewCustomersFiltered.map((c) => [c.id, false])))}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={() => setBuilderReviewCardExpanded({})}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            Expand all
          </button>
        </div>
        <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Sorted by last contact. Add outreach not tied to bids via General contact. PIA = ignore when Oldest first.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {builderReviewCustomersFiltered.map((customer) => {
            const customerBids = bids.filter((b) => b.customer_id === customer.id)
            const brUnsent = customerBids.filter((b) => !b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
            const brPending = customerBids.filter((b) => b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
            const brWon = customerBids.filter((b) => b.outcome === 'won')
            const brStartedOrComplete = customerBids.filter((b) => b.outcome === 'started_or_complete')
            const brLost = customerBids.filter((b) => b.outcome === 'lost')
            const hasBids = customerBids.length > 0
            const lastContact = (() => {
              const dates: string[] = customerContacts.filter((c: CustomerContact) => c.customer_id === customer.id).map((c: CustomerContact) => c.contact_date)
              for (const bid of customerBids) {
                if (bid.last_contact) dates.push(bid.last_contact)
                const ed = lastContactFromEntries[bid.id]
                if (ed) dates.push(ed)
              }
              if (dates.length === 0) return null
              return dates.reduce((a, b) => (new Date(b) > new Date(a) ? b : a))
            })()
            const isCardExpanded = builderReviewCardExpanded[customer.id] !== false
            const builderReviewOutcomeSections = hasBids ? (
              <div>
                {[
                  { key: 'unsent' as const, label: 'Unsent', bids: brUnsent },
                  { key: 'pending' as const, label: 'Not yet won or lost', bids: brPending },
                  { key: 'won' as const, label: 'Won', bids: brWon },
                  { key: 'startedOrComplete' as const, label: 'Started or Complete', bids: brStartedOrComplete },
                  { key: 'lost' as const, label: 'Lost', bids: brLost },
                ].map(({ key, label, bids: sectionBids }) => (
                  <div key={key}>
                    <button
                      type="button"
                      onClick={() => toggleBuilderReviewSection(key)}
                      style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <span>{builderReviewSectionOpen[key] ? '\u25BC' : '\u25B6'}</span>
                      {label} ({sectionBids.length})
                    </button>
                    {builderReviewSectionOpen[key] && sectionBids.length > 0 && (
                      <ul style={{ margin: '0.25rem 0 0.5rem 1.5rem', padding: 0, listStyle: 'none' }}>
                        {sectionBids.map((bid) => (
                          <li key={bid.id} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => onEditBid(bid)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left', fontSize: '0.875rem' }}
                            >
                              {formatBidNameWithValue(bid)}
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewSubmissions(bid)}
                              title="View submissions"
                              style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
                              </svg>
                            </button>
                            {' — '}
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                              due {formatDateYYMMDD(bid.bid_due_date)}, {getBidStatusLabel(bid)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : null
            const builderReviewGeneralContactTable = (
              <CustomerNotesTable
                customerId={customer.id}
                customerName={customer.name}
                onMutated={() => { onReloadCustomerContacts(); onReloadBids() }}
                onLoadError={(m) => onError(m)}
                title="General contact"
                hasBidsAbove={hasBids}
              />
            )
            return (
              <div
                key={customer.id}
                id={`builder-review-customer-${customer.id}`}
                data-deeplink-gen={customer.id === deepLinkHighlightCustomerId ? deepLinkHighlightGen : undefined}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'var(--surface)',
                  ...(customer.id === deepLinkHighlightCustomerId
                    ? {
                        backgroundColor: 'var(--bg-amber-tint)',
                        outline: '2px solid #d97706',
                        outlineOffset: -2,
                        transition: 'background-color 0.25s ease, outline-color 0.25s ease',
                      }
                    : {}),
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleBuilderReviewCard(customer.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBuilderReviewCard(customer.id) } }}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    background: 'var(--bg-subtle)',
                    borderBottom: isCardExpanded ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} aria-hidden>{isCardExpanded ? '\u25BC' : '\u25B6'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div>
                        <strong>{customer.name}</strong>
                        {customer.address && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{customer.address}</span>}
                      </div>
                      {customer.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', textDecoration: 'none', cursor: 'pointer' }}
                          title={`View ${customer.address} on map`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                            <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                          </svg>
                        </a>
                      )}
                      {(() => {
                        const contactInfo = extractContactInfo(customer.contact_info ?? null)
                        const phone = contactInfo.phone?.trim()
                        const email = contactInfo.email?.trim()
                        return (
                          <>
                            {phone && (
                              <a
                                href={`tel:${phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', textDecoration: 'none', cursor: 'pointer' }}
                                title={`Call ${phone}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                                  <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z" />
                                </svg>
                              </a>
                            )}
                            {email && (
                              <a
                                href={`mailto:${email}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', textDecoration: 'none', cursor: 'pointer' }}
                                title={`Email ${email}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                                  <path d="M320 128C214 128 128 214 128 320C128 426 214 512 320 512C337.7 512 352 526.3 352 544C352 561.7 337.7 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320L576 352C576 405 533 448 480 448C450.7 448 424.4 434.8 406.8 414.1C384 435.1 353.5 448 320 448C249.3 448 192 390.7 192 320C192 249.3 249.3 192 320 192C347.9 192 373.7 200.9 394.7 216.1C400.4 211.1 407.8 208 416 208C433.7 208 448 222.3 448 240L448 352C448 369.7 462.3 384 480 384C497.7 384 512 369.7 512 352L512 320C512 214 426 128 320 128zM384 320C384 284.7 355.3 256 320 256C284.7 256 256 284.7 256 320C256 355.3 284.7 384 320 384C355.3 384 384 355.3 384 320z" />
                                </svg>
                              </a>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Ignore when Oldest first is selected">
                      <input
                        type="checkbox"
                        checked={builderReviewPiaCustomerIds.has(customer.id)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setBuilderReviewPiaCustomerIds((prev) => {
                            const next = new Set(prev)
                            if (checked) next.add(customer.id)
                            else next.delete(customer.id)
                            if (authUser?.id && typeof window !== 'undefined') {
                              localStorage.setItem(`bids_builder_review_pia_${authUser.id}`, JSON.stringify([...next]))
                            }
                            return next
                          })
                        }}
                      />
                      PIA
                    </label>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Last contact: {lastContact ? formatTimeSinceLastContact(lastContact) : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAddContactPersonModalCustomer(customer)
                        setEditingContactPerson(null)
                        setContactPersonName('')
                        setContactPersonPhones([''])
                        setContactPersonEmail('')
                        setContactPersonNote('')
                      }}
                      title="Add contact person"
                      style={{ padding: '0.375rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M160 64C124.7 64 96 92.7 96 128L96 512C96 547.3 124.7 576 160 576L448 576C483.3 576 512 547.3 512 512L512 128C512 92.7 483.3 64 448 64L160 64zM272 352L336 352C380.2 352 416 387.8 416 432C416 440.8 408.8 448 400 448L208 448C199.2 448 192 440.8 192 432C192 387.8 227.8 352 272 352zM248 256C248 225.1 273.1 200 304 200C334.9 200 360 225.1 360 256C360 286.9 334.9 312 304 312C273.1 312 248 286.9 248 256zM576 144C576 135.2 568.8 128 560 128C551.2 128 544 135.2 544 144L544 208C544 216.8 551.2 224 560 224C568.8 224 576 216.8 576 208L576 144zM576 272C576 263.2 568.8 256 560 256C551.2 256 544 263.2 544 272L544 336C544 344.8 551.2 352 560 352C568.8 352 576 344.8 576 336L576 272zM560 384C551.2 384 544 391.2 544 400L544 464C544 472.8 551.2 480 560 480C568.8 480 576 472.8 576 464L576 400C576 391.2 568.8 384 560 384z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onNewBidWithCustomer(customer) }}
                      title="New Bid"
                      style={{ padding: '0.375rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 500 }}
                    >
                      <span style={{ lineHeight: 1 }}>+</span>
                      New Bid
                    </button>
                  </div>
                </div>
                {isCardExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: narrowViewport640 ? 'column' : 'row',
                        gap: narrowViewport640 ? '1rem' : '1.5rem',
                        padding: '0.75rem 1.25rem',
                      }}
                    >
                      {narrowViewport640 ? (
                        <>
                          {builderReviewOutcomeSections ? (
                            <div style={{ flex: 1, minWidth: 0 }}>{builderReviewOutcomeSections}</div>
                          ) : null}
                          {renderBuilderReviewContactPersonsBlock(customer, { width: '100%', minWidth: 0 })}
                          {builderReviewGeneralContactTable}
                        </>
                      ) : (
                        <>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {builderReviewOutcomeSections}
                            {builderReviewGeneralContactTable}
                          </div>
                          {renderBuilderReviewContactPersonsBlock(customer, { width: 220, flexShrink: 0 })}
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-page)' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          editCustomerModal?.openEditCustomerModal(customer.id, {
                            onSaved: onLoadCustomers,
                            onDeleted: (id) => onSetCustomers((prev) => prev.filter((c) => c.id !== id)),
                            onMerged: ({ removedId }) =>
                              queueMicrotask(() => onSetCustomers((prev) => prev.filter((c) => c.id !== removedId))),
                          })
                        }}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: 'var(--bg-muted)',
                          color: 'var(--text-700)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Edit Customer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {builderReviewPiaCustomersExcluded.length > 0 && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>PIA (excluded from Oldest first)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {builderReviewPiaCustomersExcluded.map((customer) => (
                  <label key={customer.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked
                      onChange={() => {
                        setBuilderReviewPiaCustomerIds((prev) => {
                          const next = new Set(prev)
                          next.delete(customer.id)
                          if (authUser?.id && typeof window !== 'undefined') {
                            localStorage.setItem(`bids_builder_review_pia_${authUser.id}`, JSON.stringify([...next]))
                          }
                          return next
                        })
                      }}
                    />
                    {customer.name}
                    {customer.address && <span style={{ color: 'var(--text-muted)' }}>{customer.address}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {addContactPersonModalCustomer && (
        <ModalShell zIndex={1001} cardStyle={{ background: 'var(--surface)', padding: '1.5rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
              {editingContactPerson ? 'Edit contact person' : 'Add contact person'} – {addContactPersonModalCustomer.name}
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-name" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
              <input
                id="contact-person-name"
                type="text"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                placeholder="Name"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone{contactPersonPhones.length > 1 ? 's' : ''}</label>
              {contactPersonPhones.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.35rem', marginBottom: i < contactPersonPhones.length - 1 ? '0.35rem' : 0 }}>
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => setContactPersonPhones((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder="Phone"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                  <button
                    type="button"
                    onClick={() => setContactPersonPhones((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                    title="Remove phone"
                    style={{ padding: '0.5rem', background: 'var(--bg-red-tint)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', color: 'var(--text-red-800)', flexShrink: 0 }}
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setContactPersonPhones((prev) => [...prev, ''])}
                style={{ marginTop: '0.35rem', padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                + Add phone
              </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label>
              <input
                id="contact-person-email"
                type="email"
                value={contactPersonEmail}
                onChange={(e) => setContactPersonEmail(e.target.value)}
                placeholder="Email"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-note" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Note</label>
              <textarea
                id="contact-person-note"
                value={contactPersonNote}
                onChange={(e) => setContactPersonNote(e.target.value)}
                placeholder="Note"
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setAddContactPersonModalCustomer(null)
                  setEditingContactPerson(null)
                  setContactPersonName('')
                  setContactPersonPhones([''])
                  setContactPersonEmail('')
                  setContactPersonNote('')
                }}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingContactPerson || !contactPersonName.trim()}
                onClick={async () => {
                  if (!addContactPersonModalCustomer || !contactPersonName.trim()) return
                  setSavingContactPerson(true)
                  const phoneVal = contactPersonPhones.map((p) => p.trim()).filter(Boolean).join('\n') || null
                  if (editingContactPerson) {
                    const { error: err } = await supabase
                      .from('customer_contact_persons')
                      .update({
                        name: contactPersonName.trim(),
                        phone: phoneVal,
                        email: contactPersonEmail.trim() || null,
                        note: contactPersonNote.trim() || null,
                      })
                      .eq('id', editingContactPerson.id)
                    setSavingContactPerson(false)
                    if (err) {
                      onError(`Failed to update contact: ${err.message}`)
                      return
                    }
                  } else {
                    const { error: err } = await supabase
                      .from('customer_contact_persons')
                      .insert({
                        customer_id: addContactPersonModalCustomer.id,
                        name: contactPersonName.trim(),
                        phone: phoneVal,
                        email: contactPersonEmail.trim() || null,
                        note: contactPersonNote.trim() || null,
                      })
                    setSavingContactPerson(false)
                    if (err) {
                      onError(`Failed to save contact: ${err.message}`)
                      return
                    }
                  }
                  onReloadContactPersons()
                  setAddContactPersonModalCustomer(null)
                  setEditingContactPerson(null)
                  setContactPersonName('')
                  setContactPersonPhones([''])
                  setContactPersonEmail('')
                  setContactPersonNote('')
                }}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingContactPerson ? 'not-allowed' : 'pointer' }}
              >
                {savingContactPerson ? 'Saving…' : 'Save'}
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  )
}
