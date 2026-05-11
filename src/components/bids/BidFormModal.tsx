import type { ChangeEvent, CSSProperties, Dispatch, FocusEvent, FormEvent, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { SearchableSelect } from '../SearchableSelect'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import type { Database } from '../../types/database'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import type { BidDateSentAttestationPayload } from '../../types/bidDateSentAttestation'
import {
  bidAttestationDisplayName,
  normalizeBidDateInput,
  wholeCalendarDaysSinceSentDate,
} from '../../lib/bidDateSentDisplay'
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import { useJobFormModal } from '../../contexts/JobFormModalContext'

type Bid = Database['public']['Tables']['bids']['Row']
type Customer = Database['public']['Tables']['customers']['Row']

type BidFormUserRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'estimator'
  | 'primary'
  | 'superintendent'

export type BidFormOutcomeOption = 'won' | 'lost' | 'started_or_complete' | ''

export type BidServiceTypeSwitchSibling = { id: string; bid_number: string | null }

export type BidFormModalProps = {
  open: boolean
  editingBid: BidWithBuilder | null
  closeBidForm: () => void
  saveBid: (e: FormEvent<HTMLFormElement>) => void
  estimatorId: string
  setEstimatorId: (value: string) => void
  estimatorUsers: EstimatorUser[]
  accountManagerId: string
  setAccountManagerId: (value: string) => void
  bidDueDate: string
  setBidDueDate: (value: string) => void
  bidNumber: string
  setBidNumber: (value: string) => void
  myRole: BidFormUserRole
  projectName: string
  setProjectName: (value: string) => void
  formServiceTypeId: string
  setFormServiceTypeId: (value: string) => void
  visibleServiceTypes: { id: string; name: string; color: string | null }[]
  outcome: BidFormOutcomeOption
  setOutcome: (value: BidFormOutcomeOption) => void
  bidDateSent: string
  handleBidDateSentInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleBidDateSentBlur: (e: FocusEvent<HTMLInputElement>) => void
  pendingAttestationForDate: string | null
  pendingBidDateSentAttestation: BidDateSentAttestationPayload | null
  lossReason: string
  setLossReason: (value: string) => void
  estimatedJobStartDate: string
  setEstimatedJobStartDate: (value: string) => void
  address: string
  setAddress: (value: string) => void
  distanceFromOffice: string
  setDistanceFromOffice: (value: string) => void
  planPages: string
  setPlanPages: (value: string) => void
  driveLink: string
  setDriveLink: (value: string) => void
  plansLink: string
  setPlansLink: (value: string) => void
  designDrawingPlanDate: string
  setDesignDrawingPlanDate: (value: string) => void
  countToolingLink: string
  setCountToolingLink: (value: string) => void
  bidSubmissionLink: string
  setBidSubmissionLink: (value: string) => void
  gcCustomerSearch: string
  setGcCustomerSearch: (value: string) => void
  gcCustomerDropdownOpen: boolean
  setGcCustomerDropdownOpen: (value: boolean) => void
  gcCustomerId: string
  setGcCustomerId: (value: string) => void
  customers: Customer[]
  loadCustomers: () => void | Promise<void>
  openNewCustomerModal?: (options?: { onCreated?: (customer: Customer | null) => void }) => void
  getCustomerDisplay: (customer: Customer) => string
  getGcBuilderPhone: () => string
  getGcBuilderEmail: () => string
  projectContactExpanded: boolean
  setProjectContactExpanded: Dispatch<SetStateAction<boolean>>
  gcContactName: string
  setGcContactName: (value: string) => void
  gcContactPhone: string
  setGcContactPhone: (value: string) => void
  gcContactEmail: string
  setGcContactEmail: (value: string) => void
  submittedTo: string
  setSubmittedTo: (value: string) => void
  bidValue: string
  setBidValue: (value: string) => void
  agreedValue: string
  setAgreedValue: (value: string) => void
  profit: string
  setProfit: (value: string) => void
  lastContact: string
  setLastContact: (value: string) => void
  notes: string
  setNotes: (value: string) => void
  saveBidAndOpenCounts: () => void
  bidFormCanSubmit: boolean
  bidFormMissingFields: string[]
  savingBid: boolean
  setDeleteBidModalOpen: (value: boolean) => void
  setDeleteConfirmProjectName: (value: string) => void
  setError: Dispatch<SetStateAction<string | null>>
  /** Hide bid from Unsent/Working surfaces (opens parent confirm). */
  onRequestArchiveFromUnsentWorking?: () => void
  showArchiveFromUnsentWorking?: boolean
  archiveFromUnsentWorkingBusy?: boolean
  /** Sibling bids keyed by `service_type_id` (same customer + project name); for “open existing” in service-type switcher. */
  serviceTypeSwitchSiblings?: Record<string, BidServiceTypeSwitchSibling[]>
  onServiceTypeSwitchModalOpen?: () => void | Promise<void>
  onDuplicateBidToServiceType?: (targetServiceTypeId: string) => Promise<void>
  onOpenExistingBidFromServiceTypeSwitch?: (bidId: string) => void
}

function serviceTypePillStyle(st: { name: string; color: string | null }): CSSProperties {
  const tag = getBidServiceTypeTag(st.name)
  if (tag) return { background: tag.color, color: '#fff' }
  if (st.color) return { background: st.color, color: '#fff' }
  return { background: '#e5e7eb', color: '#374151' }
}

export function BidFormModal(props: BidFormModalProps) {
  const jobFormModal = useJobFormModal()
  const [serviceTypeSwitchOpen, setServiceTypeSwitchOpen] = useState(false)
  const [duplicatingToServiceTypeId, setDuplicatingToServiceTypeId] = useState<string | null>(null)

  useEffect(() => {
    if (!props.open) {
      setServiceTypeSwitchOpen(false)
      setDuplicatingToServiceTypeId(null)
    }
  }, [props.open])

  useEffect(() => {
    if (!serviceTypeSwitchOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setServiceTypeSwitchOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [serviceTypeSwitchOpen])

  if (!props.open) return null
  const {
    editingBid,
    closeBidForm,
    saveBid,
    estimatorId,
    setEstimatorId,
    estimatorUsers,
    accountManagerId,
    setAccountManagerId,
    bidDueDate,
    setBidDueDate,
    bidNumber,
    setBidNumber,
    myRole,
    projectName,
    setProjectName,
    formServiceTypeId,
    setFormServiceTypeId,
    visibleServiceTypes,
    outcome,
    setOutcome,
    bidDateSent,
    handleBidDateSentInputChange,
    handleBidDateSentBlur,
    pendingAttestationForDate,
    pendingBidDateSentAttestation,
    lossReason,
    setLossReason,
    estimatedJobStartDate,
    setEstimatedJobStartDate,
    address,
    setAddress,
    distanceFromOffice,
    setDistanceFromOffice,
    planPages,
    setPlanPages,
    driveLink,
    setDriveLink,
    plansLink,
    setPlansLink,
    designDrawingPlanDate,
    setDesignDrawingPlanDate,
    countToolingLink,
    setCountToolingLink,
    bidSubmissionLink,
    setBidSubmissionLink,
    gcCustomerSearch,
    setGcCustomerSearch,
    gcCustomerDropdownOpen,
    setGcCustomerDropdownOpen,
    gcCustomerId,
    setGcCustomerId,
    customers,
    loadCustomers,
    openNewCustomerModal,
    getCustomerDisplay,
    getGcBuilderPhone,
    getGcBuilderEmail,
    projectContactExpanded,
    setProjectContactExpanded,
    gcContactName,
    setGcContactName,
    gcContactPhone,
    setGcContactPhone,
    gcContactEmail,
    setGcContactEmail,
    submittedTo,
    setSubmittedTo,
    bidValue,
    setBidValue,
    agreedValue,
    setAgreedValue,
    profit,
    setProfit,
    lastContact,
    setLastContact,
    notes,
    setNotes,
    saveBidAndOpenCounts,
    bidFormCanSubmit,
    bidFormMissingFields,
    savingBid,
    setDeleteBidModalOpen,
    setDeleteConfirmProjectName,
    setError,
    onRequestArchiveFromUnsentWorking,
    showArchiveFromUnsentWorking = false,
    archiveFromUnsentWorkingBusy = false,
    serviceTypeSwitchSiblings = {},
    onServiceTypeSwitchModalOpen,
    onDuplicateBidToServiceType,
    onOpenExistingBidFromServiceTypeSwitch,
  } = props

  const selectedServiceType = formServiceTypeId.trim()
    ? visibleServiceTypes.find((st) => st.id === formServiceTypeId)
    : undefined
  const serviceTypePillTag = selectedServiceType ? getBidServiceTypeTag(selectedServiceType.name) : null
  const otherServiceTypes = visibleServiceTypes.filter((st) => st.id !== formServiceTypeId)

  function openServiceTypeSwitch() {
    setServiceTypeSwitchOpen(true)
    void Promise.resolve(onServiceTypeSwitchModalOpen?.())
  }

  return (
        <div className="bid-form-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <style>{`
            @media (max-width: 640px) {
              .bid-form-overlay {
                align-items: stretch !important;
                justify-content: stretch !important;
              }
              .bid-form-grid-2 { grid-template-columns: 1fr !important; }
              .bid-form-grid-3 { grid-template-columns: 1fr !important; }
              .bid-form-top-fields {
                grid-template-columns: 1fr 1fr !important;
                grid-template-areas:
                  "est am"
                  "bidnum bd"
                  "proj proj" !important;
              }
              .bid-form-modal {
                padding: 1rem !important;
                width: 100% !important;
                max-width: 100% !important;
                height: 100vh !important;
                max-height: 100vh !important;
                border-radius: 0 !important;
              }
              .bid-form-modal-header {
                grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
                gap: 0.5rem !important;
              }
              .bid-form-modal-header h2 {
                font-size: 1.1rem !important;
              }
            }
          `}</style>
          <div className="bid-form-modal" style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '720px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div
              className="bid-form-modal-header"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1.5rem',
              }}
            >
              <h2 style={{ margin: 0, minWidth: 0 }}>{editingBid ? 'Edit Bid' : 'New Bid'}</h2>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {selectedServiceType ? (
                  <button
                    type="button"
                    aria-label={`Service type: ${selectedServiceType.name}. Choose another trade or copy bid.`}
                    aria-haspopup="dialog"
                    aria-expanded={serviceTypeSwitchOpen}
                    onClick={openServiceTypeSwitch}
                    style={{
                      padding: '0.1rem 0.35rem',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      borderRadius: 4,
                      maxWidth: 'min(40vw, 12rem)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      ...serviceTypePillStyle(selectedServiceType),
                    }}
                  >
                    {serviceTypePillTag ? `[${serviceTypePillTag.tag}]` : selectedServiceType.name}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeBidForm}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  cursor: 'pointer',
                  justifySelf: 'end',
                }}
              >
                Cancel
              </button>
            </div>
            <form onSubmit={saveBid}>
              <div
                className="bid-form-top-fields"
                style={{
                  display: 'grid',
                  gap: '1rem',
                  marginBottom: '1rem',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                  gridTemplateAreas: `
                    "est am bd"
                    "bidnum proj proj"
                  `,
                }}
              >
                <div style={{ gridArea: 'est' }}>
                  <label htmlFor="bid-form-estimator" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estimator</label>
                  <SearchableSelect
                    id="bid-form-estimator"
                    value={estimatorId}
                    onChange={setEstimatorId}
                    options={estimatorUsers.map((u) => ({ value: u.id, label: u.name || u.email }))}
                    emptyOption={{ value: '', label: '—' }}
                    placeholder="—"
                    listAriaLabel="Estimator"
                  />
                </div>
                <div style={{ gridArea: 'am' }}>
                  <label htmlFor="bid-form-account-man" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Account Man</label>
                  <SearchableSelect
                    id="bid-form-account-man"
                    value={accountManagerId}
                    onChange={setAccountManagerId}
                    options={estimatorUsers.map((u) => ({ value: u.id, label: u.name || u.email }))}
                    emptyOption={{ value: '', label: '—' }}
                    placeholder="—"
                    listAriaLabel="Account manager"
                  />
                </div>
                <div style={{ gridArea: 'bd' }}>
                  <label htmlFor="bid-form-bid-due-date" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Due Date</label>
                  <input id="bid-form-bid-due-date" type="date" value={bidDueDate} onChange={(e) => setBidDueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div style={{ gridArea: 'bidnum' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid #</label>
                  <input
                    type="text"
                    value={editingBid ? bidNumber : ''}
                    onChange={(e) => { if (editingBid && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant')) { setBidNumber(e.target.value); setError(null) } }}
                    placeholder={editingBid ? 'e.g. 456' : 'Auto'}
                    readOnly={!editingBid || myRole === 'estimator' || myRole === 'primary'}
                    disabled={!editingBid || myRole === 'estimator' || myRole === 'primary'}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      ...((!editingBid || myRole === 'estimator' || myRole === 'primary') && { background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }),
                    }}
                  />
                </div>
                <div style={{ gridArea: 'proj' }}>
                  <label htmlFor="bid-form-project-name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Name *</label>
                  <input
                    id="bid-form-project-name"
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value)
                      setError(null)
                    }}
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              </div>
              <div className="bid-form-service-outcome-sent-row" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label htmlFor="bid-form-service-type" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Service Type *</label>
                  <SearchableSelect
                    id="bid-form-service-type"
                    value={formServiceTypeId}
                    onChange={setFormServiceTypeId}
                    options={visibleServiceTypes.map((st) => ({ value: st.id, label: st.name }))}
                    emptyOption={{ value: '', label: 'Select service type…' }}
                    placeholder="Select service type…"
                    required
                    listAriaLabel="Service type"
                  />
                </div>
                <div style={{ flex: '0 0 auto', minWidth: 0, maxWidth: '100%' }}>
                  <label htmlFor="bid-form-win-loss" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Win/Loss</label>
                  <SearchableSelect
                    id="bid-form-win-loss"
                    value={outcome}
                    onChange={(v) => setOutcome(v as BidFormOutcomeOption)}
                    options={[
                      { value: 'won', label: 'Won' },
                      { value: 'lost', label: 'Lost' },
                      { value: 'started_or_complete', label: 'Started or Complete' },
                    ]}
                    emptyOption={{ value: '', label: '—' }}
                    placeholder="—"
                    searchable={false}
                    listAriaLabel="Win or loss"
                  />
                </div>
                <div style={{ flex: 1, minWidth: '10rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Date Sent</label>
                  <input
                    type="date"
                    value={bidDateSent}
                    onChange={handleBidDateSentInputChange}
                    onBlur={handleBidDateSentBlur}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                  {bidDateSent.trim() &&
                    (() => {
                      const dNorm = normalizeBidDateInput(bidDateSent)
                      const days = wholeCalendarDaysSinceSentDate(dNorm)
                      const serverSent = editingBid ? normalizeBidDateInput(editingBid.bid_date_sent) : ''
                      const bidRow = editingBid as Bid | null
                      const fromPending =
                        pendingAttestationForDate === dNorm && pendingBidDateSentAttestation !== null
                      const ackById = fromPending
                        ? pendingBidDateSentAttestation!.bid_date_sent_attested_by
                        : serverSent === dNorm
                          ? bidRow?.bid_date_sent_attested_by ?? null
                          : null
                      return (
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.35rem', lineHeight: 1.45 }}>
                          <div>
                            Sent {days} day{days === 1 ? '' : 's'} ago (by calendar date).
                          </div>
                          {ackById ? (
                            <div>Acknowledged by {bidAttestationDisplayName(estimatorUsers, ackById)}</div>
                          ) : dNorm && serverSent === dNorm && !fromPending ? (
                            <div style={{ color: '#b45309' }}>No attestation on file (saved before this feature).</div>
                          ) : null}
                        </div>
                      )
                    })()}
                </div>
              </div>
              {outcome === 'lost' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Why did we lose?</label>
                  <input
                    type="text"
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    placeholder="e.g. Price, schedule, competitor, no response…"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              )}
              {outcome === 'won' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Start Date</label>
                  <input type="date" value={estimatedJobStartDate} onChange={(e) => setEstimatedJobStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              )}
              <div style={{ marginBottom: '1rem', width: '100%' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Address<br />[street, town, state zip]</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12925 FM 20, Kingsbury, Texas 78638" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: '1rem',
                    alignItems: 'start',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Distance to Office (miles)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input type="number" min={0} step={0.1} value={distanceFromOffice} onChange={(e) => setDistanceFromOffice(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '8ch', maxWidth: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                      {address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: '#2563eb',
                            textDecoration: 'none',
                            cursor: 'pointer',
                          }}
                          title={`View ${address} on map`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 640 640"
                            style={{ width: '16px', height: '16px', fill: 'currentColor' }}
                          >
                            <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Plan Pages</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={planPages}
                      onChange={(e) => setPlanPages(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="e.g. 5"
                      style={{ width: '8ch', maxWidth: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Project Folder{'\u00A0'.repeat(10)}
                  bid folders:{' '}
                  <a href="https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB?usp=sharing" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB?usp=sharing') }} style={{ color: '#3b82f6' }}>
                    [plumbing]
                  </a>
                  {' '}
                  <a href="https://drive.google.com/drive/folders/10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2?usp=sharing" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2?usp=sharing') }} style={{ color: '#3b82f6' }}>
                    [electrical]
                  </a>
                  {' '}
                  <a href="https://drive.google.com/drive/folders/1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL?usp=drive_link" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL?usp=drive_link') }} style={{ color: '#3b82f6' }}>
                    [HVAC]
                  </a>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText()
                        setDriveLink(text)
                      } catch (err) {
                        console.error('Failed to read clipboard:', err)
                      }
                    }}
                    style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Paste from clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                  </button>
                </div>
              </div>
              <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Job Plans</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="url" value={plansLink} onChange={(e) => setPlansLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setPlansLink(text)
                        } catch (err) {
                          console.error('Failed to read clipboard:', err)
                        }
                      }}
                      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Paste from clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Design Drawing Plan Date</label>
                  <input type="date" value={designDrawingPlanDate} onChange={(e) => setDesignDrawingPlanDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              </div>
              <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Marked Up Plans or Cover Page</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="url" value={countToolingLink} onChange={(e) => setCountToolingLink(e.target.value)} placeholder="https://... " style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setCountToolingLink(text)
                        } catch (err) {
                          console.error('Failed to read clipboard:', err)
                        }
                      }}
                      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Paste from clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Submission</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="url" value={bidSubmissionLink} onChange={(e) => setBidSubmissionLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setBidSubmissionLink(text)
                        } catch (err) {
                          console.error('Failed to read clipboard:', err)
                        }
                      }}
                      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Paste from clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <label htmlFor="bid-form-gc-builder" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>GC/Builder (customer)</label>
                <input
                  id="bid-form-gc-builder"
                  type="text"
                  value={gcCustomerSearch}
                  onChange={(e) => {
                    const value = e.target.value
                    setGcCustomerSearch(value)
                    setGcCustomerDropdownOpen(true)
                    if (gcCustomerId) {
                      const selected = customers.find((c) => c.id === gcCustomerId)
                      if (!selected || !value || getCustomerDisplay(selected).toLowerCase() !== value.toLowerCase()) {
                        setGcCustomerId('')
                      }
                    }
                  }}
                  onFocus={() => setGcCustomerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setGcCustomerDropdownOpen(false), 200)}
                  placeholder="Search customers..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
                {gcCustomerDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      maxHeight: 200,
                      overflowY: 'auto',
                      zIndex: 100,
                      marginTop: 2,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {(myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator') && (
                      <div
                        onClick={() => {
                          openNewCustomerModal?.({
                            onCreated: (c) => {
                              void loadCustomers()
                              if (!c) return
                              setGcCustomerId(c.id)
                              setGcCustomerSearch(getCustomerDisplay(c))
                            },
                          })
                          setGcCustomerDropdownOpen(false)
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          padding: '0.5rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #e5e7eb',
                          color: '#2563eb',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white'
                        }}
                      >
                        + Add new customer
                      </div>
                    )}
                    {customers
                      .filter((c) => {
                        const searchLower = gcCustomerSearch.toLowerCase()
                        const nameLower = c.name.toLowerCase()
                        const addressLower = (c.address || '').toLowerCase()
                        return nameLower.includes(searchLower) || addressLower.includes(searchLower)
                      })
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setGcCustomerId(c.id)
                            setGcCustomerSearch(getCustomerDisplay(c))
                            setGcCustomerDropdownOpen(false)
                          }}
                          style={{
                            padding: '0.5rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f3f4f6'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white'
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          {c.address && <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{c.address}</div>}
                        </div>
                      ))}
                    {customers.filter((c) => {
                      const searchLower = gcCustomerSearch.toLowerCase()
                      return c.name.toLowerCase().includes(searchLower) || (c.address || '').toLowerCase().includes(searchLower)
                    }).length === 0 && (
                      <div style={{ padding: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>No customers found</div>
                    )}
                  </div>
                )}
              </div>
              {/* Display GC/Builder contact info (read-only) */}
              {(gcCustomerId || (editingBid?.gc_builder_id && editingBid?.bids_gc_builders)) && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#6b7280' }}>
                      GC/Builder (customer) Contact Phone
                    </label>
                    <input
                      type="text"
                      value={getGcBuilderPhone()}
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#6b7280' }}>
                      GC/Builder (customer) Contact Email
                    </label>
                    <input
                      type="text"
                      value={getGcBuilderEmail()}
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  aria-expanded={projectContactExpanded}
                  onClick={() => setProjectContactExpanded((p) => !p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: 0,
                    marginBottom: projectContactExpanded ? '0.5rem' : 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 'inherit',
                    color: 'inherit',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <span aria-hidden>{projectContactExpanded ? '\u25BC' : '\u25B6'}</span>
                  Project Contact: {gcContactName.trim() || gcContactPhone.trim() || gcContactEmail.trim() ? (gcContactName.trim() || '—') : '—'}
                </button>
                {projectContactExpanded && (
                  <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #e5e7eb' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Name</label>
                      <input type="text" value={gcContactName} onChange={(e) => setGcContactName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Phone</label>
                      <input type="tel" value={gcContactPhone} onChange={(e) => setGcContactPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Email</label>
                      <input type="email" value={gcContactEmail} onChange={(e) => setGcContactEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Submitted to (name, phone, email):</label>
                <input type="text" value={submittedTo} onChange={(e) => setSubmittedTo(e.target.value)} placeholder="e.g. Architect name, 555-123-4567, architect@example.com" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div className="bid-form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Value</label>
                  <input type="number" step="0.01" value={bidValue} onChange={(e) => setBidValue(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Agreed Value</label>
                  <input type="number" step="0.01" value={agreedValue} onChange={(e) => setAgreedValue(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Maximum Profit</label>
                  <input type="number" step="0.01" value={profit} onChange={(e) => setProfit(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Last Contact</label>
                <input type="datetime-local" value={lastContact} onChange={(e) => setLastContact(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={saveBidAndOpenCounts}
                  disabled={!bidFormCanSubmit || savingBid}
                  title={!bidFormCanSubmit ? `Required: ${bidFormMissingFields.join(', ')}` : undefined}
                  style={{ marginRight: 'auto', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Save and Open Counts
                </button>
                {editingBid && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginRight: 'auto' }}>
                    {showArchiveFromUnsentWorking && onRequestArchiveFromUnsentWorking ? (
                      <button
                        type="button"
                        onClick={() => onRequestArchiveFromUnsentWorking()}
                        disabled={archiveFromUnsentWorkingBusy || savingBid}
                        title="Hide from Working board, unsent lists, and clock quick picks (column placement kept)"
                        style={{
                          padding: '0.5rem 1rem',
                          color: '#374151',
                          background: 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          cursor: archiveFromUnsentWorkingBusy || savingBid ? 'wait' : 'pointer',
                        }}
                      >
                        {archiveFromUnsentWorkingBusy ? 'Archiving…' : 'Archive from board'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => { setDeleteBidModalOpen(true); setDeleteConfirmProjectName(''); setError(null) }}
                      style={{ padding: '0.5rem 1rem', color: '#b91c1b', background: 'white', border: '1px solid #b91c1b', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete bid
                    </button>
                  </div>
                )}
                <button type="submit" disabled={!bidFormCanSubmit || savingBid} title={!bidFormCanSubmit ? `Required: ${bidFormMissingFields.join(', ')}` : undefined} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  {savingBid ? 'Saving…' : 'Save'}
                </button>
                {!bidFormCanSubmit && !savingBid && bidFormMissingFields.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                  <span style={{ display: 'block' }}>Required:</span>
                  {bidFormMissingFields.map((f) => (
                    <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                  ))}
                </span>
                )}
              </div>
            </form>
          </div>

          {serviceTypeSwitchOpen ? (
            <div
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1002,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setServiceTypeSwitchOpen(false)
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="bid-service-type-switch-title"
                style={{
                  background: 'white',
                  padding: '1.25rem 1.5rem',
                  borderRadius: 8,
                  maxWidth: '420px',
                  width: '90%',
                  maxHeight: '85vh',
                  overflow: 'auto',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <h2 id="bid-service-type-switch-title" style={{ margin: 0, fontSize: '1.05rem' }}>
                    Copy Bid
                  </h2>
                  <button
                    type="button"
                    onClick={() => setServiceTypeSwitchOpen(false)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Close
                  </button>
                </div>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.45 }}>
                  Open an existing bid for the same customer and project name, or copy this bid’s counts and estimate data into a new bid for another service type.
                </p>
                {!editingBid ? (
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: '#b45309' }}>
                    Save the bid first to enable <strong>Copy to new … bid</strong>.
                  </p>
                ) : null}
                {otherServiceTypes.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No other service types are available for your account.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {otherServiceTypes.map((st) => {
                      const tag = getBidServiceTypeTag(st.name)
                      const labelShort = tag ? `[${tag.tag}]` : st.name
                      const siblings = serviceTypeSwitchSiblings[st.id] ?? []
                      const dupBusy = duplicatingToServiceTypeId === st.id
                      return (
                        <li
                          key={st.id}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            padding: '0.65rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                padding: '0.1rem 0.35rem',
                                fontSize: '0.6875rem',
                                fontWeight: 500,
                                borderRadius: 4,
                                ...serviceTypePillStyle(st),
                              }}
                            >
                              {labelShort}
                            </span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{st.name}</span>
                          </div>
                          {siblings.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                              {siblings.map((sib) => (
                                <button
                                  key={sib.id}
                                  type="button"
                                  onClick={() => {
                                    onOpenExistingBidFromServiceTypeSwitch?.(sib.id)
                                    setServiceTypeSwitchOpen(false)
                                  }}
                                  disabled={!onOpenExistingBidFromServiceTypeSwitch}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.8125rem',
                                    background: '#eff6ff',
                                    border: '1px solid #3b82f6',
                                    color: '#1d4ed8',
                                    borderRadius: 4,
                                    cursor: onOpenExistingBidFromServiceTypeSwitch ? 'pointer' : 'not-allowed',
                                  }}
                                >
                                  Open B{sib.bid_number?.trim() || '—'}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            disabled={!editingBid || !onDuplicateBidToServiceType || dupBusy || savingBid}
                            title={!editingBid ? 'Save this bid first' : undefined}
                            onClick={async () => {
                              if (!onDuplicateBidToServiceType || !editingBid) return
                              setDuplicatingToServiceTypeId(st.id)
                              try {
                                await onDuplicateBidToServiceType(st.id)
                                setServiceTypeSwitchOpen(false)
                              } finally {
                                setDuplicatingToServiceTypeId(null)
                              }
                            }}
                            style={{
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.8125rem',
                              alignSelf: 'flex-start',
                              background: !editingBid || !onDuplicateBidToServiceType ? '#e5e7eb' : '#3b82f6',
                              color: !editingBid || !onDuplicateBidToServiceType ? '#6b7280' : 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: !editingBid || !onDuplicateBidToServiceType ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {dupBusy ? 'Copying…' : `Copy to new ${st.name} bid`}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div
                  style={{
                    marginTop: '1.25rem',
                    paddingTop: '1.25rem',
                    borderTop: '1px solid #e5e7eb',
                  }}
                >
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9375rem', fontWeight: 600 }}>Job</h3>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.45 }}>
                    Create a new job from this bid with customer and links filled in, and the bid linked on the job.
                  </p>
                  {!editingBid ? (
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#b45309' }}>
                      Save the bid first to enable <strong>Open Job</strong>.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!editingBid || !jobFormModal}
                    title={!editingBid ? 'Save this bid first' : !jobFormModal ? 'Job form unavailable' : undefined}
                    onClick={() => {
                      if (!jobFormModal || !editingBid) return
                      setServiceTypeSwitchOpen(false)
                      jobFormModal.openNewJob({ prefillBidId: editingBid.id })
                    }}
                    style={{
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      background: !editingBid || !jobFormModal ? '#e5e7eb' : '#3b82f6',
                      color: !editingBid || !jobFormModal ? '#6b7280' : 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: !editingBid || !jobFormModal ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Open Job
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

  )
}
