import { useCallback, useEffect, useRef, useState } from 'react'
import { scrollWhenVisible } from '../../lib/scrollWhenVisible'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { extractContactFromCustomer } from '../../lib/jobs/jobFormCustomerDisplay'
import { resolveCreateCustomerName } from '../../lib/jobs/jobFormCreateCustomerName'
import { parseAccountManRelationship } from '../../lib/jobs/accountMan'
import {
  accountManRowValue,
  customerRowSummary,
  dateMetRowAgo,
  dateMetRowValue,
  folderRowLinks,
  teamRowValue,
} from '../../lib/jobs/jobFormFactRows'
import AccountManIcon from '../icons/AccountManIcon'
import CustomerContactCardIcon from '../icons/CustomerContactCardIcon'
import CustomerPortalGlobeButton from '../customers/CustomerPortalGlobeButton'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import TeamCrewIcon from '../icons/TeamCrewIcon'
import { customerAddressLienReady, suggestCustomerAddressForJob } from '../../lib/jobs/lienProperty'
import { JobFormFactRow } from './JobFormFactRow'
import { JobFormBillToPartyControl } from './JobFormBillToPartyControl'
import { JobFormBillCopyRecipientsControl, useBillCopyContacts } from './JobFormBillCopyRecipientsControl'
import { billsAlsoGoToSummary, type BillCopyOtherParty } from '../../lib/jobs/billCopyRecipients'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { normalizePropertyKind, propertyKindPatch } from '../../lib/jobs/propertyKind'
import { savePropertyHomestead, savePropertyKind } from '../../lib/jobs/propertyKindWrite'
import PropertyKindSwitch from './PropertyKindSwitch'
import { customerBillingEmail, type JobBillToParty } from '../../lib/jobs/billToParty'
import JobContractStrip from './JobContractStrip'
import JobWorkOrderStrip from './JobWorkOrderStrip'
import JobFormPropertyAddSheet from './JobFormPropertyAddSheet'
import JobFormOwnerLookupBox from './JobFormOwnerLookupBox'
import type { CustomerAddressRow } from '../../lib/jobs/lienProperty'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { JobFormAccountManSection } from './JobFormAccountManSection'
import { JobFormPeoplePicker } from './JobFormPeoplePicker'
import {
  CustomerAndJobFoldersLink,
  JobFormCustomerLinkPicker,
  JobFormGcPicker,
} from './JobFormCustomerSection'
import {
  JobFormBidEditor,
  JobFormDevelopmentEditor,
  JobFormProjectEditor,
} from './JobFormLinksSection'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobFormBidLinkTitle, type JobFormLinkedBidSummary } from '../../lib/jobs/jobFormBidLinkTitle'
import { developmentPickerOptions, type JobFormDevelopmentRow } from '../../lib/jobs/jobDevelopments'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

type RowKey =
  | 'accountMan'
  | 'show-other-party'
  | 'team'
  | 'customer'
  | 'phone'
  | 'email'
  | 'property-record'
  | 'gc'
  | 'dateMet'
  | 'folders'
  | 'project'
  | 'plans'
  | 'bid'
  | 'development'
  | 'bill-to-party'
  | 'bill-copies'
  | 'gc-billing-email'

/**
 * Phone/Email hold the job's copy of the linked customer's contact info, so
 * their labels indent by exactly the Customer row's icon width (12px) — the
 * flex gap supplies the rest — reading as children of Customer (v2.1693).
 */
const CUSTOMER_SUBROW_INDENT = <span aria-hidden style={{ width: 12, flexShrink: 0 }} />

const fieldInputStyle = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  boxSizing: 'border-box' as const,
  fontSize: '0.875rem',
}

type JobFormEditFactRowsProps = {
  /** Contract Desk PR 3: when set, a read-only Contract row (chip + send / view record) follows the customer rows. */
  contractJob?: JobWithDetails | null
  /** Work Orders tab PR 3: a Sub work order row under Contract — chip + the door into the assembler. */
  workOrderJob?: JobWithDetails | null
  workOrderAuthUserId?: string | undefined
  users: Array<{ id: string; name: string }>
  teamMemberIds: string[]
  setTeamMemberIds: Dispatch<SetStateAction<string[]>>
  accountManagerUserId: string | null
  setAccountManagerUserId: (v: string | null) => void
  accountManagerRelationship: string | null
  setAccountManagerRelationship: (v: string) => void
  customerId: string | null
  setCustomerId: (v: string | null) => void
  gcCustomerId: string | null
  setGcCustomerId: (v: string | null) => void
  /** Who pays (v2.3345) — the "Bills go to" row; identity autosave slice. */
  billToParty: JobBillToParty
  setBillToParty: (v: JobBillToParty) => void
  /** Bills also go to (v2.3358) — the other party is copied on every bill; identity autosave slice. */
  billCopyOtherParty: boolean
  setBillCopyOtherParty: (v: boolean) => void
  /** Share this bill (v2.3376): the job's memory for "Show it on <other party>'s statement" — written directly here and by Bill Customer, never through the autosave slice. Null id = a job not saved yet (no row to remember on). */
  jobId: string | null
  showBillsToOtherParty: boolean
  /** The GC's billing email is saved straight to customers; the shell mirrors the patch into its list. */
  onCustomerPatched: (id: string, patch: Partial<CustomerRow>) => void
  linkedBidGc: { id: string; name: string } | null
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
  jobAddress: string
  setJobAddress: (v: string) => void
  /** Property record link (v2.2638): the customer_addresses row this job sits at. */
  customerAddressId: string | null
  setCustomerAddressId: (v: string | null) => void
  /** v2.3401: the job address saved as a property on the customer (or the GC when there is no customer) — the shell appends it to the candidates and links the job. */
  onPropertyAdded: (row: CustomerAddressRow) => void
  /** Owner of record (PR 2): Use on the row's Found box confirmed (or created) this row — the shell upserts it into the candidates and links the job. */
  onOwnerConfirmed: (row: CustomerAddressRow) => void
  /** The GC's name for the add-as-property line when the property's home is the GC (no customer on the job). */
  gcCustomerName?: string | null
  propertyCandidates: Array<{
    id: string
    customer_id: string | null
    address: string
    county: string
    legal_description: string
    owner_name: string
    owner_company: string
    owner_mailing_address: string
    /** Owner of record (v2.3447); absent on older callers = unknown, the box loads it. */
    owner_confirmed_at?: string | null
    /** Residential or not (v2.3667); absent on older callers = the row shows no kind control. */
    property_kind?: string | null
    homestead?: boolean | null
  }>
  /** Open the Property record row and flash its kind control — the lien screens' door (v2.3667). */
  propertyRecordFocus?: boolean
  /** Open on this row, expanded, scrolled to and ringed for a moment (v2.3697) — the Lien desk lands here from a plain value on the notice. */
  focusRow?: 'gc' | null
  /** After the kind (or its Homestead tick) is saved on the property — the parent patches its candidates. */
  onPropertyKindSaved?: (customerAddressId: string, patch: { property_kind?: string; homestead?: boolean }) => void
  customers: CustomerRow[]
  customersLoading: boolean
  masterForFormCustomer: string
  /** Shell gate (applyEditJob): when true the Customer row starts/goes open. */
  customerExpandedGate: boolean
  billingCustomerHighlight: boolean
  jobPicturesLinkHighlight: boolean
  billingCustomerHighlightRef: MutableRefObject<HTMLDivElement | null>
  jobPicturesLinkHighlightRef: MutableRefObject<HTMLDivElement | null>
  jobPicturesLinkInputRef: MutableRefObject<HTMLInputElement | null>
  googleDriveInputRef: MutableRefObject<HTMLInputElement | null>
  onImport: () => void
  onOpenCreateCustomerModal: () => void
  projectId: string | null
  setProjectId: (v: string | null) => void
  projects: Array<{ id: string; name: string; customer_id: string; customers: { name: string } | null }>
  jobPlansLink: string
  setJobPlansLink: (v: string) => void
  bidId: string | null
  setBidId: (v: string | null) => void
  linkedBidSummary: JobFormLinkedBidSummary | null
  setLinkedBidSummary: (v: JobFormLinkedBidSummary | null) => void
  onOpenBidLinkChoice: () => void
  /** Shell-owned: the project-link modal's onLinked focuses it after linking. */
  projectDisconnectRef: MutableRefObject<HTMLButtonElement | null>
  developmentId: string | null
  setDevelopmentId: (v: string | null) => void
  developments: JobFormDevelopmentRow[]
  onCreateDevelopment: (name: string) => Promise<string | null>
  /** Shell gate (project-link modal onLinked): when true the Project row goes open. */
  projectLinksGate: boolean
}

/**
 * The Edit-tab fact rows (v2.1681, "option C"): Account man / Team / Customer
 * / Phone / Email / GC / Date met / Folders read as a settings-style list —
 * label, current value, pencil. Opening a row reveals the classic editor for
 * that field (the same shared pickers the New Job form uses), so behavior is
 * unchanged; only the resting presentation is compressed. Renders in edit
 * mode only — the New Job form keeps the classic always-open form, since
 * first entry is typing-first.
 */
export function JobFormEditFactRows(props: JobFormEditFactRowsProps) {
  const {
    users,
    teamMemberIds,
    setTeamMemberIds,
    accountManagerUserId,
    setAccountManagerUserId,
    accountManagerRelationship,
    setAccountManagerRelationship,
    customerId,
    setCustomerId,
    gcCustomerId,
    setGcCustomerId,
    billToParty,
    setBillToParty,
    billCopyOtherParty,
    jobId,
    showBillsToOtherParty,
    setBillCopyOtherParty,
    onCustomerPatched,
    linkedBidGc,
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
    customerAddressId,
    setCustomerAddressId,
    onPropertyAdded,
    onOwnerConfirmed,
    gcCustomerName,
    propertyCandidates,
    propertyRecordFocus = false,
    focusRow = null,
    onPropertyKindSaved,
    customers,
    customersLoading,
    masterForFormCustomer,
    customerExpandedGate,
    billingCustomerHighlight,
    jobPicturesLinkHighlight,
    billingCustomerHighlightRef,
    jobPicturesLinkHighlightRef,
    jobPicturesLinkInputRef,
    googleDriveInputRef,
    onImport,
    onOpenCreateCustomerModal,
    projectId,
    setProjectId,
    projects,
    jobPlansLink,
    setJobPlansLink,
    bidId,
    setBidId,
    linkedBidSummary,
    setLinkedBidSummary,
    onOpenBidLinkChoice,
    projectDisconnectRef,
    developmentId,
    setDevelopmentId,
    developments,
    onCreateDevelopment,
    projectLinksGate,
  } = props

  const prefixMap = useLedgerPrefixMap()

  const [openRows, setOpenRows] = useState<Set<RowKey>>(() => new Set(customerExpandedGate ? ['customer'] : []))
  /** v2.3401: the add-as-property sheet is open under the Property record row. */
  const [addingProperty, setAddingProperty] = useState(false)
  /** The roll found an owner that is not saved yet (v2.3666) — the Property record row says so. */
  const [ownerSuggestion, setOwnerSuggestion] = useState(false)
  const toggleRow = useCallback((key: RowKey) => {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const openRow = useCallback((key: RowKey) => {
    setOpenRows((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
  }, [])

  // Guided gates force the matching row open so the shell's scroll/focus
  // effects find their highlight refs mounted.
  useEffect(() => {
    if (billingCustomerHighlight || customerExpandedGate) openRow('customer')
  }, [billingCustomerHighlight, customerExpandedGate, openRow])
  useEffect(() => {
    if (jobPicturesLinkHighlight) openRow('folders')
  }, [jobPicturesLinkHighlight, openRow])
  useEffect(() => {
    if (projectLinksGate) openRow('project')
  }, [projectLinksGate, openRow])
  // The lien screens' property-kind door (v2.3667): the row opens, scrolls into view and its kind block flashes.
  const propertyKindRef = useRef<HTMLDivElement | null>(null)
  const propertyRowAnchorRef = useRef<HTMLDivElement | null>(null)
  const propertyKindScrolledRef = useRef(false)
  const [propertyKindFlash, setPropertyKindFlash] = useState(propertyRecordFocus)
  // A row the Lien desk sent us to (v2.3697): open it, scroll to it, ring it for four seconds.
  const [rowFlash, setRowFlash] = useState<'gc' | null>(focusRow)
  const focusRowAnchorRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!focusRow) return
    openRow(focusRow)
    const cancel = scrollWhenVisible(() => focusRowAnchorRef.current?.nextElementSibling as HTMLElement | null, { block: 'center' })
    const calm = window.setTimeout(() => setRowFlash(null), 4500)
    return () => {
      cancel()
      window.clearTimeout(calm)
    }
  }, [focusRow, openRow])
  const [propertyKindBusy, setPropertyKindBusy] = useState(false)
  useEffect(() => {
    if (!propertyRecordFocus) return
    openRow('property-record')
    // No saved property linked: the kind block never mounts — land on the row itself.
    const fallback = window.setTimeout(() => {
      if (!propertyKindScrolledRef.current) propertyRowAnchorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }, 1500)
    const calm = window.setTimeout(() => setPropertyKindFlash(false), 4000)
    return () => {
      window.clearTimeout(fallback)
      window.clearTimeout(calm)
    }
  }, [propertyRecordFocus, openRow])
  // The properties load after the window mounts, so the scroll waits for the block itself.
  const propertyKindBlockRef = useCallback(
    (el: HTMLDivElement | null) => {
      propertyKindRef.current = el
      if (!el || !propertyRecordFocus || propertyKindScrolledRef.current) return
      propertyKindScrolledRef.current = true
      window.setTimeout(() => el.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 150)
    },
    [propertyRecordFocus],
  )

  const accountManValue = accountManRowValue(users, accountManagerUserId, accountManagerRelationship)
  const onlyCommunicator =
    accountManValue != null && (parseAccountManRelationship(accountManagerRelationship) ?? 'primary') === 'only'
  const teamValue = teamRowValue(users, teamMemberIds)
  const customerSummary = customerRowSummary({
    customers,
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    masterUserId: masterForFormCustomer,
  })
  const folders = folderRowLinks(googleDriveLink, jobPicturesLink)
  const dateMetValue = dateMetRowValue(dateMet)
  const dateMetAgo = dateMetRowAgo(dateMet)
  const gcCustomer = gcCustomerId ? customers.find((c) => c.id === gcCustomerId) : undefined
  const gcContact = gcCustomer ? extractContactFromCustomer(gcCustomer) : null
  const gcBillingEmail = gcCustomer ? customerBillingEmail(gcCustomer) : ''
  const gcDistinct = Boolean(gcCustomerId) && gcCustomerId !== customerId
  // Bills also go to (v2.3358): the copy list hangs off the PAYER — the GC's
  // people when the GC pays, else the customer's — and the other party is
  // offered as a one-tick copy (none on a split job: each draft picks there).
  const copyPayerId = billToParty === 'gc' && gcDistinct ? gcCustomerId : customerId
  const copyPayerName = billToParty === 'gc' && gcDistinct ? (gcCustomer?.name ?? '').trim() || 'the GC' : customerName.trim() || 'the customer'
  const copyPayerEmail = (billToParty === 'gc' && gcDistinct ? gcBillingEmail || (gcContact?.email ?? '').trim() : customerEmail.trim()).toLowerCase()
  const copyOtherPartyRaw: BillCopyOtherParty | null =
    !gcDistinct || billToParty === 'split'
      ? null
      : billToParty === 'gc'
        ? { name: customerName.trim() || 'the customer', email: customerEmail.trim(), role: 'customer' }
        : { name: (gcCustomer?.name ?? '').trim() || 'the GC', email: gcBillingEmail || (gcContact?.email ?? '').trim(), role: 'gc' }
  // The same address on both rows (a GC entered under its AP inbox twice) is not a second recipient.
  const copyOtherParty = copyOtherPartyRaw && copyOtherPartyRaw.email.toLowerCase() === copyPayerEmail ? null : copyOtherPartyRaw
  const billCopy = useBillCopyContacts(copyPayerId)
  // Share this bill (v2.3376): the job remembers whether the other party is shown
  // its next bills. Optimistic; a refused write puts the tick back and says why.
  const { showToast: showShareToast } = useToastContext()
  const [showOther, setShowOther] = useState(showBillsToOtherParty)
  useEffect(() => setShowOther(showBillsToOtherParty), [showBillsToOtherParty, jobId])
  const shareOtherName = !gcDistinct ? null : billToParty === 'gc' ? customerName.trim() || 'the customer' : (gcCustomer?.name ?? '').trim() || 'the GC'
  async function saveShowOther(on: boolean) {
    if (!jobId) return
    setShowOther(on)
    const { error } = await supabase.from('jobs_ledger').update({ show_bills_to_other_party: on }).eq('id', jobId)
    if (error) {
      setShowOther(!on)
      showShareToast(`Could not save who sees the bills: ${error.message}`, 'error')
    }
  }
  const [gcBillingEmailDraft, setGcBillingEmailDraft] = useState('')
  const [gcBillingEmailSaving, setGcBillingEmailSaving] = useState(false)
  const [gcBillingEmailError, setGcBillingEmailError] = useState<string | null>(null)
  useEffect(() => {
    setGcBillingEmailDraft((gcCustomer?.billing_email ?? '').trim())
    setGcBillingEmailError(null)
  }, [gcCustomer?.id, gcCustomer?.billing_email])
  async function saveGcBillingEmail() {
    if (!gcCustomer || gcBillingEmailSaving) return
    const next = gcBillingEmailDraft.trim()
    if (next && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setGcBillingEmailError('Enter a valid email address.')
      return
    }
    setGcBillingEmailSaving(true)
    setGcBillingEmailError(null)
    const { error } = await supabase.from('customers').update({ billing_email: next || null }).eq('id', gcCustomer.id)
    setGcBillingEmailSaving(false)
    if (error) {
      setGcBillingEmailError(error.message)
      return
    }
    onCustomerPatched(gcCustomer.id, { billing_email: next || null })
    toggleRow('gc-billing-email')
  }
  const gcDateMetYmd = gcCustomer?.date_met ? (gcCustomer.date_met.split('T')[0] ?? '') : ''
  const gcDateMetAgo = dateMetRowAgo(gcDateMetYmd)
  const dateMetCustomer = customerId ? customers.find((c) => c.id === customerId) : undefined
  const dateMetLocked = !!dateMetCustomer?.date_met
  /** v2.1698: the date came from the first clock session (v2.1696), not a person. */
  const dateMetFromClock = dateMetLocked && dateMetCustomer?.date_met_source === 'clock'

  const createCustomerName = resolveCreateCustomerName({ customerName, customerSearch, customerId })

  const warnChipStyle = {
    padding: '0.1rem 0.4rem',
    fontSize: '0.6875rem',
    fontWeight: 500,
    borderRadius: 999,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
    background: 'var(--bg-amber-100)',
    color: 'var(--text-amber-800)',
  }

  /**
   * Tap-to-call / tap-to-email (owner call, v2.1705): the displayed number or
   * address IS the link. stopPropagation so tapping it doesn't also open the
   * row's editor; no preventDefault — the tel:/mailto: proceeds natively.
   */
  const contactLink = (kind: 'tel' | 'mailto', raw: string) => (
    <a
      href={kind === 'tel' ? `tel:${raw.replace(/[^+\d]/g, '')}` : `mailto:${raw.trim()}`}
      onClick={(e) => e.stopPropagation()}
      style={{ color: 'var(--text-link)', textDecoration: 'none' }}
    >
      {raw.trim()}
    </a>
  )

  const folderLink = (label: string, url: string) => (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        openInExternalBrowser(url)
      }}
      style={{ color: 'var(--text-link)', fontSize: '0.875rem', flexShrink: 0 }}
    >
      {label}
    </a>
  )

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0 0.6rem',
        background: 'var(--surface)',
      }}
    >
      <JobFormFactRow
        label="Account man"
        labelIcon={<AccountManIcon size={13} />}
        value={
          accountManValue != null ? (
            onlyCommunicator ? (
              <span style={{ color: 'var(--text-red-700)', fontWeight: 500 }}>{accountManValue}</span>
            ) : (
              accountManValue
            )
          ) : null
        }
        expanded={openRows.has('accountMan')}
        onToggle={() => toggleRow('accountMan')}
      >
        <JobFormAccountManSection
          bare
          users={users}
          teamMemberIds={teamMemberIds}
          accountManagerUserId={accountManagerUserId}
          setAccountManagerUserId={setAccountManagerUserId}
          accountManagerRelationship={accountManagerRelationship}
          setAccountManagerRelationship={setAccountManagerRelationship}
        />
      </JobFormFactRow>
      <JobFormFactRow
        label="Team"
        labelIcon={<TeamCrewIcon size={12} style={{ flexShrink: 0 }} />}
        value={teamValue}
        expanded={openRows.has('team')}
        onToggle={() => toggleRow('team')}
      >
        <JobFormPeoplePicker bare users={users} teamMemberIds={teamMemberIds} setTeamMemberIds={setTeamMemberIds} />
      </JobFormFactRow>
      {/* Folders sit above the customer block (owner call, v2.1702) — the
          Drive links are what crews reach for most. */}
      <JobFormFactRow
        label="Folders"
        value={null}
        valueTail={
          folders.files || folders.pictures ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              {folders.files ? folderLink('Files', folders.files) : null}
              {folders.files && folders.pictures ? <span style={{ color: 'var(--text-faint)' }}>·</span> : null}
              {folders.pictures ? folderLink('Pictures', folders.pictures) : null}
            </span>
          ) : null
        }
        expanded={openRows.has('folders')}
        onToggle={() => toggleRow('folders')}
      >
        <div style={{ marginBottom: '0.6rem' }}>
          <label htmlFor="job-form-customer-job-files" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
            Customer Files
          </label>
          <input
            id="job-form-customer-job-files"
            ref={googleDriveInputRef}
            type="url"
            value={googleDriveLink}
            onChange={(e) => setGoogleDriveLink(e.target.value)}
            placeholder="https://drive.google.com/..."
            style={fieldInputStyle}
          />
        </div>
        <div
          ref={jobPicturesLinkHighlightRef}
          style={{
            borderRadius: 8,
            ...(jobPicturesLinkHighlight
              ? { padding: '0.75rem', background: 'var(--bg-blue-tint)', border: '2px solid #93c5fd' }
              : {}),
          }}
        >
          <label htmlFor="job-form-customer-job-pictures" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
            Customer Pictures
          </label>
          <input
            id="job-form-customer-job-pictures"
            ref={jobPicturesLinkInputRef}
            type="url"
            value={jobPicturesLink}
            onChange={(e) => setJobPicturesLink(e.target.value)}
            placeholder="https://drive.google.com/..."
            style={fieldInputStyle}
          />
        </div>
        <CustomerAndJobFoldersLink />
      </JobFormFactRow>
      <JobFormFactRow
        label="Customer"
        labelIcon={<CustomerContactCardIcon size={12} style={{ flexShrink: 0 }} />}
        value={
          customerSummary != null ? (
            <>
              {customerSummary.name}
              {/* 🌐 portal link (portal train PR 4) — office-only. */}
              {customerId ? (
                <CustomerPortalGlobeButton customerId={customerId} customerName={customerSummary.name} size={13} />
              ) : null}
              {customerSummary.address ? (
                <span style={{ color: 'var(--text-muted)' }}>{` · ${customerSummary.address}`}</span>
              ) : null}
            </>
          ) : gcCustomerId ? (
            // A GC job (v2.3403): the builder is the only party; the customer link is empty by rule, not by omission.
            <span style={{ color: 'var(--text-muted)' }}>{`none · GC job — ${(gcCustomer?.name ?? '').trim() || 'the GC'} is the party`}</span>
          ) : null
        }
        valueTail={
          customerSummary?.notInCustomers ? (
            <span style={warnChipStyle}>Not in Customers</span>
          ) : null
        }
        expanded={openRows.has('customer')}
        onToggle={() => toggleRow('customer')}
      >
        <div
          ref={billingCustomerHighlightRef}
          style={{
            position: 'relative',
            ...(billingCustomerHighlight
              ? { padding: '0.75rem', borderRadius: 8, background: 'var(--bg-red-tint)', border: '2px solid #fecaca' }
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
          <JobFormCustomerLinkPicker
            customerId={customerId}
            setCustomerId={setCustomerId}
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            setCustomerName={setCustomerName}
            setCustomerEmail={setCustomerEmail}
            setCustomerPhone={setCustomerPhone}
            setDateMet={setDateMet}
            jobAddress={jobAddress}
            setJobAddress={setJobAddress}
            customers={customers}
            customersLoading={customersLoading}
            createCustomerName={createCustomerName}
            onCreateCustomer={() => {
              // Sync the shell field first: the create modal's header, its
              // similar-match lookup, and handleCreateCustomerFromJob read it.
              if (createCustomerName && createCustomerName !== customerName.trim()) setCustomerName(createCustomerName)
              onOpenCreateCustomerModal()
            }}
          />
          <div style={{ marginTop: '0.6rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
              Customer Name
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                aria-label="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ ...fieldInputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={onImport}
                title="Import name/address/email/phone from the clipboard"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-subtle)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      </JobFormFactRow>
      <JobFormFactRow
        label="Phone"
        labelIcon={CUSTOMER_SUBROW_INDENT}
        value={customerPhone.trim() ? contactLink('tel', customerPhone) : null}
        expanded={openRows.has('phone')}
        onToggle={() => toggleRow('phone')}
      >
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
          Customer Phone
        </label>
        <input type="tel" aria-label="Customer Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={fieldInputStyle} />
      </JobFormFactRow>
      <JobFormFactRow
        label="Email"
        labelIcon={CUSTOMER_SUBROW_INDENT}
        value={customerEmail.trim() ? contactLink('mailto', customerEmail) : null}
        expanded={openRows.has('email')}
        onToggle={() => toggleRow('email')}
      >
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
          Customer Email
        </label>
        <input type="email" aria-label="Customer Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={fieldInputStyle} />
      </JobFormFactRow>
      {/* Who pays (v2.3345): the job's one answer. Collapsed it names the party;
          opened it is the three-way control. Hidden on a job with no GC and no
          split — "This customer" is the only answer and the default. */}
      {gcDistinct || billToParty !== 'customer' ? (
        <JobFormFactRow
          label="Bills go to"
          labelIcon={CUSTOMER_SUBROW_INDENT}
          value={billToPartyRowValue({ billToParty, gcDistinct, gcName: gcCustomer?.name ?? null, gcBillingEmail })}
          expanded={openRows.has('bill-to-party')}
          onToggle={() => toggleRow('bill-to-party')}
        >
          <JobFormBillToPartyControl
            value={billToParty}
            onChange={setBillToParty}
            customerId={customerId}
            gcCustomerId={gcCustomerId}
            gcName={gcCustomer?.name ?? null}
            gcBillingEmail={gcBillingEmail || null}
            customerName={customerName.trim() || null}
          />
        </JobFormFactRow>
      ) : null}
      {/* Bills also go to (v2.3358): who else is copied on every bill — the
          payer's flagged contacts (saved on their customer record) and the
          other party (a job flag). Collapsed it names them; Bill Customer
          starts with the same people ticked. */}
      {customerId ? (
        <JobFormFactRow
          label="Bills also go to"
          labelIcon={CUSTOMER_SUBROW_INDENT}
          value={
            billsAlsoGoToSummary({ contacts: billCopy.contacts, otherParty: copyOtherParty, copyOtherParty: billCopyOtherParty }) ?? (
              <span style={{ color: 'var(--text-muted)' }}>nobody else</span>
            )
          }
          expanded={openRows.has('bill-copies')}
          onToggle={() => toggleRow('bill-copies')}
        >
          <JobFormBillCopyRecipientsControl
            payerName={copyPayerName}
            contacts={billCopy.contacts}
            loaded={billCopy.loaded}
            onSetFlag={billCopy.setFlag}
            onAdd={billCopy.add}
            otherParty={copyOtherParty}
            copyOtherParty={billCopyOtherParty}
            setCopyOtherParty={setBillCopyOtherParty}
            canAdd={Boolean(copyPayerId)}
          />
        </JobFormFactRow>
      ) : null}
      {/* Share this bill (v2.3376): the job's memory for "Show it on <other party>'s
          statement" — pre-ticks Bill Customer on the next bills. Bills already sent
          change only from the Bill tab's eye chip. Hidden on a split job (each
          draft picks) and on a job with one party. */}
      {jobId && customerId && shareOtherName && billToParty !== 'split' ? (
        <JobFormFactRow
          label={`Show ${shareOtherName}`}
          labelIcon={CUSTOMER_SUBROW_INDENT}
          value={
            showOther ? (
              <span>
                the bills they don’t pay
                <span style={{ marginLeft: 6, padding: '0.05rem 0.4rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-green-100)', color: 'var(--text-green-800)', border: '1px solid var(--border-strong)' }}>on new bills</span>
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>not shared</span>
            )
          }
          expanded={openRows.has('show-other-party')}
          onToggle={() => toggleRow('show-other-party')}
        >
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.15rem 0' }}>
            <input type="checkbox" checked={showOther} onChange={(e) => void saveShowOther(e.target.checked)} style={{ marginTop: 2 }} aria-label={`Show ${shareOtherName} the bills they don't pay`} />
            <span>
              Show {shareOtherName} the bills they don’t pay
              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Starts the tick in Bill Customer on this job’s next bills; their statement lists each one with no Pay button and outside their balance. Bills already sent are not changed — use the 👁 chip on the Bill tab.
              </span>
            </span>
          </label>
        </JobFormFactRow>
      ) : null}
      {props.contractJob ? (
        <JobFormFactRow label="Customer Contract" labelIcon={CUSTOMER_SUBROW_INDENT} value={<JobContractStrip job={props.contractJob} variant="inline" />} />
      ) : null}
      {props.workOrderJob ? (
        <JobFormFactRow label="Sub work order" labelIcon={CUSTOMER_SUBROW_INDENT} value={<JobWorkOrderStrip job={props.workOrderJob} variant="inline" authUserId={props.workOrderAuthUserId} />} />
      ) : null}
      {/* Property record (v2.2638): which of the customer's/GC's saved
          addresses this job sits at — county / legal description / owner of
          record for lien documents. Collapsed shows the linked address (or
          "not linked"); the editor is a picker over the loaded candidates.
          v2.3401: when none of them is the job address (a builder entered as
          the customer only has its office on file), the job address can be
          saved as a property right here — the sheet from Edit customer,
          prefilled, lookup and all — and the job links to the new row.
          Owner of record (PR 2): on a GC or builder job with an address and
          no confirmed owner, the row looks the site up by itself and shows the
          roll's answer with Use under the row — nobody is asked; a direct job
          gets no box (decision 2). */}
      {(() => {
        const linked = propertyCandidates.find((r) => r.id === customerAddressId) ?? null
        const linkedReady = linked ? customerAddressLienReady(linked) : false
        const linkedOwnerConfirmedAt: string | null | undefined = linked ? (linked.owner_confirmed_at === undefined ? undefined : linked.owner_confirmed_at) : customerAddressId ? undefined : null
        const suggested = customerAddressId
          ? null
          : suggestCustomerAddressForJob(
              jobAddress,
              propertyCandidates as never,
            )
        // The property's home: the job's customer; the GC only when there is no customer.
        const propertyHomeId = customerId || gcCustomerId || null
        const propertyHomeName = customerId
          ? customerName.trim() || 'this customer'
          : (gcCustomerName ?? '').trim() || 'the GC'
        const jobAddressTrimmed = jobAddress.trim()
        const canAddFromJob = Boolean(propertyHomeId) && jobAddressTrimmed.length > 0 && !linked && !suggested
        const existingOnHome = propertyCandidates.filter((r) => r.customer_id === propertyHomeId).length
        return (
          <>
          <div ref={propertyRowAnchorRef} />
          <JobFormFactRow
            label="Property record"
            labelIcon={CUSTOMER_SUBROW_INDENT}
            value={
              linked ? (
                <span>
                  {linked.address}
                  {linkedReady ? <span style={{ color: 'var(--text-green-700)', fontWeight: 700 }}> ✓ lien-ready</span> : null}
                </span>
              ) : customerAddressId ? (
                '…'
              ) : propertyHomeId ? (
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>{ownerSuggestion ? 'Not linked yet' : 'not linked'}</span>
                  {ownerSuggestion ? <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-link)', whiteSpace: 'nowrap' }}>1 suggestion</span> : null}
                </span>
              ) : null
            }
            valueTail={
              linked && linked.property_kind !== undefined && !normalizePropertyKind(linked.property_kind) ? (
                <span data-testid="property-kind-unset-chip" style={{ flexShrink: 0, padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }}>
                  kind not set
                </span>
              ) : null
            }
            expanded={openRows.has('property-record')}
            onToggle={() => toggleRow('property-record')}
          >
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
              Property record (feeds lien paperwork — county, legal description, owner of record)
            </label>
            {propertyCandidates.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {propertyHomeId
                  ? `No saved properties on ${propertyHomeName} yet.`
                  : 'Link a customer first — the property record lives on the customer.'}
              </p>
            ) : (
              <>
                <select
                  aria-label="Property record"
                  value={customerAddressId ?? ''}
                  onChange={(e) => setCustomerAddressId(e.target.value || null)}
                  style={{ ...fieldInputStyle, maxWidth: '100%' }}
                >
                  <option value="">— not linked —</option>
                  {propertyCandidates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.address}
                      {suggested?.id === r.id ? ' (matches job address)' : ''}
                    </option>
                  ))}
                </select>
                {suggested ? (
                  <button
                    type="button"
                    onClick={() => setCustomerAddressId(suggested.id)}
                    style={{ marginTop: '0.4rem', background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Link {suggested.address} — matches the job address
                  </button>
                ) : null}
              </>
            )}
            {linked && linked.property_kind !== undefined ? (
              <div
                ref={propertyKindBlockRef}
                data-testid="property-kind-block"
                style={{ marginTop: '0.6rem', padding: '0.5rem 0.65rem', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: propertyKindFlash ? '0 0 0 2px var(--text-link)' : 'none', transition: 'box-shadow 0.4s ease' }}
              >
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Property kind</div>
                <p style={{ margin: '0.1rem 0 0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sets the lien deadlines: a residential property's notice is due a month earlier.</p>
                <PropertyKindSwitch
                  value={normalizePropertyKind(linked.property_kind)}
                  voice="sheet"
                  size="field"
                  allowClear
                  disabled={propertyKindBusy}
                  label={`Property kind for ${linked.address}`}
                  onPick={(kind) => {
                    setPropertyKindBusy(true)
                    void savePropertyKind(linked.id, kind)
                      .then(() => onPropertyKindSaved?.(linked.id, propertyKindPatch(kind)))
                      .catch((e) => showShareToast(formatErrorMessage(e, 'Could not save the property kind'), 'error'))
                      .finally(() => setPropertyKindBusy(false))
                  }}
                />
                {normalizePropertyKind(linked.property_kind) === 'residential' ? (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(linked.homestead)}
                      disabled={propertyKindBusy}
                      onChange={(e) => {
                        const homestead = e.target.checked
                        setPropertyKindBusy(true)
                        void savePropertyHomestead(linked.id, homestead)
                          .then(() => onPropertyKindSaved?.(linked.id, { homestead }))
                          .catch((err) => showShareToast(formatErrorMessage(err, 'Could not save the homestead tick'), 'error'))
                          .finally(() => setPropertyKindBusy(false))
                      }}
                    />
                    Homestead
                  </label>
                ) : null}
                <p style={{ margin: '0.45rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saved on the property as you pick, not on the job — every job at this address follows it.</p>
              </div>
            ) : null}
            {addingProperty && propertyHomeId ? (
              <JobFormPropertyAddSheet
                customerId={propertyHomeId}
                customerName={propertyHomeName}
                jobAddress={jobAddressTrimmed}
                existingCount={existingOnHome}
                onAdded={(row) => {
                  setAddingProperty(false)
                  onPropertyAdded(row)
                }}
                onCancel={() => setAddingProperty(false)}
              />
            ) : canAddFromJob ? (
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAddingProperty(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  + Add {jobAddressTrimmed} as a property on {propertyHomeName}
                </button>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  The job address is not one of {propertyHomeName}'s saved properties. Add it here and the county, legal description and owner of record are looked up for the lien paperwork.
                </p>
              </div>
            ) : null}
          </JobFormFactRow>
          <JobFormOwnerLookupBox
            jobId={jobId}
            jobAddress={jobAddressTrimmed}
            customerId={customerId}
            customerName={customerName}
            gcCustomerId={gcCustomerId}
            gcCustomerName={(gcCustomerName ?? '').trim()}
            customerAddressId={customerAddressId}
            linkedOwnerConfirmedAt={linkedOwnerConfirmedAt}
            onConfirmed={onOwnerConfirmed}
            onSuggestion={setOwnerSuggestion}
            style={{ padding: '0.5rem 0.15rem 0.6rem 1.1rem', borderBottom: '1px solid var(--border)' }}
          />
          </>
        )
      })()}
      {/* Date met rides with the customer-contact sub-rows — it lives on the
          customers record like phone/email (owner call, v2.1697). Collapsed it
          reads "06/09/26 (2 months ago)" (owner call, v2.1700); the lock and
          first-clock-in provenance moved into the opened editor. */}
      <JobFormFactRow
        label="Date met"
        labelIcon={CUSTOMER_SUBROW_INDENT}
        value={dateMetValue}
        valueTail={
          dateMetAgo ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>({dateMetAgo})</span>
          ) : null
        }
        expanded={openRows.has('dateMet')}
        onToggle={() => toggleRow('dateMet')}
      >
        <input
          type="date"
          aria-label="Date met"
          value={dateMet}
          onChange={(e) => setDateMet(e.target.value)}
          disabled={dateMetLocked}
          style={{
            ...fieldInputStyle,
            background: dateMetLocked ? 'var(--bg-subtle)' : 'var(--surface)',
            color: dateMetLocked ? 'var(--text-muted)' : 'inherit',
            cursor: dateMetLocked ? 'not-allowed' : 'text',
          }}
        />
        {dateMetLocked ? (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {dateMetFromClock
              ? 'Set automatically from the first clock-in — edit it in Customers.'
              : 'Set on the linked customer — edit it in Customers.'}
          </p>
        ) : null}
      </JobFormFactRow>
      <JobFormFactRow
        label="GC/Builder"
        labelIcon={<GcHardHatIcon size={12} style={{ flexShrink: 0 }} />}
        value={
          gcCustomer ? (
            <>
              {gcCustomer.name ?? '…'}
              {gcCustomer.address?.trim() ? (
                <span style={{ color: 'var(--text-muted)' }}>{` · ${gcCustomer.address.trim()}`}</span>
              ) : null}
            </>
          ) : null
        }
        expanded={openRows.has('gc')}
        onToggle={() => toggleRow('gc')}
      >
        <div ref={focusRowAnchorRef} data-fact-row-anchor="gc" />
        <div style={{ borderRadius: 6, boxShadow: rowFlash === 'gc' ? '0 0 0 2px var(--surface), 0 0 0 4px var(--text-link)' : 'none', transition: 'box-shadow 0.4s ease' }} data-fact-row-ring={rowFlash === 'gc' ? 'yes' : 'no'}>
        <JobFormGcPicker
          gcCustomerId={gcCustomerId}
          setGcCustomerId={setGcCustomerId}
          linkedBidGc={linkedBidGc}
          customers={customers}
          customersLoading={customersLoading}
          showLabel={false}
        />
        </div>
      </JobFormFactRow>
      {/* The GC's contact facts mirror the Customer block (owner call,
          v2.1701) — read-only rows straight off the GC's customers record
          (no pencil; the job keeps no copy of GC contact info, so edits
          happen in Customers). */}
      {gcCustomer ? (
        <>
          <JobFormFactRow label="Phone" labelIcon={CUSTOMER_SUBROW_INDENT} value={gcContact?.phone.trim() ? contactLink('tel', gcContact.phone) : null} />
          <JobFormFactRow label="Email" labelIcon={CUSTOMER_SUBROW_INDENT} value={gcContact?.email.trim() ? contactLink('mailto', gcContact.email) : null} />
          {/* Where this GC is billed (v2.3345): its own column on customers, distinct
              from the estimating contact above. Editable here because the office
              discovers the AP inbox while billing, not while filing the customer. */}
          <JobFormFactRow
            label="Billing email"
            labelIcon={CUSTOMER_SUBROW_INDENT}
            value={
              (gcCustomer.billing_email ?? '').trim() ? (
                contactLink('mailto', gcCustomer.billing_email ?? '')
              ) : gcContact?.email.trim() ? (
                <span style={{ color: 'var(--text-muted)' }}>same as email</span>
              ) : null
            }
            expanded={openRows.has('gc-billing-email')}
            onToggle={() => toggleRow('gc-billing-email')}
          >
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
              Where {gcCustomer.name ?? 'this GC'} is billed
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input
                type="email"
                aria-label="GC billing email"
                value={gcBillingEmailDraft}
                placeholder={gcContact?.email.trim() ? `blank = ${gcContact.email.trim()}` : 'ap@builder.com'}
                onChange={(e) => setGcBillingEmailDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void saveGcBillingEmail()
                  }
                }}
                style={{ ...fieldInputStyle, flex: '1 1 220px', width: 'auto' }}
              />
              <button
                type="button"
                onClick={() => void saveGcBillingEmail()}
                disabled={gcBillingEmailSaving}
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.8125rem', fontWeight: 600, background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 4, cursor: gcBillingEmailSaving ? 'wait' : 'pointer' }}
              >
                {gcBillingEmailSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {gcBillingEmailError ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{gcBillingEmailError}</p>
            ) : (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Saved on the GC's customer record — every job billed to {gcCustomer.name ?? 'this GC'} uses it.
              </p>
            )}
          </JobFormFactRow>
          <JobFormFactRow
            label="Date met"
            labelIcon={CUSTOMER_SUBROW_INDENT}
            value={dateMetRowValue(gcDateMetYmd)}
            valueTail={
              gcDateMetAgo ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>({gcDateMetAgo})</span>
              ) : null
            }
          />
        </>
      ) : null}
      {/* Development leads the links block (owner call, v2.1703). */}
      <JobFormFactRow
        label="Development"
        labelIcon={<DevelopmentHouseIcon size={12} style={{ flexShrink: 0 }} />}
        value={developmentId ? (developmentPickerOptions(developments, developmentId).find((d) => d.id === developmentId)?.name ?? '…') : null}
        expanded={openRows.has('development')}
        onToggle={() => toggleRow('development')}
      >
        <JobFormDevelopmentEditor
          developmentId={developmentId}
          setDevelopmentId={setDevelopmentId}
          developments={developments}
          onCreateDevelopment={onCreateDevelopment}
          showLabel={false}
        />
      </JobFormFactRow>
      <JobFormFactRow
        label="Project"
        value={projectId ? (projects.find((p) => p.id === projectId)?.name ?? '…') : null}
        expanded={openRows.has('project')}
        onToggle={() => toggleRow('project')}
      >
        <JobFormProjectEditor
          projectId={projectId}
          setProjectId={setProjectId}
          customerId={customerId}
          setCustomerId={setCustomerId}
          projects={projects}
          projectDisconnectRef={projectDisconnectRef}
          showLabel={false}
        />
      </JobFormFactRow>
      <JobFormFactRow
        label="Plans"
        value={null}
        valueTail={jobPlansLink.trim() ? folderLink('Job plans', jobPlansLink.trim()) : null}
        expanded={openRows.has('plans')}
        onToggle={() => toggleRow('plans')}
      >
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Job Plans</label>
        <input
          type="url"
          aria-label="Job Plans"
          value={jobPlansLink}
          onChange={(e) => setJobPlansLink(e.target.value)}
          placeholder="https://drive.google.com/..."
          style={fieldInputStyle}
        />
      </JobFormFactRow>
      <JobFormFactRow
        label="Bid"
        last
        value={bidId ? formatJobFormBidLinkTitle(prefixMap, linkedBidSummary) : null}
        expanded={openRows.has('bid')}
        onToggle={() => toggleRow('bid')}
      >
        <JobFormBidEditor
          bidId={bidId}
          setBidId={setBidId}
          linkedBidSummary={linkedBidSummary}
          setLinkedBidSummary={setLinkedBidSummary}
          onOpenBidLinkChoice={onOpenBidLinkChoice}
          showLabel={false}
        />
      </JobFormFactRow>
    </div>
  )
}

/** Collapsed "Bills go to" wording (v2.3345). */
function billToPartyRowValue(p: { billToParty: JobBillToParty; gcDistinct: boolean; gcName: string | null; gcBillingEmail: string }) {
  if (p.billToParty === 'gc' && p.gcDistinct) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}>
        <GcHardHatIcon size={11} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(p.gcName ?? '').trim() || 'GC'}
          {p.gcBillingEmail ? <span style={{ color: 'var(--text-muted)' }}>{` · ${p.gcBillingEmail}`}</span> : null}
        </span>
        {!p.gcBillingEmail ? <span style={{ color: 'var(--text-amber-800)', fontSize: '0.75rem', flexShrink: 0 }}>no billing email</span> : null}
      </span>
    )
  }
  if (p.billToParty === 'split') return 'Split by line — each invoice picks'
  return 'This customer'
}
