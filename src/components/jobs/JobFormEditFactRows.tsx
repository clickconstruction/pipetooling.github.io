import { useCallback, useEffect, useState } from 'react'
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
import GcHardHatIcon from '../icons/GcHardHatIcon'
import TeamCrewIcon from '../icons/TeamCrewIcon'
import { JobFormFactRow } from './JobFormFactRow'
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
  | 'team'
  | 'customer'
  | 'phone'
  | 'email'
  | 'gc'
  | 'dateMet'
  | 'folders'
  | 'project'
  | 'plans'
  | 'bid'
  | 'development'

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
  const gcDateMetYmd = gcCustomer?.date_met ? (gcCustomer.date_met.split('T')[0] ?? '') : ''
  const gcDateMetAgo = dateMetRowAgo(gcDateMetYmd)
  const dateMetCustomer = customerId ? customers.find((c) => c.id === customerId) : undefined
  const dateMetLocked = !!dateMetCustomer?.date_met
  /** v2.1698: the date came from the first clock session (v2.1696), not a person. */
  const dateMetFromClock = dateMetLocked && dateMetCustomer?.date_met_source === 'clock'

  const createCustomerName = resolveCreateCustomerName({ customerName, customerSearch, customerId })

  const chipStyle = (variant: 'linked' | 'warn') => ({
    padding: '0.1rem 0.4rem',
    fontSize: '0.6875rem',
    fontWeight: 500,
    borderRadius: 999,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
    ...(variant === 'linked'
      ? { background: 'var(--bg-subtle)', color: '#15803d', border: '1px solid var(--border-green)' }
      : { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }),
  })

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
              {customerSummary.address ? (
                <span style={{ color: 'var(--text-muted)' }}>{` · ${customerSummary.address}`}</span>
              ) : null}
            </>
          ) : null
        }
        valueTail={
          customerSummary != null ? (
            customerSummary.linked ? (
              <span style={chipStyle('linked')}>linked</span>
            ) : customerSummary.notInCustomers ? (
              <span style={chipStyle('warn')}>Not in Customers</span>
            ) : null
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
        value={customerPhone.trim() || null}
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
        value={customerEmail.trim() || null}
        expanded={openRows.has('email')}
        onToggle={() => toggleRow('email')}
      >
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>
          Customer Email
        </label>
        <input type="email" aria-label="Customer Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={fieldInputStyle} />
      </JobFormFactRow>
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
        <JobFormGcPicker
          gcCustomerId={gcCustomerId}
          setGcCustomerId={setGcCustomerId}
          linkedBidGc={linkedBidGc}
          customers={customers}
          customersLoading={customersLoading}
          showLabel={false}
        />
      </JobFormFactRow>
      {/* The GC's contact facts mirror the Customer block (owner call,
          v2.1701) — read-only rows straight off the GC's customers record
          (no pencil; the job keeps no copy of GC contact info, so edits
          happen in Customers). */}
      {gcCustomer ? (
        <>
          <JobFormFactRow label="Phone" labelIcon={CUSTOMER_SUBROW_INDENT} value={gcContact?.phone.trim() || null} />
          <JobFormFactRow label="Email" labelIcon={CUSTOMER_SUBROW_INDENT} value={gcContact?.email.trim() || null} />
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
