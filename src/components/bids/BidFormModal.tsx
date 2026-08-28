import type { ChangeEvent, CSSProperties, Dispatch, FocusEvent, FormEvent, SetStateAction } from 'react'
import { suggestLossCategoryFromNote } from '../../lib/bidLossCategories'
import { BidLossCategoryChips } from './BidLossCategoryChips'
import { useEffect, useState } from 'react'
import { SearchableSelect } from '../SearchableSelect'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import type { Database } from '../../types/database'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import type { BidDateSentAttestationPayload } from '../../types/bidDateSentAttestation'
import type { BidEditForm } from '../../lib/bids/useBidEditForm'
import {
  bidAttestationDisplayName,
  normalizeBidDateInput,
  wholeCalendarDaysSinceSentDate,
} from '../../lib/bidDateSentDisplay'
import { formatProjectNumberLabel } from '../../lib/projectNumberLabel'
import { itbLinkLabel } from '../../lib/itbLinks'
import { computeBidDistanceToOffice } from '../../lib/bidDistanceToOffice'
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type Bid = Database['public']['Tables']['bids']['Row']
import { BidGcRecipientsRow, GcCard } from './BidGcRecipientsRow'
import { BidLogContactControl } from './BidLogContactControl'
import { BidGcSentPanel } from './BidGcSentPanel'
import { supabase } from '../../lib/supabase'

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
  /** Opens the go/no-go evaluate checklist (owned by Bids.tsx; renders above this modal). */
  onOpenEvaluateChecklist?: () => void
  saveBid: (e: FormEvent<HTMLFormElement>) => void
  /** Owns all editable bid-form data fields (values + setters). */
  form: BidEditForm
  /** Projects for the linked-project picker (id/name/number; empty until the lazy fetch lands). */
  projects: Array<{ id: string; name: string | null; project_number: string | null }>
  estimatorUsers: EstimatorUser[]
  myRole: BidFormUserRole
  visibleServiceTypes: { id: string; name: string; color: string | null }[]
  bidDateSent: string
  handleBidDateSentInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleBidDateSentBlur: (e: FocusEvent<HTMLInputElement>) => void
  /** v2.2407: per-GC panel just rewrote the derived roll-up — parent syncs its date state so Save can't clobber it. */
  onGcRollupDateChanged: (d: string | null) => void
  pendingAttestationForDate: string | null
  pendingBidDateSentAttestation: BidDateSentAttestationPayload | null
  gcCustomerDropdownOpen: boolean
  setGcCustomerDropdownOpen: (value: boolean) => void
  customers: Customer[]
  loadCustomers: () => void | Promise<void>
  openNewCustomerModal?: (options?: { onCreated?: (customer: Customer | null) => void }) => void
  getCustomerDisplay: (customer: Customer) => string
  getGcBuilderPhone: () => string
  getGcBuilderEmail: () => string
  saveBidAndOpenCounts: () => void
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
  /** Render as a pane inside BidWindowModal: no overlay/box chrome, no header ✕ (the window owns close). */
  embedded?: boolean
  /** Reports the service-type switcher's open state up (the window blocks Esc while it stacks above). */
  onServiceTypeSwitchOpenChange?: (open: boolean) => void
}

function serviceTypePillStyle(st: { name: string; color: string | null }): CSSProperties {
  const tag = getBidServiceTypeTag(st.name)
  if (tag) return { background: tag.color, color: '#fff' }
  if (st.color) return { background: st.color, color: '#fff' }
  return { background: 'var(--bg-200)', color: 'var(--text-700)' }
}

const FORM_SECTION_LABEL_STYLE: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  marginBottom: '0.6rem',
}

const FORM_SECTION_STYLE: CSSProperties = {
  borderTop: '1px solid var(--border)',
  paddingTop: '0.9rem',
  marginBottom: '1rem',
}

function PasteButton({ onPaste, label }: { onPaste: (text: string) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const text = await navigator.clipboard.readText()
          onPaste(text)
        } catch (err) {
          console.error('Failed to read clipboard:', err)
        }
      }}
      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      title="Paste from clipboard"
      aria-label={label}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
    </button>
  )
}

const OUTCOME_SEGMENTS: { value: BidFormOutcomeOption; label: string }[] = [
  { value: '', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'started_or_complete', label: 'Started / Complete' },
]

function outcomeSegmentSelectedStyle(value: BidFormOutcomeOption): CSSProperties {
  if (value === 'won' || value === 'started_or_complete') return { background: 'var(--bg-green-tint)', color: 'var(--text-green-600)', fontWeight: 600 }
  if (value === 'lost') return { background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', fontWeight: 600 }
  return { background: 'var(--bg-blue-tint)', color: 'var(--text-link)', fontWeight: 600 }
}

export function BidFormModal(props: BidFormModalProps) {
  const jobFormModal = useJobFormModal()
  const [serviceTypeSwitchOpen, setServiceTypeSwitchOpen] = useState(false)
  const [duplicatingToServiceTypeId, setDuplicatingToServiceTypeId] = useState<string | null>(null)
  const [dueTimeOpen, setDueTimeOpen] = useState(false)
  const [distanceAutoStatus, setDistanceAutoStatus] = useState<
    | null
    | { kind: 'busy' }
    | { kind: 'done'; source: 'routed' | 'estimate'; anchorLabel: string }
    | { kind: 'error'; message: string }
  >(null)

  useEffect(() => {
    if (!props.open) {
      setServiceTypeSwitchOpen(false)
      setDuplicatingToServiceTypeId(null)
      setDueTimeOpen(false)
      setDistanceAutoStatus(null)
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

  const onServiceTypeSwitchOpenChange = props.onServiceTypeSwitchOpenChange
  useEffect(() => {
    onServiceTypeSwitchOpenChange?.(serviceTypeSwitchOpen)
  }, [serviceTypeSwitchOpen, onServiceTypeSwitchOpenChange])

  // v2.2383 (owner-approved GC cards): the bid's GC renders as a card; the
  // search input only shows while swapping it (or before one is chosen).
  // Lives above the early return — hooks must run on every render.
  const [changingPrimary, setChangingPrimary] = useState(false)
  // v2.2407: a bid WITH versions gets the per-GC sent panel instead of the hand-typed date
  // (its bid_date_sent is a derived roll-up). Null while the count is loading.
  const [bidHasVersions, setBidHasVersions] = useState<boolean | null>(null)
  useEffect(() => {
    const id = props.editingBid?.id
    if (!id) {
      setBidHasVersions(false)
      return
    }
    setBidHasVersions(null)
    let cancelled = false
    void (async () => {
      const { count } = await supabase.from('bid_versions').select('id', { count: 'exact', head: true }).eq('bid_id', id)
      if (!cancelled) setBidHasVersions((count ?? 0) > 0)
    })()
    return () => {
      cancelled = true
    }
  }, [props.editingBid?.id])
  useEffect(() => {
    setChangingPrimary(false)
  }, [props.editingBid?.id])

  if (!props.open) return null
  const {
    editingBid,
    closeBidForm,
    onOpenEvaluateChecklist,
    saveBid,
    form,
    projects,
    estimatorUsers,
    myRole,
    visibleServiceTypes,
    bidDateSent,
    handleBidDateSentInputChange,
    handleBidDateSentBlur,
    onGcRollupDateChanged,
    pendingAttestationForDate,
    pendingBidDateSentAttestation,
    gcCustomerDropdownOpen,
    setGcCustomerDropdownOpen,
    customers,
    loadCustomers,
    openNewCustomerModal,
    getCustomerDisplay,
    getGcBuilderPhone,
    getGcBuilderEmail,
    saveBidAndOpenCounts,
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
    embedded = false,
  } = props
  const {
    driveLink,
    plansLink,
    countToolingPlansLink,
    bidSubmissionLink,
    itbLinks,
    projectName,
    projectId,
    bidNumber,
    address,
    gcContactName,
    gcContactPhone,
    gcContactEmail,
    projectContactExpanded,
    estimatorId,
    accountManagerId,
    formServiceTypeId,
    bidDueDate,
    bidDueTime,
    estimatedJobStartDate,
    designDrawingPlanDate,
    submittedTo,
    outcome,
    lossReason,
    lossCategory,
    bidValue,
    agreedValue,
    profit,
    distanceFromOffice,
    lastContact,
    notes,
    gcCustomerId,
    gcCustomerSearch,
  } = form.values
  const {
    setDriveLink,
    setPlansLink,
    setCountToolingPlansLink,
    setBidSubmissionLink,
    setItbLinks,
    setProjectName,
    setProjectId,
    setBidNumber,
    setAddress,
    setGcContactName,
    setGcContactPhone,
    setGcContactEmail,
    setProjectContactExpanded,
    setEstimatorId,
    setAccountManagerId,
    setFormServiceTypeId,
    setBidDueDate,
    setBidDueTime,
    setEstimatedJobStartDate,
    setDesignDrawingPlanDate,
    setSubmittedTo,
    setOutcome,
    setLossReason,
    setLossCategory,
    setBidValue,
    setAgreedValue,
    setProfit,
    setDistanceFromOffice,
    setLastContact,
    setNotes,
    setGcCustomerId,
    setGcCustomerSearch,
  } = form.setters
  const bidFormCanSubmit = form.canSubmit
  const bidFormMissingFields = form.missingFields

  const selectedServiceType = formServiceTypeId.trim()
    ? visibleServiceTypes.find((st) => st.id === formServiceTypeId)
    : undefined
  const serviceTypePillTag = selectedServiceType ? getBidServiceTypeTag(selectedServiceType.name) : null
  const otherServiceTypes = visibleServiceTypes.filter((st) => st.id !== formServiceTypeId)

  function openServiceTypeSwitch() {
    setServiceTypeSwitchOpen(true)
    void Promise.resolve(onServiceTypeSwitchModalOpen?.())
  }

  /** Auto-fill Distance to Office: routed Google miles, straight-line estimate as fallback. */
  function runDistanceAutoFill(force: boolean) {
    if (!address.trim()) return
    if (!force && distanceFromOffice.trim()) return
    setDistanceAutoStatus({ kind: 'busy' })
    void (async () => {
      const r = await computeBidDistanceToOffice(address)
      if (r.ok) {
        setDistanceFromOffice(r.milesText)
        setDistanceAutoStatus({ kind: 'done', source: r.source, anchorLabel: r.anchorLabel })
      } else {
        setDistanceAutoStatus({ kind: 'error', message: r.message })
      }
    })()
  }

  return (
        <div
          className={embedded ? undefined : 'bid-form-overlay'}
          style={
            embedded
              ? undefined
              : { position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
          }
        >
          <style>{`
            @media (max-width: 640px) {
              .bid-form-overlay {
                align-items: stretch !important;
                justify-content: stretch !important;
              }
              .bid-form-grid-2 { grid-template-columns: 1fr !important; }
              .bid-form-grid-3 { grid-template-columns: 1fr !important; }
              .bid-form-savebar {
                margin: 1rem -1rem -1rem !important;
                padding: 0.75rem 1rem !important;
                border-radius: 0 !important;
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
          <div
            className={embedded ? undefined : 'bid-form-modal'}
            style={
              embedded
                ? undefined
                : { background: 'var(--surface)', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '720px', width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }
            }
          >
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                <h2 style={{ margin: 0, minWidth: 0 }}>{editingBid ? 'Edit Bid' : 'New Bid'}</h2>
                {onOpenEvaluateChecklist ? (
                  <button
                    type="button"
                    onClick={onOpenEvaluateChecklist}
                    title="Go/no-go — is this bid worth pursuing?"
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 999,
                      background: 'var(--surface)',
                      color: 'var(--text-700)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    Go/no-go
                  </button>
                ) : null}
              </div>
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
              {embedded ? (
                <span />
              ) : (
                <button
                  type="button"
                  onClick={closeBidForm}
                  aria-label="Cancel"
                  title="Cancel"
                  style={{
                    padding: '0.5rem 0.7rem',
                    lineHeight: 1,
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 5,
                    cursor: 'pointer',
                    justifySelf: 'end',
                    color: 'var(--text-strong)',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <form onSubmit={saveBid}>
              <div
                className="bid-form-hero"
                style={{
                  display: 'grid',
                  gap: '1rem',
                  marginBottom: '1rem',
                  gridTemplateColumns: 'minmax(0, 1fr) 8rem',
                  alignItems: 'start',
                }}
              >
                <div>
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
                    style={{ width: '100%', padding: '0.5rem 0.6rem', fontSize: '1.15rem', fontWeight: 700, border: '1px solid var(--border-strong)', borderRadius: 5 }}
                  />
                  <div style={{ marginTop: '0.5rem' }}>
                    <label htmlFor="bid-form-linked-project" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project</label>
                    <SearchableSelect
                      id="bid-form-linked-project"
                      value={projectId}
                      onChange={setProjectId}
                      options={projects.map((p) => ({
                        value: p.id,
                        label: `${p.name ?? 'Unnamed project'}${formatProjectNumberLabel(p.project_number) ? ` — ${formatProjectNumberLabel(p.project_number)}` : ''}`,
                      }))}
                      emptyOption={{ value: '', label: 'Not linked' }}
                      placeholder="Not linked"
                      listAriaLabel="Linked project"
                    />
                    {(() => {
                      // One-tap suggestion: free-text name exactly matches a project (trim/case-insensitive).
                      if (projectId) return null
                      const needle = projectName.trim().toLowerCase()
                      if (!needle) return null
                      const match = projects.find((p) => (p.name ?? '').trim().toLowerCase() === needle)
                      if (!match) return null
                      return (
                        <button
                          type="button"
                          onClick={() => setProjectId(match.id)}
                          style={{
                            marginTop: '0.35rem',
                            padding: '0.2rem 0.6rem',
                            fontSize: '0.8125rem',
                            border: '1px dashed var(--border-sky)',
                            borderRadius: 6,
                            background: 'var(--surface)',
                            color: 'var(--text-sky-700)',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          Suggested: link to “{match.name}”
                        </button>
                      )
                    })()}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid #</label>
                  <input
                    type="text"
                    value={editingBid ? bidNumber : ''}
                    onChange={(e) => { if (editingBid && (myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole))) { setBidNumber(e.target.value); setError(null) } }}
                    placeholder={editingBid ? 'e.g. 456' : 'Auto'}
                    readOnly={!editingBid || myRole === 'estimator' || myRole === 'primary'}
                    disabled={!editingBid || myRole === 'estimator' || myRole === 'primary'}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      ...((!editingBid || myRole === 'estimator' || myRole === 'primary') && { background: 'var(--bg-muted)', color: 'var(--text-muted)', cursor: 'not-allowed' }),
                    }}
                  />
                </div>
              </div>
              <div className="bid-form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
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
                <div>
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
                <div>
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
              </div>
              <div style={FORM_SECTION_STYLE}>
                <div style={FORM_SECTION_LABEL_STYLE}>Status &amp; dates</div>
                <div className="bid-form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
                  <div>
                    <label htmlFor="bid-form-bid-due-date" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Due Date</label>
                    <input
                      id="bid-form-bid-due-date"
                      type="date"
                      value={bidDueDate}
                      onChange={(e) => {
                        setBidDueDate(e.target.value)
                        if (!e.target.value) {
                          setBidDueTime('')
                          setDueTimeOpen(false)
                        }
                      }}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                    {bidDueTime === '' && !dueTimeOpen ? (
                      <button
                        type="button"
                        onClick={() => setDueTimeOpen(true)}
                        disabled={!bidDueDate}
                        title={bidDueDate ? 'Add the time of day this bid is due' : 'Pick a due date first'}
                        style={{
                          marginTop: '0.35rem',
                          padding: 0,
                          background: 'none',
                          border: 'none',
                          fontSize: '0.8125rem',
                          color: bidDueDate ? 'var(--text-link)' : 'var(--text-faint)',
                          cursor: bidDueDate ? 'pointer' : 'default',
                        }}
                      >
                        + Add due time
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem' }}>
                        <input
                          id="bid-form-bid-due-time"
                          type="time"
                          aria-label="Bid due time"
                          value={bidDueTime}
                          onChange={(e) => setBidDueTime(e.target.value)}
                          style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                        />
                        <button
                          type="button"
                          aria-label="Remove due time"
                          title="Remove due time"
                          onClick={() => {
                            setBidDueTime('')
                            setDueTimeOpen(false)
                          }}
                          style={{
                            padding: '0.2rem 0.45rem',
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  {editingBid && bidHasVersions ? (
                    // v2.2407 (Option A): a bid with versions tracks "sent" per GC — the panel
                    // writes the same send records the Cover Letter does, and the bid-level date
                    // becomes a derived first-send roll-up (nothing hand-types it here any more).
                    <BidGcSentPanel
                      bidId={editingBid.id}
                      ownGcName={gcCustomerSearch || 'To Plans'}
                      ownGcCustomerId={editingBid.customer_id ?? null}
                      currentBidDateSent={editingBid.bid_date_sent ?? null}
                      onRollupDateChanged={onGcRollupDateChanged}
                    />
                  ) : (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Date Sent</label>
                    <input
                      type="date"
                      value={bidDateSent}
                      onChange={handleBidDateSentInputChange}
                      onBlur={handleBidDateSentBlur}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
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
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.45 }}>
                            <div>
                              Sent {days} day{days === 1 ? '' : 's'} ago (by calendar date).
                            </div>
                            {ackById ? (
                              <div>Acknowledged by {bidAttestationDisplayName(estimatorUsers, ackById)}</div>
                            ) : dNorm && serverSent === dNorm && !fromPending ? (
                              <div style={{ color: 'var(--text-amber-700)' }}>No attestation on file (saved before this feature).</div>
                            ) : null}
                          </div>
                        )
                      })()}
                  </div>
                  )}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Last Contact</label>
                    {editingBid ? (
                      // Per-GC Phase 1: a contact IS a ledger entry — the raw field is for
                      // unsaved bids only (no bid id to attach entries to yet).
                      <BidLogContactControl bidId={editingBid.id} lastContactLocal={lastContact} onLogged={setLastContact} />
                    ) : (
                      <input type="datetime-local" value={lastContact} onChange={(e) => setLastContact(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '0.9rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Win / Loss</label>
                    <div role="group" aria-label="Win or loss" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                      {OUTCOME_SEGMENTS.map((seg, i) => (
                        <button
                          key={seg.label}
                          type="button"
                          aria-pressed={outcome === seg.value}
                          onClick={() => setOutcome(seg.value)}
                          style={{
                            font: 'inherit',
                            fontSize: '0.82rem',
                            padding: '0.38rem 0.7rem',
                            border: 'none',
                            borderRight: i < OUTCOME_SEGMENTS.length - 1 ? '1px solid var(--border-strong)' : 'none',
                            cursor: 'pointer',
                            ...(outcome === seg.value
                              ? outcomeSegmentSelectedStyle(seg.value)
                              : { background: 'var(--surface)', color: 'var(--text-700)' }),
                          }}
                        >
                          {seg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {outcome === 'lost' && (
                    <div style={{ flexBasis: '100%', minWidth: '16rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Why did we lose?</label>
                      <BidLossCategoryChips
                        value={lossCategory}
                        onSelect={(key) => setLossCategory((prev) => (prev === key ? null : key))}
                        suggestedKey={suggestLossCategoryFromNote(lossReason)}
                        suggestedHint="suggested from your note — click to confirm"
                      />
                      <input
                        type="text"
                        value={lossReason}
                        onChange={(e) => setLossReason(e.target.value)}
                        placeholder="what they said (optional)"
                        aria-label="What they said"
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginTop: '0.5rem' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        {lossCategory != null
                          ? 'Recorded — this bid won’t wait in Followup → Why we lost.'
                          : 'Don’t know yet? Leave it — the bid waits in Followup → Why we lost for the GC calls.'}
                      </div>
                    </div>
                  )}
                  {outcome === 'won' && (
                    <div style={{ flex: 1, minWidth: '12rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Start Date</label>
                      <input type="date" value={estimatedJobStartDate} onChange={(e) => setEstimatedJobStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ ...FORM_SECTION_STYLE, width: '100%' }}>
                <div style={FORM_SECTION_LABEL_STYLE}>Location</div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Address <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— street, town, state zip</span></label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} onBlur={() => runDistanceAutoFill(false)} placeholder="e.g. 12925 FM 20, Kingsbury, Texas 78638" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Distance to Office (miles)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input type="number" min={0} step={0.1} value={distanceFromOffice} onChange={(e) => setDistanceFromOffice(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '8ch', maxWidth: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                      {address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'var(--text-link)',
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
                      <button
                        type="button"
                        onClick={() => runDistanceAutoFill(true)}
                        disabled={distanceAutoStatus?.kind === 'busy' || !address.trim()}
                        title={address.trim() ? 'Compute driving miles from the project address' : 'Enter the project address first'}
                        style={{
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.8125rem',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 5,
                          color: 'var(--text-700)',
                          cursor: distanceAutoStatus?.kind === 'busy' || !address.trim() ? 'default' : 'pointer',
                        }}
                      >
                        {distanceAutoStatus?.kind === 'busy' ? 'Measuring…' : '\u21BB Auto'}
                      </button>
                    </div>
                  {distanceAutoStatus && distanceAutoStatus.kind !== 'busy' ? (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: distanceAutoStatus.kind === 'error' ? 'var(--text-amber-700)' : 'var(--text-muted)', lineHeight: 1.4 }}>
                      {distanceAutoStatus.kind === 'error'
                        ? distanceAutoStatus.message
                        : distanceAutoStatus.source === 'routed'
                          ? `Driving miles via Google — from ${distanceAutoStatus.anchorLabel}`
                          : `\u2248 straight-line estimate — from ${distanceAutoStatus.anchorLabel}`}
                    </div>
                  ) : null}
                </div>
              </div>
              <div style={FORM_SECTION_STYLE}>
                <div style={FORM_SECTION_LABEL_STYLE}>Files &amp; links</div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Project Folder{'\u00A0'.repeat(10)}
                    bid folders:{' '}
                    <a href="https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB?usp=sharing" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB?usp=sharing') }} style={{ color: 'var(--text-blue-500)' }}>
                      [plumbing]
                    </a>
                    {' '}
                    <a href="https://drive.google.com/drive/folders/10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2?usp=sharing" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2?usp=sharing') }} style={{ color: 'var(--text-blue-500)' }}>
                      [electrical]
                    </a>
                    {' '}
                    <a href="https://drive.google.com/drive/folders/1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL?usp=drive_link" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL?usp=drive_link') }} style={{ color: 'var(--text-blue-500)' }}>
                      [HVAC]
                    </a>
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    <PasteButton onPaste={setDriveLink} label="Paste project folder link" />
                  </div>
                </div>
                <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Job Plans</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="url" value={plansLink} onChange={(e) => setPlansLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                      <PasteButton onPaste={setPlansLink} label="Paste job plans link" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>CountTooling Plans</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="url" value={countToolingPlansLink} onChange={(e) => setCountToolingPlansLink(e.target.value)} placeholder="https://counttooling.com/?t=... " style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                      <PasteButton onPaste={setCountToolingPlansLink} label="Paste CountTooling link" />
                    </div>
                  </div>
                </div>
                <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Submission</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="url" value={bidSubmissionLink} onChange={(e) => setBidSubmissionLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                      <PasteButton onPaste={setBidSubmissionLink} label="Paste bid submission link" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Design Drawing Plan Date</label>
                    <input type="date" value={designDrawingPlanDate} onChange={(e) => setDesignDrawingPlanDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                  </div>
                </div>
              </div>
              <div style={FORM_SECTION_STYLE}>
                <div style={FORM_SECTION_LABEL_STYLE}>People</div>
                {(() => {
                  const primaryCustomer = customers.find((c) => c.id === gcCustomerId) ?? null
                  const legacyBuilderName = !primaryCustomer && editingBid?.gc_builder_id ? editingBid?.bids_gc_builders?.name ?? null : null
                  const primaryName = primaryCustomer?.name ?? legacyBuilderName
                  if (!primaryName || changingPrimary) return null
                  return (
                    <div style={{ marginBottom: '0.45rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>GCs on this bid</label>
                      <GcCard
                        name={primaryName}
                        address={primaryCustomer?.address ?? null}
                        phone={getGcBuilderPhone()}
                        email={getGcBuilderEmail()}
                        role="primary"
                        action={
                          <button
                            type="button"
                            onClick={() => {
                              setChangingPrimary(true)
                              setGcCustomerDropdownOpen(true)
                            }}
                            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            change {'\u25b8'}
                          </button>
                        }
                      />
                    </div>
                  )
                })()}
                {(changingPrimary || !(gcCustomerId || (editingBid?.gc_builder_id && editingBid?.bids_gc_builders))) ? (
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <label htmlFor="bid-form-gc-builder" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  GC/Builder (customer)
                  {changingPrimary ? (
                    <button
                      type="button"
                      onClick={() => {
                        setChangingPrimary(false)
                        setGcCustomerDropdownOpen(false)
                      }}
                      style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.6rem' }}
                    >
                      keep current {'\u21a9'}
                    </button>
                  ) : null}
                </label>
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
                {gcCustomerDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      maxHeight: 200,
                      overflowY: 'auto',
                      zIndex: 100,
                      marginTop: 2,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {(myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole) || myRole === 'estimator') && (
                      <div
                        onClick={() => {
                          openNewCustomerModal?.({
                            onCreated: (c) => {
                              void loadCustomers()
                              if (!c) return
                              setGcCustomerId(c.id)
                              setGcCustomerSearch(getCustomerDisplay(c))
                              setChangingPrimary(false)
                            },
                          })
                          setGcCustomerDropdownOpen(false)
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          padding: '0.5rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          color: 'var(--text-link)',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-muted)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--surface)'
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
                            setChangingPrimary(false)
                          }}
                          style={{
                            padding: '0.5rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-muted)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--surface)'
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          {c.address && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.address}</div>}
                        </div>
                      ))}
                    {customers.filter((c) => {
                      const searchLower = gcCustomerSearch.toLowerCase()
                      return c.name.toLowerCase().includes(searchLower) || (c.address || '').toLowerCase().includes(searchLower)
                    }).length === 0 && (
                      <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No customers found</div>
                    )}
                  </div>
                )}
              </div>
                ) : null}
              
              <BidGcRecipientsRow
                bidId={editingBid?.id ?? null}
                bidCustomerId={gcCustomerId || editingBid?.customer_id || null}
                customers={customers}
                canEdit={myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole) || myRole === 'estimator'}
                onCreateNew={
                  (myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole) || myRole === 'estimator') && openNewCustomerModal
                    ? (onCreated) =>
                        openNewCustomerModal({
                          onCreated: (c) => {
                            void loadCustomers()
                            onCreated(c)
                          },
                        })
                    : undefined
                }
              />
              <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', alignItems: 'start' }}>
                <div>
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
                  <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--border)' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Name</label>
                      <input type="text" value={gcContactName} onChange={(e) => setGcContactName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Phone</label>
                      <input type="tel" value={gcContactPhone} onChange={(e) => setGcContactPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Email</label>
                      <input type="email" value={gcContactEmail} onChange={(e) => setGcContactEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                  </div>
                )}
              </div>
                <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Submitted to (name, phone, email):</label>
                <input type="text" value={submittedTo} onChange={(e) => setSubmittedTo(e.target.value)} placeholder="e.g. Architect name, 555-123-4567, architect@example.com" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
              </div>
              </div>
              <div style={FORM_SECTION_STYLE}>
                <div style={FORM_SECTION_LABEL_STYLE}>ITB &amp; submission links</div>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {itbLinks.map((link, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="url"
                        aria-label={`ITB link ${i + 1}`}
                        value={link}
                        onChange={(e) => setItbLinks((prev) => prev.map((l, j) => (j === i ? e.target.value : l)))}
                        placeholder="https://app.planhub.com/… or buildingconnected.com/…"
                        style={{ flex: 1, minWidth: 0, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      />
                      {link.trim() ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{itbLinkLabel(link)}</span>
                      ) : null}
                      <PasteButton onPaste={(text) => setItbLinks((prev) => prev.map((l, j) => (j === i ? text : l)))} label={`Paste ITB link ${i + 1}`} />
                      <button
                        type="button"
                        aria-label={`Remove ITB link ${i + 1}`}
                        title="Remove link"
                        onClick={() => setItbLinks((prev) => prev.filter((_, j) => j !== i))}
                        style={{ padding: '0.3rem 0.5rem', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      onClick={() => setItbLinks((prev) => [...prev, ''])}
                      style={{ padding: '0.35rem 0.7rem', fontSize: '0.82rem', background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: 5, color: 'var(--text-700)', cursor: 'pointer' }}
                    >
                      + Add ITB link
                    </button>
                  </div>
                </div>
              </div>
              <div style={FORM_SECTION_STYLE}>
                <div style={FORM_SECTION_LABEL_STYLE}>Money</div>
              <div className="bid-form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label htmlFor="bid-form-bid-value" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Value</label>
                  <input id="bid-form-bid-value" type="number" step="0.01" value={bidValue} onChange={(e) => setBidValue(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Agreed Value</label>
                  <input type="number" step="0.01" value={agreedValue} onChange={(e) => setAgreedValue(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Maximum Profit</label>
                  <input type="number" step="0.01" value={profit} onChange={(e) => setProfit(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
              </div>
              </div>
              <div style={{ ...FORM_SECTION_STYLE, marginBottom: '1.5rem' }}>
                <div style={FORM_SECTION_LABEL_STYLE}>Notes</div>
                <textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything the next person should know…" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
              </div>
              <div
                className="bid-form-savebar"
                style={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 5,
                  margin: '1.5rem -2rem -2rem',
                  padding: '0.85rem 2rem',
                  background: 'var(--surface)',
                  borderTop: '1px solid var(--border)',
                  borderRadius: '0 0 8px 8px',
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {editingBid && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setDeleteBidModalOpen(true); setDeleteConfirmProjectName(''); setError(null) }}
                      style={{ padding: '0.45rem 0.25rem', background: 'none', border: 'none', color: '#b91c1b', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      Delete bid…
                    </button>
                    {showArchiveFromUnsentWorking && onRequestArchiveFromUnsentWorking ? (
                      <button
                        type="button"
                        onClick={() => onRequestArchiveFromUnsentWorking()}
                        disabled={archiveFromUnsentWorkingBusy || savingBid}
                        title="Hide from Working board, unsent lists, and clock quick picks (column placement kept)"
                        style={{
                          padding: '0.45rem 0.7rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-700)',
                          background: 'var(--surface)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          cursor: archiveFromUnsentWorkingBusy || savingBid ? 'wait' : 'pointer',
                        }}
                      >
                        {archiveFromUnsentWorkingBusy ? 'Archiving…' : 'Archive from board'}
                      </button>
                    ) : null}
                  </>
                )}
                <span style={{ flex: 1 }} />
                {!bidFormCanSubmit && !savingBid && bidFormMissingFields.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#FF6600' }}>Required: {bidFormMissingFields.join(', ')}</span>
                )}
                <button
                  type="button"
                  onClick={saveBidAndOpenCounts}
                  disabled={!bidFormCanSubmit || savingBid}
                  title={!bidFormCanSubmit ? `Required: ${bidFormMissingFields.join(', ')}` : undefined}
                  style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Save and Open Counts
                </button>
                <button type="submit" disabled={!bidFormCanSubmit || savingBid} title={!bidFormCanSubmit ? `Required: ${bidFormMissingFields.join(', ')}` : undefined} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  {savingBid ? 'Saving…' : 'Save'}
                </button>
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
                  background: 'var(--surface)',
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
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Close
                  </button>
                </div>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  Open an existing bid for the same customer and project name, copy this bid’s counts and estimate data into a new bid for another service type, or duplicate it within the same trade.
                </p>
                {!editingBid ? (
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>
                    Save the bid first to enable <strong>Copy to new … bid</strong>.
                  </p>
                ) : null}
                {selectedServiceType ? (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0.65rem 0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '0.1rem 0.35rem',
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          borderRadius: 4,
                          ...serviceTypePillStyle(selectedServiceType),
                        }}
                      >
                        {serviceTypePillTag ? `[${serviceTypePillTag.tag}]` : selectedServiceType.name}
                      </span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{selectedServiceType.name} (this bid’s trade)</span>
                    </div>
                    <button
                      type="button"
                      disabled={!editingBid || !onDuplicateBidToServiceType || duplicatingToServiceTypeId === selectedServiceType.id || savingBid}
                      title={!editingBid ? 'Save this bid first' : undefined}
                      onClick={async () => {
                        if (!onDuplicateBidToServiceType || !editingBid) return
                        setDuplicatingToServiceTypeId(selectedServiceType.id)
                        try {
                          await onDuplicateBidToServiceType(selectedServiceType.id)
                          setServiceTypeSwitchOpen(false)
                        } finally {
                          setDuplicatingToServiceTypeId(null)
                        }
                      }}
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.8125rem',
                        alignSelf: 'flex-start',
                        background: !editingBid || !onDuplicateBidToServiceType ? 'var(--bg-200)' : '#3b82f6',
                        color: !editingBid || !onDuplicateBidToServiceType ? 'var(--text-muted)' : 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: !editingBid || !onDuplicateBidToServiceType ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {duplicatingToServiceTypeId === selectedServiceType.id
                        ? 'Duplicating…'
                        : `Duplicate this ${selectedServiceType.name} bid`}
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      Makes a same-trade copy named “{'{project}'} (copy)” with counts and estimate data.
                    </span>
                  </div>
                ) : null}
                {otherServiceTypes.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No other service types are available for your account.</p>
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
                            border: '1px solid var(--border)',
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
                                    background: 'var(--bg-blue-tint)',
                                    border: '1px solid #3b82f6',
                                    color: 'var(--text-blue-700)',
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
                              background: !editingBid || !onDuplicateBidToServiceType ? 'var(--bg-200)' : '#3b82f6',
                              color: !editingBid || !onDuplicateBidToServiceType ? 'var(--text-muted)' : 'white',
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
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9375rem', fontWeight: 600 }}>Job</h3>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Create a new job from this bid with customer and links filled in, and the bid linked on the job.
                  </p>
                  {!editingBid ? (
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>
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
                      background: !editingBid || !jobFormModal ? 'var(--bg-200)' : '#3b82f6',
                      color: !editingBid || !jobFormModal ? 'var(--text-muted)' : 'white',
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
