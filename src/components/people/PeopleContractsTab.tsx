import { Fragment, useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { PersonNameDoor } from '../personDesk/PersonNameDoor'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { checkGoogleDriveAttachmentUrl } from '../../lib/checkGoogleDriveAttachmentUrl'
import { hasContractSigningContent } from '../../lib/contractSigningContent'
import {
  type ContractBodyFormat,
  isMarkdownBodyFormat,
  isPlainBodyFormat,
  normalizeContractBodyForSave,
  parseContractBodyFormat,
} from '../../lib/contractBodyFormat'
import { buildContractSigningEmail, CONTRACT_SIGNING_EMAIL_DEFAULT_INTRO, contractSigningEmailDefaultSubject } from '../../lib/contractSigningEmail'
import { PORTAL_SHORT_ORIGIN } from '../../lib/portal/portalShortOrigin'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { normalizeCustomerAttachmentUrl } from '../../lib/estimateCustomerAttachment'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { formatAppliedVersionPlainDate, todayPlainDateInAppTz } from '../../lib/personContractAppliedDate'
import { effectiveBookVersionLabel, effectiveBookVersionPlainDate } from '../../lib/contractBookVersionDate'
import { ContractBookModal, type ContractBookTemplateDocument } from '../contracts/ContractBookModal'
import { ContractLibraryModal } from '../contracts/ContractLibraryModal'
import { ContractFormPaperEntryModal } from '../contracts/formFill/ContractFormPaperEntryModal'
import { ContractFormOfficeModal } from '../contracts/formFill/ContractFormOfficeModal'
import { officeQueue, officeSectionPending, twoPartyTemplateIdSet } from '../../lib/forms/formParties'
import type { FormSchema } from '../../lib/forms/formSchema'
import { assignPacketsConsequence } from '../../lib/contractPackets'
import { ContractsTabHelpModal } from './ContractsTabHelpModal'
import { countPersonContractStatuses } from '../../lib/personContractStatusCounts'
import {
  CONTRACTS_ROSTER_FILTER_STORAGE_KEY,
  contractsRosterBucket,
  defaultContractsRosterFilter,
  parseContractsRosterFilter,
  personVisibleUnderContractsFilter,
  type ContractsRosterBucket,
  type ContractsRosterFilter,
} from '../../lib/contractsRosterFilter'
import { useNarrowViewport660 } from '../../hooks/useNarrowViewport660'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { buildAgreementSummaries } from '../../lib/contractsAgreementsPanel'
import {
  listQuickAddBookDocuments,
  quickSendPlan,
  quickSendPlanWrites,
  quickSendReusablePersonRow,
  type QuickSendPlan,
  resolveQuickSendSource,
} from '../../lib/contractsQuickSend'
import { ContractQuickSendPicker } from './ContractQuickSendPicker'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { useAuth } from '../../hooks/useAuth'
import { ContractsAgreementsPanel } from './ContractsAgreementsPanel'
import { PersonContractSignedRecordModal } from '../contracts/PersonContractSignedRecordModal'
import { ContractBookIcon } from '../icons/ContractBookIcon'
import { useToastContext } from '../../contexts/ToastContext'

/** Small tinted pill for a document signing state; anything unknown renders as unsent. */
function ContractStatusChip({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'signed'
      ? { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' }
      : status === 'sent'
        ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
        : { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 500, padding: '0.1rem 0.45rem', borderRadius: 999, whiteSpace: 'nowrap', ...tone }}>
      {label}
    </span>
  )
}

/** person_contract_documents.status values allowed for staff delete in People → Contracts */
function isDeletablePersonContractStatus(status: string): boolean {
  return status === 'unsent' || status === 'sent' || status === 'signed'
}

/** True when the row has URL, signing content, note, or signature date — do not delete as an empty placeholder (Manage templates + unassign). */
function personContractDocumentHasStaffData(
  pcd: {
    url: string | null
    signed_at: string | null
    note: string | null
    signing_body_html: string | null
    canonical_document_url: string | null
  } | null | undefined,
): boolean {
  if (!pcd) return false
  return !!(
    pcd.url?.trim() ||
    pcd.signed_at ||
    pcd.note?.trim() ||
    pcd.signing_body_html?.trim() ||
    pcd.canonical_document_url?.trim()
  )
}

type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null; phone: string | null }

export type PeopleContractsTabProps = {
  people: Person[]
  users: UserRow[]
  /** Archived roster people (page-level state) — grouped into the collapsed Archived section at the bottom (v2.1408). */
  archivedPeople?: Person[]
  /** Names of archived user accounts (RPC get_archived_user_names) — same Archived section. */
  archivedUserNames?: Set<string>
  canDeletePeopleContracts: boolean
  /** The signed-in staff member — the send email's Reply-To and "reach" line (v2.2773). */
  currentUserId?: string | null
  /** Contract Forms (v2.2794): devs see the Forms tab in the Contract library. */
  isDev?: boolean
}

export default function PeopleContractsTab({ people, users, archivedPeople, archivedUserNames, canDeletePeopleContracts, currentUserId, isDev = false }: PeopleContractsTabProps) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const [contractsHelpModalOpen, setContractsHelpModalOpen] = useState(false)
  /** Below 660px the expanded person's documents render as cards — the 8-column table cuts its Actions off-screen on phones. */
  const contractsNarrowViewport = useNarrowViewport660()
  /** ≥1100px shows the Agreements panel beside the roster (v2.1407); per-device hide toggle. */
  const contractsWideViewport = useMatchMedia('(min-width: 1100px)')
  const [agreementsPanelHidden, setAgreementsPanelHidden] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('people_contracts_agreements_panel_hidden_v1') === '1'
    } catch {
      return false
    }
  })
  const [contractsArchivedSectionOpen, setContractsArchivedSectionOpen] = useState(false)
  const setAgreementsPanelHiddenStored = (hidden: boolean) => {
    setAgreementsPanelHidden(hidden)
    try {
      window.localStorage.setItem('people_contracts_agreements_panel_hidden_v1', hidden ? '1' : '0')
    } catch {
      /* per-device preference only */
    }
  }

  // Contracts tab state
  type ContractTemplate = { id: string; name: string; sequence_order: number; created_at: string | null }
  type ContractTemplateDocument = {
    id: string
    template_id: string
    document_name: string
    sequence_order: number
    book_body_html: string | null
    book_body_format: string
    tags: string[]
    canonical_document_url?: string | null
    updated_at: string
    book_version_date: string | null
    form_template_id?: string | null
  }
  type PersonContractAssignment = { id: string; person_name: string; template_id: string }
  type PersonContractDocument = {
    id: string
    person_name: string
    document_name: string
    url: string | null
    signing_body_html: string | null
    signing_body_format: string
    canonical_document_url: string | null
    status: string
    signed_at: string | null
    sent_at: string | null
    signer_last_viewed_at: string | null
    note: string | null
    dashboard_prompt_after_clock_in?: boolean | null
    applied_contract_template_document_id: string | null
    applied_version_date: string | null
    contract_lineage_id: string
    lineage_version: number
    supersedes_person_contract_document_id: string | null
    form_template_id?: string | null
    /** Two-party forms (v2.2803): when the office completed its section; null while pending. */
    office_completed_at?: string | null
  }

  /** One table row: a specific version row, or placeholder when template lists doc but no person row yet. */
  type PersonContractTableRow = {
    document_name: string
    lineageId: string | null
    templateNames: string[]
    bookLastEditedAt: string | null
    version: PersonContractDocument | null
  }
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([])
  const [contractTemplateDocuments, setContractTemplateDocuments] = useState<ContractTemplateDocument[]>([])
  const [personContractAssignments, setPersonContractAssignments] = useState<PersonContractAssignment[]>([])
  const [personContractDocuments, setPersonContractDocuments] = useState<PersonContractDocument[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)
  const [contractsError, setContractsError] = useState<string | null>(null)
  const [contractsSearchQuery, setContractsSearchQuery] = useState('')
  const [selectedContractsPersonName, setSelectedContractsPersonName] = useState<string | null>(null)
  /** Contract library (v2.1411): merged Documents/Packets modal replacing Contract Book + Manage templates. */
  const [contractLibraryModalOpen, setContractLibraryModalOpen] = useState(false)
  const [contractsAssignModalOpen, setContractsAssignModalOpen] = useState(false)
  const [contractBookModalOpen, setContractBookModalOpen] = useState(false)
  const [editingContractDocument, setEditingContractDocument] = useState<PersonContractDocument | null>(null)
  const [contractDocumentFormPersonName, setContractDocumentFormPersonName] = useState('')
  const [contractDocumentFormDocumentName, setContractDocumentFormDocumentName] = useState('')
  const [contractDocumentFormUrl, setContractDocumentFormUrl] = useState('')
  const [contractDocumentFormStatus, setContractDocumentFormStatus] = useState<'unsent' | 'sent' | 'signed'>('unsent')
  const [contractDocumentFormSignedAt, setContractDocumentFormSignedAt] = useState('')
  const [contractDocumentFormNote, setContractDocumentFormNote] = useState('')
  const [contractDocumentFormSigningBodyHtml, setContractDocumentFormSigningBodyHtml] = useState('')
  const [contractDocumentFormSigningBodyFormat, setContractDocumentFormSigningBodyFormat] =
    useState<ContractBodyFormat>('html')
  const [contractDocumentFormCanonicalUrl, setContractDocumentFormCanonicalUrl] = useState('')
  /** Empty string = automatic (max updated_at among assigned templates). */
  const [contractDocumentFormAppliedTemplateDocId, setContractDocumentFormAppliedTemplateDocId] = useState('')
  /** Empty string = derive the Applied version date from the Contract Book edit; 'YYYY-MM-DD' = custom stored date. */
  const [contractDocumentFormAppliedVersionDate, setContractDocumentFormAppliedVersionDate] = useState('')
  const [contractDocumentFormSaving, setContractDocumentFormSaving] = useState(false)
  const [contractDocumentDeleteConfirmOpen, setContractDocumentDeleteConfirmOpen] = useState(false)
  const [contractDocumentDeleteTarget, setContractDocumentDeleteTarget] = useState<PersonContractDocument | null>(
    null,
  )
  const [contractsDocumentActionsMenuOpenId, setContractsDocumentActionsMenuOpenId] = useState<string | null>(null)
  const [contractDocumentDeleting, setContractDocumentDeleting] = useState(false)
  const [contractDocumentModalOpen, setContractDocumentModalOpen] = useState(false)
  /** Edit document modal: collapsible sections (default minimized). */
  const [contractEditModalContractTextExpanded, setContractEditModalContractTextExpanded] = useState(false)
  const [contractEditModalCanonicalExpanded, setContractEditModalCanonicalExpanded] = useState(false)
  const [contractSendModalOpen, setContractSendModalOpen] = useState(false)
  const [contractSendDocId, setContractSendDocId] = useState<string | null>(null)
  /** Quick send (v2.1410): document whose person picker is open, and the in-flight guard. */
  const [quickSendDocumentName, setQuickSendDocumentName] = useState<string | null>(null)
  /**
   * A quick-send pick that has NOT been written yet (decision 17, 2026-09-05):
   * the Send modal carries the person, document and resolved plan in state;
   * the `person_contract_documents` INSERT/UPDATE happens inside Send email,
   * right before `send-contract-for-signature`. Null for reuse (row exists) and
   * for the Add-document path (which saved its row on purpose).
   */
  const [contractSendQuickSend, setContractSendQuickSend] = useState<{
    personName: string
    documentName: string
    plan: QuickSendPlan
  } | null>(null)
  const [contractSendEmail, setContractSendEmail] = useState('')
  const [contractSendSubject, setContractSendSubject] = useState('')
  const [contractSendIntro, setContractSendIntro] = useState('')
  /** The signer's live portal address for the preview's "stays on your page" band; null = none (v2.2773). */
  const [contractSendPortalUrl, setContractSendPortalUrl] = useState<string | null>(null)
  const [contractSendSaving, setContractSendSaving] = useState(false)
  const [canonicalUrlCheckStatus, setCanonicalUrlCheckStatus] = useState<
    'idle' | 'loading' | 'success' | 'warn' | 'error'
  >('idle')
  const [canonicalUrlCheckMessage, setCanonicalUrlCheckMessage] = useState('')
  const [contractDocumentAddTab, setContractDocumentAddTab] = useState<'upload_signed' | 'request_signature'>(
    'request_signature',
  )
  /** Add-document chooser (v2.1410): pick a Contract Book document (everything prefills) or fall through to the full custom form. */
  const [contractAddDocSource, setContractAddDocSource] = useState<'choose' | 'book' | 'custom'>('choose')
  /** Enter from paper (Contract Forms v2.2801): the person whose handwritten form is being keyed in. */
  const [paperEntryFor, setPaperEntryFor] = useState<string | null>(null)
  /** Two-party forms (v2.2803): templates with office boxes, and the office modal opened from the queue strip. */
  const [twoPartyTemplateIds, setTwoPartyTemplateIds] = useState<Set<string>>(() => new Set())
  const [officeModalDocId, setOfficeModalDocId] = useState<string | null>(null)

  // Deep link from the signing page's thank-you (PR 8): /people?tab=contracts&doc=<id> opens that record.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = new URLSearchParams(window.location.search).get('doc')
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setContractSignedRecordModalDocId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])
  const [contractAddBookPickedRowId, setContractAddBookPickedRowId] = useState<string | null>(null)
  const [contractAddBookCustomizeOpen, setContractAddBookCustomizeOpen] = useState(false)
  const [contractDocumentFormDashboardPrompt, setContractDocumentFormDashboardPrompt] = useState(false)
  const [contractDashboardPromptSavingId, setContractDashboardPromptSavingId] = useState<string | null>(null)
  const [contractSignedRecordModalDocId, setContractSignedRecordModalDocId] = useState<string | null>(null)
  const contractAddDocTabBaseId = useId()
  const contractsTabSearchInputId = useId()
  /** Assign packets modal (v2.1411): multi-select with a consequences line; Unassign lives behind each assigned row's ⋯ menu. */
  const [assignPacketsSelectedIds, setAssignPacketsSelectedIds] = useState<Set<string>>(new Set())
  const [assignPacketsSaving, setAssignPacketsSaving] = useState(false)
  const [assignPacketUnassigningTemplateId, setAssignPacketUnassigningTemplateId] = useState<string | null>(null)
  const [assignPacketMenuOpenId, setAssignPacketMenuOpenId] = useState<string | null>(null)

  const canonicalUrlIsCheckable = useMemo(
    () => Boolean(normalizeCustomerAttachmentUrl(contractDocumentFormCanonicalUrl)),
    [contractDocumentFormCanonicalUrl],
  )

  const checkCanonicalDocumentUrl = useCallback(async () => {
    const u = normalizeCustomerAttachmentUrl(contractDocumentFormCanonicalUrl)
    if (!u) {
      showToast('Enter a valid https URL first.', 'error')
      return
    }
    setCanonicalUrlCheckStatus('loading')
    setCanonicalUrlCheckMessage('')
    const result = await checkGoogleDriveAttachmentUrl(contractDocumentFormCanonicalUrl)
    if (result.status === 'error' && result.message === 'Not signed in.') {
      showToast('Not signed in', 'error')
    }
    setCanonicalUrlCheckStatus(
      result.status === 'success' ? 'success' : result.status === 'warn' ? 'warn' : 'error',
    )
    setCanonicalUrlCheckMessage(result.message)
  }, [contractDocumentFormCanonicalUrl, showToast])

  useEffect(() => {
    if (!contractDocumentModalOpen) return
    setCanonicalUrlCheckStatus('idle')
    setCanonicalUrlCheckMessage('')
  }, [contractDocumentFormCanonicalUrl, contractDocumentModalOpen])

  useEffect(() => {
    if (!contractDocumentModalOpen || !editingContractDocument) return
    setContractEditModalContractTextExpanded(false)
    setContractEditModalCanonicalExpanded(false)
  }, [contractDocumentModalOpen, editingContractDocument?.id])

  useEffect(() => {
    if (contractsDocumentActionsMenuOpenId === null) return
    function handleMouseDown(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (t.closest(`[data-contract-doc-menu-wrap="${contractsDocumentActionsMenuOpenId}"]`)) return
      setContractsDocumentActionsMenuOpenId(null)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [contractsDocumentActionsMenuOpenId])

  useEffect(() => {
    if (assignPacketMenuOpenId === null) return
    function handleMouseDown(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (t.closest(`[data-assign-packet-menu-wrap="${assignPacketMenuOpenId}"]`)) return
      setAssignPacketMenuOpenId(null)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [assignPacketMenuOpenId])

  const contractBodyFormatBtn = (active: boolean) =>
    ({
      padding: '0.25rem 0.55rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      border: '1px solid var(--border-strong)',
      borderRadius: 6,
      background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
      color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
      cursor: 'pointer',
    }) as const

  const contractDocModalContractTextField = useMemo(
    () => (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: '0.25rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <label style={{ fontSize: '0.8125rem', display: 'block' }}>Contract text</label>
            <div
              role="group"
              aria-label="Contract text format"
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                alignItems: 'center',
                marginTop: 6,
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Format:</span>
              <button
                type="button"
                style={contractBodyFormatBtn(contractDocumentFormSigningBodyFormat === 'html')}
                onClick={() => setContractDocumentFormSigningBodyFormat('html')}
              >
                HTML
              </button>
              <button
                type="button"
                style={contractBodyFormatBtn(contractDocumentFormSigningBodyFormat === 'plain')}
                onClick={() => setContractDocumentFormSigningBodyFormat('plain')}
              >
                Plain text
              </button>
              <button
                type="button"
                style={contractBodyFormatBtn(contractDocumentFormSigningBodyFormat === 'markdown')}
                onClick={() => setContractDocumentFormSigningBodyFormat('markdown')}
              >
                Markdown
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setContractBookModalOpen(true)}
            title="Open Contract Book"
            aria-label="Open Contract Book"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem 0.45rem',
              border: 'none',
              borderRadius: 6,
              background: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <ContractBookIcon />
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.35rem', lineHeight: 1.45 }}>
          <strong>HTML:</strong> rich text (sanitized). <strong>Plain:</strong> exact text including angle brackets.{' '}
          <strong>Markdown:</strong> rendered on the signing page (then sanitized).
        </p>
        <textarea
          value={contractDocumentFormSigningBodyHtml}
          onChange={(e) => setContractDocumentFormSigningBodyHtml(e.target.value)}
          placeholder="Optional. Shown on the public signing page."
          rows={6}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
    ),
    [contractDocumentFormSigningBodyHtml, contractDocumentFormSigningBodyFormat, contractBodyFormatBtn],
  )

  const contractDocModalCanonicalUrlField = useMemo(
    () => (
      <div>
        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
          Canonical document URL (Doc / PDF)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="url"
            value={contractDocumentFormCanonicalUrl}
            onChange={(e) => setContractDocumentFormCanonicalUrl(e.target.value)}
            placeholder="https://…"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0.5rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => void checkCanonicalDocumentUrl()}
            disabled={canonicalUrlCheckStatus === 'loading' || !canonicalUrlIsCheckable}
            style={{
              flexShrink: 0,
              padding: '0.4rem 0.65rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background:
                canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? '#3b82f6' : 'var(--bg-subtle)',
              color: canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? '#fff' : 'var(--text-faint)',
              cursor:
                canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? 'pointer' : 'not-allowed',
              opacity: canonicalUrlIsCheckable ? 1 : 0.65,
            }}
          >
            {canonicalUrlCheckStatus === 'loading' ? 'Checking…' : 'Check link'}
          </button>
        </div>
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          Drive or Docs URLs only. Does not block saving — hints only.
        </span>
        {canonicalUrlCheckStatus === 'success' && canonicalUrlCheckMessage ? (
          <p
            role="status"
            style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#15803d', lineHeight: 1.45 }}
          >
            {canonicalUrlCheckMessage}
          </p>
        ) : null}
        {canonicalUrlCheckStatus === 'warn' && canonicalUrlCheckMessage ? (
          <p
            role="status"
            style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-amber-700)', lineHeight: 1.45 }}
          >
            {canonicalUrlCheckMessage}
          </p>
        ) : null}
        {canonicalUrlCheckStatus === 'error' && canonicalUrlCheckMessage ? (
          <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-red-700)', lineHeight: 1.45 }}>
            {canonicalUrlCheckMessage}
          </p>
        ) : null}
      </div>
    ),
    [
      contractDocumentFormCanonicalUrl,
      canonicalUrlCheckStatus,
      canonicalUrlCheckMessage,
      canonicalUrlIsCheckable,
      checkCanonicalDocumentUrl,
    ],
  )

  /** Applied version box (Contract Book copy + applied date) — shared by the edit modal, the custom add form, and the book path's Customize expander (v2.1410). */
  const renderContractDocAppliedVersionBox = () => (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.65rem 0.75rem' }}>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
        Applied version
      </p>
      <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
        Contract Book copy
      </label>
      <select
        value={contractDocumentFormAppliedTemplateDocId}
        onChange={(e) => setContractDocumentFormAppliedTemplateDocId(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
      >
        <option value="">Automatic (latest edit among assigned packets)</option>
        {listAppliedContractBookVersionOptions(
          contractDocumentFormPersonName,
          contractDocumentFormDocumentName,
        ).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label style={{ display: 'block', fontSize: '0.8125rem', margin: '0.65rem 0 0.25rem' }}>
        Applied date
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          role="group"
          aria-label="Applied date source"
          style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}
        >
          <button
            type="button"
            aria-pressed={!contractDocumentFormAppliedVersionDate}
            onClick={() => setContractDocumentFormAppliedVersionDate('')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              background: !contractDocumentFormAppliedVersionDate ? 'var(--bg-blue-tint)' : 'transparent',
              color: !contractDocumentFormAppliedVersionDate ? 'var(--text-blue-700)' : 'var(--text-muted)',
            }}
          >
            From book edit
          </button>
          <button
            type="button"
            aria-pressed={!!contractDocumentFormAppliedVersionDate}
            onClick={() => {
              if (contractDocumentFormAppliedVersionDate) return
              const pinned = contractDocumentFormAppliedTemplateDocId
                ? contractTemplateDocuments.find((d) => d.id === contractDocumentFormAppliedTemplateDocId)
                : null
              setContractDocumentFormAppliedVersionDate(
                effectiveBookVersionPlainDate(pinned) ?? todayPlainDateInAppTz(),
              )
            }}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              border: 'none',
              borderRadius: 0,
              borderLeft: '1px solid var(--border-strong)',
              cursor: 'pointer',
              background: contractDocumentFormAppliedVersionDate ? 'var(--bg-blue-tint)' : 'transparent',
              color: contractDocumentFormAppliedVersionDate ? 'var(--text-blue-700)' : 'var(--text-muted)',
            }}
          >
            Custom date
          </button>
        </div>
        <input
          type="date"
          value={contractDocumentFormAppliedVersionDate}
          onChange={(e) => setContractDocumentFormAppliedVersionDate(e.target.value)}
          disabled={!contractDocumentFormAppliedVersionDate}
          aria-label="Custom applied date"
          style={{ padding: '0.375rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
        />
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.45rem 0 0', lineHeight: 1.45 }}>
        {contractDocumentFormAppliedVersionDate
          ? 'This date is stored on this person’s copy and shown in the Applied version column — Contract Book edits won’t move it.'
          : 'Shows the date the pinned/assigned Contract Book copy was last edited; it moves when the book is edited again.'}
      </p>
    </div>
  )

  const handleContractAddTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const goRequest = e.key === 'ArrowRight' && contractDocumentAddTab === 'upload_signed'
      const goUpload = e.key === 'ArrowLeft' && contractDocumentAddTab === 'request_signature'
      if (goRequest) {
        setContractDocumentAddTab('request_signature')
        setContractDocumentFormStatus('unsent')
        requestAnimationFrame(() => {
          document.getElementById(`${contractAddDocTabBaseId}-tab-request`)?.focus()
        })
      } else if (goUpload) {
        setContractDocumentAddTab('upload_signed')
        setContractDocumentFormStatus('signed')
        requestAnimationFrame(() => {
          document.getElementById(`${contractAddDocTabBaseId}-tab-upload`)?.focus()
        })
      }
    },
    [contractAddDocTabBaseId, contractDocumentAddTab, setContractDocumentFormStatus],
  )

  async function loadContracts() {
    setContractsLoading(true)
    setContractsError(null)
    const [templatesRes, templateDocsRes, assignmentsRes, documentsRes] = await Promise.all([
      supabase.from('contract_templates').select('id, name, sequence_order, created_at').order('sequence_order'),
      supabase
        .from('contract_template_documents')
        .select(
          'id, template_id, document_name, sequence_order, book_body_html, book_body_format, tags, canonical_document_url, updated_at, book_version_date, audience, form_template_id',
        )
        .order('template_id')
        .order('sequence_order'),
      supabase.from('person_contract_assignments').select('id, person_name, template_id'),
      supabase
        .from('person_contract_documents')
        .select(
          'id, person_name, document_name, url, signing_body_html, signing_body_format, canonical_document_url, status, signed_at, sent_at, signer_last_viewed_at, note, dashboard_prompt_after_clock_in, applied_contract_template_document_id, applied_version_date, contract_lineage_id, lineage_version, supersedes_person_contract_document_id, form_template_id, office_completed_at',
        ),
    ])
    setContractsLoading(false)
    if (templatesRes.error) setContractsError(templatesRes.error.message)
    else if (templateDocsRes.error) setContractsError(templateDocsRes.error.message)
    else if (assignmentsRes.error) setContractsError(assignmentsRes.error.message)
    else if (documentsRes.error) setContractsError(documentsRes.error.message)
    else {
      setContractTemplates((templatesRes.data ?? []) as ContractTemplate[])
      setContractTemplateDocuments((templateDocsRes.data ?? []) as ContractTemplateDocument[])
      // Which forms have an office half (PR 8): read those templates' schemas once.
      const formIds = [...new Set(((templateDocsRes.data ?? []) as ContractTemplateDocument[]).map((d) => d.form_template_id).filter((x): x is string => !!x))]
      if (formIds.length > 0) {
        const { data: tpls } = await supabase.from('contract_form_templates' as never).select('id, schema').in('id', formIds)
        setTwoPartyTemplateIds(twoPartyTemplateIdSet((tpls ?? []) as unknown as Array<{ id: string; schema: FormSchema | null }>))
      } else setTwoPartyTemplateIds(new Set())
      setPersonContractAssignments((assignmentsRes.data ?? []) as PersonContractAssignment[])
      setPersonContractDocuments((documentsRes.data ?? []) as unknown as PersonContractDocument[])
    }
  }

  function getAggregateStatus(docs: PersonContractTableRow[]): 'red' | 'yellow' | 'green' | null {
    if (docs.length === 0) return null
    const statuses = docs.map((d) => d.version?.status ?? 'unsent')
    if (statuses.some((s) => s === 'unsent')) return 'red'
    if (statuses.some((s) => s === 'sent')) return 'yellow'
    return 'green'
  }

  function getAggregateStatusForTemplate(personName: string, templateId: string): 'red' | 'yellow' | 'green' | null {
    const templateDocNames = new Set(
      contractTemplateDocuments.filter((d) => d.template_id === templateId).map((d) => d.document_name),
    )
    const rows = getDocumentsForPerson(personName).filter((r) => templateDocNames.has(r.document_name))
    return getAggregateStatus(rows)
  }

  /** Contract Book rows that match document name and one of the person’s assigned templates (for Applied version picker). */
  function listAppliedContractBookVersionOptions(
    personName: string,
    documentNameTrimmed: string,
  ): { value: string; label: string }[] {
    const dn = documentNameTrimmed.trim()
    if (!personName.trim() || !dn) return []
    const assignedIds = new Set(
      personContractAssignments.filter((a) => a.person_name === personName).map((a) => a.template_id),
    )
    const templateNameById = new Map(contractTemplates.map((t) => [t.id, t.name]))
    const rows: { value: string; label: string }[] = []
    for (const td of contractTemplateDocuments) {
      if (td.document_name !== dn) continue
      if (!assignedIds.has(td.template_id)) continue
      const tname = templateNameById.get(td.template_id) ?? td.template_id
      const datePart = effectiveBookVersionLabel(td) ?? '—'
      rows.push({ value: td.id, label: `${tname} · ${datePart}` })
    }
    rows.sort((a, b) => a.label.localeCompare(b.label))
    return rows
  }

  function resolveAppliedContractTemplateDocIdForSave(
    personName: string,
    documentName: string,
    chosenRaw: string,
  ): string | null {
    const chosen = chosenRaw.trim()
    if (!chosen) return null
    const allowed = new Set(listAppliedContractBookVersionOptions(personName, documentName).map((o) => o.value))
    return allowed.has(chosen) ? chosen : null
  }

  /** Roster email for a contracts person (people first, then users; name-keyed like everything on this tab). Prefills the Send modal's signer email. */
  function rosterEmailForPersonName(personName: string): string {
    const wanted = personName.trim()
    if (!wanted) return ''
    const fromPeople = people.find((p) => (p.name ?? '').trim() === wanted)?.email
    if (fromPeople?.trim()) return fromPeople.trim()
    const fromUsers = users.find((u) => (u.name ?? '').trim() === wanted)?.email
    return fromUsers?.trim() ?? ''
  }

  /** Cards whenever the documents list is actually narrow: phone viewports, or the left lane while the Agreements panel is open (v2.1408 — the panel squeezes the lane to ~5/12). */
  const contractsDocsAsCards = contractsNarrowViewport || (contractsWideViewport && !agreementsPanelHidden)

  const agreementSummaries = useMemo(
    () =>
      buildAgreementSummaries({
        templates: contractTemplates,
        templateDocuments: contractTemplateDocuments,
        assignments: personContractAssignments,
        personDocuments: personContractDocuments,
      }),
    [contractTemplates, contractTemplateDocuments, personContractAssignments, personContractDocuments],
  )

  /** Agreement documents the quick-send picker can serve: some copy somewhere has signable content. */
  const quickSendDocumentNames = useMemo(() => {
    const names = new Set<string>()
    for (const s of agreementSummaries) {
      if (
        resolveQuickSendSource({
          documentName: s.documentName,
          templateDocuments: contractTemplateDocuments,
          personDocuments: personContractDocuments,
        })
      ) {
        names.add(s.documentName)
      }
    }
    return names
  }, [agreementSummaries, contractTemplateDocuments, personContractDocuments])

  /**
   * Quick send, step 2 (v2.1410; write-after-confirm since decision 17,
   * 2026-09-05): a person was picked for a document. Decide the plan from the
   * caches — reuse their best unsent/sent copy when it already has signing
   * content, fill an empty placeholder, or create a fresh ad-hoc unsent copy —
   * but WRITE NOTHING here. The Send modal opens on the plan; `fill`/`insert`
   * run inside Send email, so canceling the modal leaves nothing behind and
   * an abandoned pick never counts toward "Needs attention" or the rail's
   * unsent totals.
   */
  function openQuickSendForPerson(documentName: string, personName: string) {
    setContractsError(null)
    const existing = quickSendReusablePersonRow({
      documentName,
      personName,
      personDocuments: personContractDocuments,
    })
    const plan = quickSendPlan({
      existing,
      source: resolveQuickSendSource({
        documentName,
        templateDocuments: contractTemplateDocuments,
        personDocuments: personContractDocuments,
      }),
    })
    if (plan.kind === 'no-content') {
      setContractsError(
        `No signable content found for “${documentName}” — add contract text to its Contract Book entry first.`,
      )
      return
    }
    setQuickSendDocumentName(null)
    setContractSendDocId(plan.kind === 'insert' ? null : plan.docId)
    setContractSendQuickSend({ personName, documentName, plan })
    setContractSendEmail(rosterEmailForPersonName(personName))
    setContractSendSubject('')
    setContractSendIntro('')
    setContractSendModalOpen(true)
  }

  /**
   * The write a quick-send pick deferred: fill the placeholder or insert the
   * unsent row, returning the id the send function needs. Called from Send
   * email only. Throws on failure (the caller shows the message and keeps the
   * modal open, nothing minted).
   */
  async function materializeQuickSendRow(pending: {
    personName: string
    documentName: string
    plan: Extract<QuickSendPlan, { kind: 'fill' | 'insert' }>
  }): Promise<string> {
    const { plan } = pending
    const source = plan.source
    if (plan.kind === 'fill') {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('person_contract_documents')
            .update({
              signing_body_html: source.signingBodyHtml,
              signing_body_format: source.signingBodyFormat,
              canonical_document_url: source.canonicalDocumentUrl,
              ...(source.kind === 'book'
                ? { applied_contract_template_document_id: source.appliedTemplateDocumentId }
                : {}),
            })
            .eq('id', plan.docId),
        'fill quick send content',
      )
      return plan.docId
    }
    const inserted = await withSupabaseRetry<{ id: string }>(
      async () =>
        supabase
          .from('person_contract_documents')
          .insert({
            person_name: pending.personName,
            document_name: pending.documentName,
            contract_lineage_id: globalThis.crypto.randomUUID(),
            lineage_version: 1,
            supersedes_person_contract_document_id: null,
            status: 'unsent',
            signing_body_html: source.signingBodyHtml,
            signing_body_format: source.signingBodyFormat,
            canonical_document_url: source.canonicalDocumentUrl,
            applied_contract_template_document_id:
              source.kind === 'book' ? source.appliedTemplateDocumentId : null,
          })
          .select('id')
          .single(),
      'create quick send document',
    )
    if (!inserted?.id) throw new Error('Could not create the document copy.')
    return inserted.id
  }

  /** Agreements-panel row click: select the person, un-hide them if the filter would, and scroll their row into view. */
  const jumpToContractsPerson = (personName: string) => {
    setSelectedContractsPersonName(personName)
    if (contractsArchivedNames.includes(personName)) setContractsArchivedSectionOpen(true)
    if (
      !contractsSearchNormalized &&
      !personVisibleUnderContractsFilter(contractsRosterBuckets.bucketByPerson.get(personName) ?? 'none', contractsRosterFilterActive)
    ) {
      setContractsRosterFilter('everyone')
    }
    window.setTimeout(() => {
      document.querySelector(`[data-contracts-person-row="${CSS.escape(personName)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }

  /** Actions cluster for one document row — shared verbatim by the desktop table cell and the narrow-viewport cards (v2.1405). */
  const renderContractDocActions = (personName: string, document_name: string, doc: PersonContractDocument | null) => (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                                                  {doc && officeSectionPending(doc, twoPartyTemplateIds) ? (
                                                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, background: 'var(--bg-amber-tint, #fdf1e3)', color: 'var(--text-amber-700, #9a5b12)', whiteSpace: 'nowrap' }} title="Signed; the office has not completed its section yet">
                                                      office section pending
                                                    </span>
                                                  ) : null}
                                                  {doc?.status === 'signed' ? (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setContractSignedRecordModalDocId(doc.id)
                                                      }}
                                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                                    >
                                                      View signed
                                                    </button>
                                                  ) : null}
                                                  {doc && hasContractSigningContent(doc) && doc.status !== 'signed' ? (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setContractSendDocId(doc.id)
                                                        setContractSendEmail(rosterEmailForPersonName(personName))
                                                        setContractSendSubject('')
                                                        setContractSendIntro('')
                                                        setContractsError(null)
                                                        setContractSendModalOpen(true)
                                                      }}
                                                      style={{
                                                        padding: '0.2rem 0.4rem',
                                                        fontSize: '0.75rem',
                                                        background: '#0ea5e9',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                      }}
                                                    >
                                                      {doc.status === 'sent' ? 'Resend' : 'Send'}
                                                    </button>
                                                  ) : null}
                                                  {doc && doc.status !== 'signed' ? (
                                                    <label
                                                      style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        fontSize: '0.7rem',
                                                        cursor: contractDashboardPromptSavingId === doc.id ? 'wait' : 'pointer',
                                                        userSelect: 'none',
                                                      }}
                                                      title="After each clock-in, show on this person’s Dashboard until signed"
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={!!doc.dashboard_prompt_after_clock_in}
                                                        disabled={contractDashboardPromptSavingId === doc.id}
                                                        onChange={(e) => {
                                                          e.stopPropagation()
                                                          void toggleContractDashboardPrompt(doc.id, e.target.checked)
                                                        }}
                                                      />
                                                      Dashboard
                                                    </label>
                                                  ) : null}
                                                  {doc ? (
                                                    <div
                                                      data-contract-doc-menu-wrap={doc.id}
                                                      style={{
                                                        position: 'relative',
                                                        display: 'inline-flex',
                                                        verticalAlign: 'middle',
                                                      }}
                                                    >
                                                      <button
                                                        type="button"
                                                        aria-label={`More actions for ${document_name}`}
                                                        aria-haspopup="menu"
                                                        aria-expanded={contractsDocumentActionsMenuOpenId === doc.id}
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          setContractsDocumentActionsMenuOpenId((id) =>
                                                            id === doc.id ? null : doc.id,
                                                          )
                                                        }}
                                                        style={{
                                                          padding: '0.15rem 0.35rem',
                                                          fontSize: '1rem',
                                                          lineHeight: 1,
                                                          border: '1px solid var(--border-strong)',
                                                          borderRadius: 4,
                                                          background: 'var(--surface)',
                                                          cursor: 'pointer',
                                                        }}
                                                      >
                                                        ⋯
                                                      </button>
                                                      {contractsDocumentActionsMenuOpenId === doc.id ? (
                                                        <div
                                                          role="menu"
                                                          style={{
                                                            position: 'absolute',
                                                            top: '100%',
                                                            right: 0,
                                                            marginTop: 2,
                                                            zIndex: 20,
                                                            minWidth: 140,
                                                            background: 'var(--surface)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 6,
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                                            padding: '0.25rem 0',
                                                          }}
                                                        >
                                                          <button
                                                            type="button"
                                                            role="menuitem"
                                                            onClick={(e) => {
                                                              e.stopPropagation()
                                                              setContractsDocumentActionsMenuOpenId(null)
                                                              openContractDocumentEditModal(personName, document_name, doc)
                                                            }}
                                                            style={{
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              width: '100%',
                                                              padding: '0.35rem 0.65rem',
                                                              fontSize: '0.8125rem',
                                                              border: 'none',
                                                              background: 'transparent',
                                                              cursor: 'pointer',
                                                              color: 'var(--text-strong)',
                                                              textAlign: 'left',
                                                            }}
                                                          >
                                                            Edit
                                                          </button>
                                                          {canDeletePeopleContracts ? (
                                                            <button
                                                              type="button"
                                                              role="menuitem"
                                                              onClick={(e) => {
                                                                e.stopPropagation()
                                                                setContractsDocumentActionsMenuOpenId(null)
                                                                setContractDocumentDeleteTarget(doc)
                                                                setContractDocumentDeleteConfirmOpen(true)
                                                              }}
                                                              style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.35rem',
                                                                width: '100%',
                                                                padding: '0.35rem 0.65rem',
                                                                fontSize: '0.8125rem',
                                                                border: 'none',
                                                                background: 'transparent',
                                                                cursor: 'pointer',
                                                                color: 'var(--text-red-700)',
                                                                textAlign: 'left',
                                                              }}
                                                            >
                                                              <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width={14}
                                                                height={14}
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth={2}
                                                                aria-hidden
                                                              >
                                                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
                                                              </svg>
                                                              Delete
                                                            </button>
                                                          ) : null}
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  ) : null}
    </div>
  )

  function getDocumentsForPerson(personName: string): PersonContractTableRow[] {
    const assignedTemplateIds = personContractAssignments.filter((a) => a.person_name === personName).map((a) => a.template_id)
    const docNamesFromTemplates = new Set<string>()
    const docToTemplateNames = new Map<string, string[]>()
    // Doc name → latest effective version date ('YYYY-MM-DD': book_version_date wins over updated_at's app-tz day).
    const docNameToBookUpdated = new Map<string, string>()
    for (const tid of assignedTemplateIds) {
      const template = contractTemplates.find((t) => t.id === tid)
      const templateName = template?.name ?? ''
      for (const td of contractTemplateDocuments.filter((d) => d.template_id === tid)) {
        docNamesFromTemplates.add(td.document_name)
        const arr = docToTemplateNames.get(td.document_name) ?? []
        if (!arr.includes(templateName)) arr.push(templateName)
        docToTemplateNames.set(td.document_name, arr)
        const u = effectiveBookVersionPlainDate(td)
        if (u) {
          const prev = docNameToBookUpdated.get(td.document_name)
          if (!prev || u > prev) docNameToBookUpdated.set(td.document_name, u)
        }
      }
    }

    const rowsP = personContractDocuments.filter((d) => d.person_name === personName)
    const byLineage = new Map<string, PersonContractDocument[]>()
    for (const r of rowsP) {
      const arr = byLineage.get(r.contract_lineage_id) ?? []
      arr.push(r)
      byLineage.set(r.contract_lineage_id, arr)
    }

    const bookForVersion = (document_name: string, doc: PersonContractDocument | null): string | null => {
      if (!doc) return docNameToBookUpdated.get(document_name) ?? null
      const pinId = doc.applied_contract_template_document_id ?? null
      let bookLastEditedAt: string | null = null
      if (pinId) {
        const pinned = contractTemplateDocuments.find((d) => d.id === pinId)
        const pinOk =
          pinned &&
          pinned.document_name === document_name &&
          assignedTemplateIds.includes(pinned.template_id)
        if (pinOk) {
          bookLastEditedAt = effectiveBookVersionPlainDate(pinned)
        }
      }
      if (bookLastEditedAt == null) {
        bookLastEditedAt = docNameToBookUpdated.get(document_name) ?? null
      }
      return bookLastEditedAt
    }

    const tableRows: PersonContractTableRow[] = []
    for (const [, vers] of byLineage) {
      const sorted = [...vers].sort((a, b) => b.lineage_version - a.lineage_version)
      const document_name = sorted[0]!.document_name
      const templateNames = docToTemplateNames.get(document_name) ?? []
      for (const v of sorted) {
        tableRows.push({
          document_name,
          lineageId: v.contract_lineage_id,
          templateNames,
          bookLastEditedAt: bookForVersion(document_name, v),
          version: v,
        })
      }
    }

    const namesWithRows = new Set(rowsP.map((r) => r.document_name))
    for (const document_name of docNamesFromTemplates) {
      if (namesWithRows.has(document_name)) continue
      tableRows.push({
        document_name,
        lineageId: null,
        templateNames: docToTemplateNames.get(document_name) ?? [],
        bookLastEditedAt: docNameToBookUpdated.get(document_name) ?? null,
        version: null,
      })
    }

    tableRows.sort((a, b) => {
      const c = a.document_name.localeCompare(b.document_name)
      if (c !== 0) return c
      const va = a.version?.lineage_version ?? 0
      const vb = b.version?.lineage_version ?? 0
      return vb - va
    })
    return tableRows
  }

  /** Archived names win over active twins (v2.1409): archiving a user account often leaves its linked
   *  roster person active (Bill/Juan/Joseph pattern) — a name archived as EITHER entity belongs in the
   *  Archived section, not the active list. */
  const contractsArchivedNameSet = useMemo(() => {
    const names = new Set<string>()
    for (const p of archivedPeople ?? []) {
      const n = (p.name ?? '').trim()
      if (n) names.add(n)
    }
    for (const raw of archivedUserNames ?? []) {
      const n = raw.trim()
      if (n) names.add(n)
    }
    return names
  }, [archivedPeople, archivedUserNames])

  const contractsPersonNamesSorted = useMemo(() => {
    return [...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])]
      .filter((n): n is string => Boolean(n?.trim()))
      .filter((n) => !contractsArchivedNameSet.has(n.trim()))
      .sort((a, b) => a.localeCompare(b))
  }, [people, users, contractsArchivedNameSet])

  const contractsSearchNormalized = useMemo(() => contractsSearchQuery.trim().toLowerCase(), [contractsSearchQuery])

  /** Archived roster names (people + user accounts) not shadowed by an active name — the bottom Archived section. */
  const contractsArchivedNames = useMemo(
    () => [...contractsArchivedNameSet].sort((a, b) => a.localeCompare(b)),
    [contractsArchivedNameSet],
  )

    const [contractsRosterFilterStored, setContractsRosterFilterStored] = useState<ContractsRosterFilter | null>(() => {
    try {
      return parseContractsRosterFilter(typeof window !== 'undefined' ? window.localStorage.getItem(CONTRACTS_ROSTER_FILTER_STORAGE_KEY) : null)
    } catch {
      return null
    }
  })
  /** person name → roster bucket + per-bucket totals for the chip labels. */
  const contractsRosterBuckets = useMemo(() => {
    const bucketByPerson = new Map<string, ContractsRosterBucket>()
    const totals = { attention: 0, waiting: 0, done: 0, everyone: contractsPersonNamesSorted.length }
    for (const personName of contractsPersonNamesSorted) {
      const personRows = getDocumentsForPerson(personName)
      const officePending = personRows.filter((r) => r.version && officeSectionPending(r.version, twoPartyTemplateIds)).length
      const bucket = contractsRosterBucket(countPersonContractStatuses(personRows), officePending)
      bucketByPerson.set(personName, bucket)
      if (bucket === 'attention') totals.attention++
      else if (bucket === 'waiting') totals.waiting++
      else if (bucket === 'done') totals.done++
    }
    return { bucketByPerson, totals }
  }, [
    contractsPersonNamesSorted,
    contractTemplates,
    contractTemplateDocuments,
    personContractAssignments,
    personContractDocuments,
  ])
  const contractsRosterFilterActive: ContractsRosterFilter =
    contractsRosterFilterStored ?? defaultContractsRosterFilter(contractsRosterBuckets.totals.attention)
  const setContractsRosterFilter = (f: ContractsRosterFilter) => {
    setContractsRosterFilterStored(f)
    try {
      window.localStorage.setItem(CONTRACTS_ROSTER_FILTER_STORAGE_KEY, f)
    } catch {
      /* per-device preference only */
    }
  }

  const contractsPersonNamesFiltered = useMemo(() => {
    if (!contractsSearchNormalized) {
      return contractsPersonNamesSorted.filter((personName) =>
        personVisibleUnderContractsFilter(
          contractsRosterBuckets.bucketByPerson.get(personName) ?? 'none',
          contractsRosterFilterActive,
        ),
      )
    }
    return contractsPersonNamesSorted.filter((personName) => {
      if (personName.toLowerCase().includes(contractsSearchNormalized)) return true
      return getDocumentsForPerson(personName).some(({ document_name }) =>
        document_name.toLowerCase().includes(contractsSearchNormalized),
      )
    })
  }, [
    contractsPersonNamesSorted,
    contractsSearchNormalized,
    contractsRosterBuckets,
    contractsRosterFilterActive,
    contractTemplates,
    contractTemplateDocuments,
    personContractAssignments,
    personContractDocuments,
  ])

  const contractsArchivedVisible = useMemo(() => {
    if (!contractsSearchNormalized) return contractsArchivedNames
    return contractsArchivedNames.filter((personName) => {
      if (personName.toLowerCase().includes(contractsSearchNormalized)) return true
      return getDocumentsForPerson(personName).some(({ document_name }) =>
        document_name.toLowerCase().includes(contractsSearchNormalized),
      )
    })
  }, [
    contractsArchivedNames,
    contractsSearchNormalized,
    contractTemplates,
    contractTemplateDocuments,
    personContractAssignments,
    personContractDocuments,
  ])
  const contractsArchivedOpen =
    contractsArchivedSectionOpen || (!!contractsSearchNormalized && contractsArchivedVisible.length > 0)

    const contractDocumentSearchLines = useMemo(() => {
    if (!contractsSearchNormalized) return []
    const lines: { personName: string; document_name: string; status: string }[] = []
    for (const personName of contractsPersonNamesSorted) {
      for (const row of getDocumentsForPerson(personName)) {
        if (row.document_name.toLowerCase().includes(contractsSearchNormalized)) {
          lines.push({
            personName,
            document_name: row.document_name,
            status: row.version?.status ?? 'unsent',
          })
        }
      }
    }
    lines.sort(
      (a, b) => a.personName.localeCompare(b.personName) || a.document_name.localeCompare(b.document_name),
    )
    return lines
  }, [
    contractsSearchNormalized,
    contractsPersonNamesSorted,
    contractTemplates,
    contractTemplateDocuments,
    personContractAssignments,
    personContractDocuments,
  ])

  // The signer's portal address, read the way the send function reads it: one non-archived
  // roster row with that name, a saved slug, and an unrevoked link. Nothing is minted.
  /**
   * Who and what the Send modal is about — from the saved row when there is
   * one, else from the not-yet-written quick-send pick. Null when the modal is
   * closed or the row vanished under it.
   */
  const contractSendTarget = useMemo<{ personName: string; documentName: string } | null>(() => {
    if (contractSendDocId) {
      const doc = personContractDocuments.find((d) => d.id === contractSendDocId)
      if (doc) return { personName: doc.person_name, documentName: doc.document_name }
      if (!contractSendQuickSend) return null
    }
    if (contractSendQuickSend) return { personName: contractSendQuickSend.personName, documentName: contractSendQuickSend.documentName }
    return null
  }, [contractSendDocId, contractSendQuickSend, personContractDocuments])

  useEffect(() => {
    if (!contractSendModalOpen || !contractSendTarget) return
    const wanted = contractSendTarget.personName.trim()
    const matches = people.filter((p) => (p.name ?? '').trim() === wanted)
    if (matches.length !== 1) {
      setContractSendPortalUrl(null)
      return
    }
    const personId = matches[0]!.id
    let cancelled = false
    void (async () => {
      try {
        const [slugRes, linkRes] = await Promise.all([
          supabase.from('sub_portal_slugs' as never).select('slug').eq('person_id', personId).maybeSingle(),
          supabase.from('sub_portal_links' as never).select('id').eq('person_id', personId).is('revoked_at', null).limit(1),
        ])
        if (cancelled) return
        const slug = ((slugRes.data as { slug?: string | null } | null)?.slug ?? '').trim()
        const live = ((linkRes.data ?? []) as unknown[]).length > 0
        setContractSendPortalUrl(slug && live ? `${PORTAL_SHORT_ORIGIN}${slug}` : null)
      } catch {
        if (!cancelled) setContractSendPortalUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [contractSendModalOpen, contractSendTarget, people])

  const contractSendEmailPreview = useMemo(() => {
    if (!contractSendDocId && !contractSendQuickSend) return null
    if (!contractSendTarget) return { kind: 'missing' as const }
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin.replace(/\/$/, '')
        : 'https://pipetooling.github.io'
    const me = currentUserId ? users.find((u) => u.id === currentUserId) : undefined
    const sender = me?.email ? { name: (me.name ?? '').trim(), email: me.email.trim() } : null
    const sentYmd = todayYmdInAppTz()
    return {
      kind: 'ok' as const,
      ...buildContractSigningEmail({
        documentName: contractSendTarget.documentName,
        personName: contractSendTarget.personName,
        acceptUrl: `${origin}/contract/accept?t=…`,
        expiresYmd: ymdAddDays(sentYmd, 14),
        sentYmd,
        subjectOverride: contractSendSubject,
        introPlain: contractSendIntro,
        sender,
        portalUrl: contractSendPortalUrl,
        officePhone: PORTAL_COMPANY.phone || null,
      }),
    }
  }, [contractSendDocId, contractSendQuickSend, contractSendTarget, contractSendSubject, contractSendIntro, currentUserId, users, contractSendPortalUrl])

  function getContractDocumentUpsertPayload():
    | { error: string }
    | {
        payload: {
          person_name: string
          document_name: string
          url: string | null
          signing_body_html: string | null
          signing_body_format: ContractBodyFormat
          canonical_document_url: string | null
          status: 'unsent' | 'sent' | 'signed'
          signed_at: string | null
          note: string | null
          dashboard_prompt_after_clock_in: boolean
          applied_contract_template_document_id: string | null
          applied_version_date: string | null
        }
      } {
    const personName = contractDocumentFormPersonName.trim()
    const documentName = contractDocumentFormDocumentName.trim()
    if (!personName || !documentName) {
      return { error: 'Person and document name are required.' }
    }
    const isAddRequestSignatureTab =
      !editingContractDocument && contractDocumentAddTab === 'request_signature'
    const isAddUploadSignedTab =
      !editingContractDocument && contractDocumentAddTab === 'upload_signed'
    const statusForSave: 'unsent' | 'sent' | 'signed' = isAddRequestSignatureTab
      ? 'unsent'
      : isAddUploadSignedTab
        ? 'signed'
        : contractDocumentFormStatus
    const dashboardForSave =
      isAddUploadSignedTab
        ? false
        : contractDocumentFormStatus === 'signed'
          ? false
          : contractDocumentFormDashboardPrompt
    const signingBodyFormatForSave: ContractBodyFormat = isAddUploadSignedTab ? 'html' : contractDocumentFormSigningBodyFormat
    const signingBodyStored = isAddUploadSignedTab
      ? null
      : normalizeContractBodyForSave(contractDocumentFormSigningBodyHtml, contractDocumentFormSigningBodyFormat)
    const appliedId =
      isAddUploadSignedTab
        ? null
        : resolveAppliedContractTemplateDocIdForSave(
            personName,
            documentName,
            contractDocumentFormAppliedTemplateDocId,
          )
    return {
      payload: {
        person_name: personName,
        document_name: documentName,
        url: isAddRequestSignatureTab ? null : contractDocumentFormUrl.trim() || null,
        signing_body_html: signingBodyStored,
        signing_body_format: signingBodyFormatForSave,
        canonical_document_url: isAddUploadSignedTab ? null : contractDocumentFormCanonicalUrl.trim() || null,
        status: statusForSave,
        signed_at: isAddRequestSignatureTab ? null : contractDocumentFormSignedAt.trim() || null,
        note: isAddRequestSignatureTab ? null : contractDocumentFormNote.trim() || null,
        dashboard_prompt_after_clock_in: dashboardForSave,
        applied_contract_template_document_id: appliedId,
        applied_version_date: isAddUploadSignedTab ? null : contractDocumentFormAppliedVersionDate.trim() || null,
      },
    }
  }

  const handlePickContractFromBook = useCallback(
    (entry: ContractBookTemplateDocument) => {
      setContractDocumentFormSigningBodyHtml(entry.book_body_html ?? '')
      setContractDocumentFormSigningBodyFormat(parseContractBodyFormat(entry.book_body_format))
      setContractDocumentFormDocumentName((prev) => (prev.trim() ? prev : entry.document_name))
      setContractDocumentFormCanonicalUrl((prev) =>
        prev.trim() ? prev : entry.canonical_document_url?.trim() ?? '',
      )
      setContractDocumentFormAppliedTemplateDocId(entry.id)
      setContractBookModalOpen(false)
      showToast('Contract details loaded from library.', 'success')
    },
    [showToast],
  )

  const contractBookPickFromDocumentModal =
    contractDocumentModalOpen &&
    (Boolean(editingContractDocument) || contractDocumentAddTab === 'request_signature')

  async function saveContractDocument() {
    const built = getContractDocumentUpsertPayload()
    if ('error' in built) {
      setContractsError(built.error)
      return
    }
    setContractDocumentFormSaving(true)
    setContractsError(null)
    try {
      const p = built.payload
      if (editingContractDocument) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('person_contract_documents')
              .update({
                url: p.url,
                signing_body_html: p.signing_body_html,
                signing_body_format: p.signing_body_format,
                canonical_document_url: p.canonical_document_url,
                status: p.status,
                signed_at: p.signed_at,
                note: p.note,
                dashboard_prompt_after_clock_in: p.dashboard_prompt_after_clock_in,
                applied_contract_template_document_id: p.applied_contract_template_document_id,
                applied_version_date: p.applied_version_date,
              })
              .eq('id', editingContractDocument.id)
              .select('id')
              .single(),
          'save contract document',
        )
      } else {
        const lid = globalThis.crypto.randomUUID()
        await withSupabaseRetry(
          async () =>
            supabase
              .from('person_contract_documents')
              .insert({
                person_name: p.person_name,
                document_name: p.document_name,
                contract_lineage_id: lid,
                lineage_version: 1,
                supersedes_person_contract_document_id: null,
                url: p.url,
                signing_body_html: p.signing_body_html,
                signing_body_format: p.signing_body_format,
                canonical_document_url: p.canonical_document_url,
                status: p.status,
                signed_at: p.signed_at,
                note: p.note,
                dashboard_prompt_after_clock_in: p.dashboard_prompt_after_clock_in,
                applied_contract_template_document_id: p.applied_contract_template_document_id,
                applied_version_date: p.applied_version_date,
              })
              .select('id')
              .single(),
          'save contract document',
        )
      }
      setContractDocumentModalOpen(false)
      setContractDocumentDeleteConfirmOpen(false)
      setContractDocumentDeleteTarget(null)
      loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to save document')
    } finally {
      setContractDocumentFormSaving(false)
    }
  }

  async function toggleContractDashboardPrompt(docId: string, next: boolean) {
    setContractDashboardPromptSavingId(docId)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('person_contract_documents').update({ dashboard_prompt_after_clock_in: next }).eq('id', docId),
        'toggle contract dashboard prompt',
      )
      await loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setContractDashboardPromptSavingId(null)
    }
  }

  function openContractDocumentEditModal(
    personNameForEdit: string,
    documentNameForEdit: string,
    docRow: PersonContractDocument,
  ) {
    setEditingContractDocument(docRow)
    setContractDocumentFormPersonName(personNameForEdit)
    setContractDocumentFormDocumentName(documentNameForEdit)
    setContractDocumentFormUrl(docRow.url ?? '')
    setContractDocumentFormSigningBodyHtml(docRow.signing_body_html ?? '')
    setContractDocumentFormSigningBodyFormat(parseContractBodyFormat(docRow.signing_body_format))
    setContractDocumentFormCanonicalUrl(docRow.canonical_document_url ?? '')
    setContractDocumentFormStatus((docRow.status as 'unsent' | 'sent' | 'signed') ?? 'unsent')
    setContractDocumentFormSignedAt(docRow.signed_at ?? '')
    setContractDocumentFormNote(docRow.note ?? '')
    setContractDocumentFormDashboardPrompt(!!docRow.dashboard_prompt_after_clock_in)
    setContractDocumentFormAppliedTemplateDocId(
      (() => {
        const pin = docRow.applied_contract_template_document_id ?? ''
        const opts = listAppliedContractBookVersionOptions(personNameForEdit, documentNameForEdit)
        return pin && opts.some((o) => o.value === pin) ? pin : ''
      })(),
    )
    setContractDocumentFormAppliedVersionDate(docRow.applied_version_date ?? '')
    setCanonicalUrlCheckStatus('idle')
    setCanonicalUrlCheckMessage('')
    setContractDocumentModalOpen(true)
  }

  async function deleteContractDocument() {
    if (!canDeletePeopleContracts) return
    if (!contractDocumentDeleteTarget || !isDeletablePersonContractStatus(contractDocumentDeleteTarget.status)) return
    const deletedId = contractDocumentDeleteTarget.id
    setContractDocumentDeleting(true)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('person_contract_documents').delete().eq('id', deletedId),
        'delete contract document',
      )
      setContractDocumentDeleteConfirmOpen(false)
      setContractDocumentDeleteTarget(null)
      if (editingContractDocument?.id === deletedId) {
        setContractDocumentModalOpen(false)
        setEditingContractDocument(null)
      }
      showToast('Document deleted.', 'success')
      void loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to delete document')
    } finally {
      setContractDocumentDeleting(false)
    }
  }

  async function saveContractDocumentAndOpenSend() {
    if (editingContractDocument || contractDocumentAddTab !== 'request_signature') return
    const built = getContractDocumentUpsertPayload()
    if ('error' in built) {
      setContractsError(built.error)
      return
    }
    if (
      !hasContractSigningContent({
        signing_body_html: built.payload.signing_body_html,
        canonical_document_url: built.payload.canonical_document_url,
        url: built.payload.url,
      })
    ) {
      setContractsError(
        'Add contract text, a canonical document URL, or a reference link before sending for signature.',
      )
      return
    }
    setContractDocumentFormSaving(true)
    setContractsError(null)
    try {
      const p = built.payload
      const lid = globalThis.crypto.randomUUID()
      const row = await withSupabaseRetry<{ id: string }>(
        async () =>
          supabase
            .from('person_contract_documents')
            .insert({
              person_name: p.person_name,
              document_name: p.document_name,
              contract_lineage_id: lid,
              lineage_version: 1,
              supersedes_person_contract_document_id: null,
              url: p.url,
              signing_body_html: p.signing_body_html,
              signing_body_format: p.signing_body_format,
              canonical_document_url: p.canonical_document_url,
              applied_version_date: p.applied_version_date,
              status: p.status,
              signed_at: p.signed_at,
              note: p.note,
              dashboard_prompt_after_clock_in: p.dashboard_prompt_after_clock_in,
              applied_contract_template_document_id: p.applied_contract_template_document_id,
            })
            .select('id')
            .single(),
        'save contract document',
      )
      if (!row.id) {
        setContractsError('Could not save document.')
        return
      }
      setContractDocumentModalOpen(false)
      setContractDocumentDeleteConfirmOpen(false)
      setContractDocumentDeleteTarget(null)
      setContractSendDocId(row.id)
      setContractSendQuickSend(null)
      setContractSendEmail(rosterEmailForPersonName(p.person_name))
      setContractSendSubject('')
      setContractSendIntro('')
      setContractsError(null)
      setContractSendModalOpen(true)
      void loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to save document')
    } finally {
      setContractDocumentFormSaving(false)
    }
  }

  async function sendContractForSignature() {
    if ((!contractSendDocId && !contractSendQuickSend) || !contractSendEmail.trim()) {
      setContractsError('Enter a valid signer email.')
      return
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(contractSendEmail.trim())) {
      setContractsError('Enter a valid email address.')
      return
    }
    setContractSendSaving(true)
    setContractsError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setContractsError('Not signed in.')
        return
      }
      // The user just committed: this is where a quick-send pick becomes a row.
      // Pin the id immediately so a failed send retries against the same row
      // instead of minting a second one.
      let docId = contractSendDocId
      if (contractSendQuickSend && quickSendPlanWrites(contractSendQuickSend.plan)) {
        docId = await materializeQuickSendRow({
          personName: contractSendQuickSend.personName,
          documentName: contractSendQuickSend.documentName,
          plan: contractSendQuickSend.plan,
        })
        setContractSendDocId(docId)
        setContractSendQuickSend({ ...contractSendQuickSend, plan: { kind: 'reuse', docId } })
        void loadContracts()
      }
      if (!docId) {
        setContractsError('Could not prepare the document to send')
        return
      }
      const quickSendPlanKind = contractSendQuickSend?.plan.kind ?? null
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-for-signature`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
            apikey: anon,
          },
          body: JSON.stringify({
            person_contract_document_id: docId,
            signer_email: contractSendEmail.trim(),
            public_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            ...(contractSendSubject.trim()
              ? { email_subject: contractSendSubject.trim() }
              : {}),
            ...(contractSendIntro.trim()
              ? { email_intro_plain: contractSendIntro.trim() }
              : {}),
          }),
        },
      )
      const json = (await res.json()) as {
        ok?: boolean
        accept_url?: string
        emailed?: boolean
        email_error?: string
        warning?: string
        error?: string
      }
      if (!res.ok || !json.ok) {
        setContractsError(json.error || 'Send failed')
        return
      }
      showToast(
        json.emailed
          ? 'Signing link emailed.'
          : json.warning || json.email_error
            ? `Link ready${json.accept_url ? ` — ${json.accept_url}` : ''}`
            : 'Signing link created.',
        json.emailed ? 'success' : 'info',
      )
      if (quickSendPlanKind) recordNavClick(currentUserId, authRole, 'contract_quick_send_committed', `#${quickSendPlanKind}`)
      setContractSendModalOpen(false)
      setContractSendDocId(null)
      setContractSendQuickSend(null)
      setContractSendEmail('')
      setContractSendSubject('')
      setContractSendIntro('')
      void loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setContractSendSaving(false)
    }
  }

  /** Record the assignment, then make sure every packet document exists on the person — fill empty copies from the book, create missing ones as unsent. */
  async function materializePacketForPerson(personName: string, templateId: string) {
    await withSupabaseRetry(
      async () => supabase.from('person_contract_assignments').insert({ person_name: personName, template_id: templateId }),
      'assign packet to person',
    )
    const templateDocs = contractTemplateDocuments.filter((d) => d.template_id === templateId)
    for (const td of templateDocs) {
      const candidates = personContractDocuments.filter(
        (d) => d.person_name === personName && d.document_name === td.document_name,
      )
      const existing =
        candidates.length === 0
          ? undefined
          : [...candidates].sort((a, b) => b.lineage_version - a.lineage_version)[0]
      const fillSigningFromBook = !existing?.signing_body_html?.trim()
      if (existing) {
        const updatePayload = fillSigningFromBook
          ? {
              canonical_document_url: td.canonical_document_url?.trim() || null,
              signing_body_html: td.book_body_html ?? null,
              signing_body_format: td.book_body_format,
              applied_contract_template_document_id: td.id,
            }
          : {
              canonical_document_url: td.canonical_document_url?.trim() || null,
              applied_contract_template_document_id: td.id,
            }
        await withSupabaseRetry(
          async () =>
            supabase.from('person_contract_documents').update(updatePayload).eq('id', existing.id),
          'create person contract documents',
        )
      } else {
        const lid = globalThis.crypto.randomUUID()
        await withSupabaseRetry(
          async () =>
            supabase.from('person_contract_documents').insert({
              person_name: personName,
              document_name: td.document_name,
              contract_lineage_id: lid,
              lineage_version: 1,
              supersedes_person_contract_document_id: null,
              status: 'unsent',
              canonical_document_url: td.canonical_document_url?.trim() || null,
              signing_body_html: fillSigningFromBook ? td.book_body_html ?? null : null,
              signing_body_format: fillSigningFromBook ? td.book_body_format : 'html',
              applied_contract_template_document_id: td.id,
            }),
          'create person contract documents',
        )
      }
    }
  }

  async function assignSelectedPacketsToPerson() {
    const personName = selectedContractsPersonName
    if (!personName || assignPacketsSelectedIds.size === 0) {
      setContractsError('Pick at least one packet.')
      return
    }
    setAssignPacketsSaving(true)
    setContractsError(null)
    try {
      for (const templateId of assignPacketsSelectedIds) {
        const alreadyAssigned = personContractAssignments.some(
          (a) => a.person_name === personName && a.template_id === templateId,
        )
        if (alreadyAssigned) continue
        await materializePacketForPerson(personName, templateId)
      }
      setContractsAssignModalOpen(false)
      setAssignPacketsSelectedIds(new Set())
      loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to assign packets')
    } finally {
      setAssignPacketsSaving(false)
    }
  }

  async function unassignPacketFromPerson(templateId: string) {
    if (!canDeletePeopleContracts) return
    const personName = selectedContractsPersonName
    if (!personName) return
    const assignment = personContractAssignments.find((a) => a.person_name === personName && a.template_id === templateId)
    if (!assignment) {
      setContractsError('That packet is not assigned to this person.')
      return
    }
    setAssignPacketUnassigningTemplateId(templateId)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        () => supabase.from('person_contract_assignments').delete().eq('id', assignment.id),
        'unassign contract packet',
      )
      const pinnedIdsFromThisTemplate = contractTemplateDocuments
        .filter((d) => d.template_id === templateId)
        .map((d) => d.id)
      if (pinnedIdsFromThisTemplate.length > 0) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('person_contract_documents')
              .update({ applied_contract_template_document_id: null })
              .eq('person_name', personName)
              .in('applied_contract_template_document_id', pinnedIdsFromThisTemplate),
          'clear applied contract template pin on unassign',
        )
      }
      const templateDocNames = contractTemplateDocuments.filter((d) => d.template_id === templateId)
      for (const td of templateDocNames) {
        const pcds = personContractDocuments.filter(
          (d) => d.person_name === personName && d.document_name === td.document_name,
        )
        for (const pcd of pcds) {
          if (!personContractDocumentHasStaffData(pcd)) {
            await withSupabaseRetry(
              () => supabase.from('person_contract_documents').delete().eq('id', pcd.id),
              'remove empty person contract document after unassign',
            )
          }
        }
      }
      showToast('Packet unassigned.', 'success')
      await loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to unassign packet')
    } finally {
      setAssignPacketUnassigningTemplateId(null)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      loadContracts()
    }, 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Contracts</h2>
              <button
                type="button"
                onClick={() => setContractsHelpModalOpen(true)}
                title="How this tab works"
                aria-label="How this tab works"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  padding: 0,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontStyle: 'italic',
                  fontFamily: 'Georgia, serif',
                  border: '1.5px solid var(--border-blue)',
                  borderRadius: '50%',
                  background: 'transparent',
                  color: 'var(--text-blue-700)',
                  cursor: 'pointer',
                }}
              >
                i
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setContractLibraryModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  background: '#3b82f6',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <ContractBookIcon />
                Contract library
              </button>
            </div>
          </div>
          {contractsError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{contractsError}</p>}
          {contractsLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            <>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 5, minWidth: 0 }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor={contractsTabSearchInputId} style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.35rem', color: 'var(--text-700)' }}>
                  Search people and contracts
                </label>
                <input
                  id={contractsTabSearchInputId}
                  type="search"
                  value={contractsSearchQuery}
                  onChange={(e) => setContractsSearchQuery(e.target.value)}
                  placeholder="Search by person or contract name…"
                  autoComplete="off"
                  aria-label="Search people and contracts"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.5rem 0.65rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              {(() => {
                const queue = officeQueue(personContractDocuments, twoPartyTemplateIds)
                if (queue.length === 0) return null
                return (
                  <section aria-label="Office sections to complete" style={{ border: '1px solid var(--border)', borderLeft: '3px solid var(--border-amber, #d97706)', borderRadius: 6, background: 'var(--bg-amber-tint, #fdf1e3)', padding: '0.6rem 0.8rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                      Office sections to complete
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'var(--text-amber-700, #9a5b12)', color: '#fff', borderRadius: 999, padding: '0 0.45rem' }}>{queue.length}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>signed by the person; the PDF is not final until the office finishes its part</span>
                    </div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {queue.map((q) => (
                        <li key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.8125rem', padding: '0.25rem 0', borderTop: '1px solid var(--border)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-strong)', minWidth: 140 }}>{q.personName}</span>
                          <span style={{ color: 'var(--text-muted)', flex: 1 }}>
                            {q.documentName}
                            {q.signedAt ? ` · signed ${q.signedAt.slice(0, 10)}` : ''}
                            {/^Form I-9/i.test(q.documentName) ? ' · Section 2 is due within 3 business days of the first day of work' : ''}
                          </span>
                          <button type="button" onClick={() => setOfficeModalDocId(q.id)} style={{ padding: '0.3rem 0.7rem', fontWeight: 700, fontSize: '0.8125rem' }}>
                            Complete
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })()}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }} role="group" aria-label="Filter people by contract status">
                {(
                  [
                    { key: 'attention', label: `Needs attention · ${contractsRosterBuckets.totals.attention}` },
                    { key: 'waiting', label: `Waiting · ${contractsRosterBuckets.totals.waiting}` },
                    { key: 'done', label: `Done · ${contractsRosterBuckets.totals.done}` },
                    { key: 'everyone', label: `Everyone · ${contractsRosterBuckets.totals.everyone}` },
                  ] as const
                ).map(({ key, label }) => {
                  const active = contractsRosterFilterActive === key && !contractsSearchNormalized
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      disabled={!!contractsSearchNormalized}
                      title={contractsSearchNormalized ? 'Search looks across everyone; clear it to filter' : undefined}
                      onClick={() => setContractsRosterFilter(key)}
                      style={{
                        padding: '0.3rem 0.7rem',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        borderRadius: 999,
                        border: '1px solid ' + (active ? 'var(--border-blue)' : 'var(--border-strong)'),
                        background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        color: contractsSearchNormalized ? 'var(--text-faint)' : active ? 'var(--text-blue-700)' : 'var(--text-600)',
                        cursor: contractsSearchNormalized ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
                {contractsWideViewport && agreementsPanelHidden ? (
                  <button
                    type="button"
                    onClick={() => setAgreementsPanelHiddenStored(false)}
                    style={{ marginLeft: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 500, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-600)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Show agreements
                  </button>
                ) : null}
              </div>
              {contractsSearchNormalized && contractDocumentSearchLines.length > 0 ? (
                <div
                  role="region"
                  aria-label="Matching contract documents"
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg-page)',
                    maxHeight: 200,
                    overflowY: 'auto',
                    fontSize: '0.8125rem',
                  }}
                >
                  {contractDocumentSearchLines.map((line) => (
                    <div
                      key={`${line.personName}-${line.document_name}`}
                      style={{ padding: '0.2rem 0', color: 'var(--text-700)' }}
                    >
                      {line.personName} — {line.document_name} — {line.status}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Person</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', width: 1 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (contractsPersonNamesSorted.length === 0) {
                        return (
                          <tr>
                            <td colSpan={2} style={{ padding: '1rem', color: 'var(--text-muted)' }}>No people in roster. Add people in Users tab first.</td>
                          </tr>
                        )
                      }
                      if (contractsPersonNamesFiltered.length === 0 && contractsArchivedVisible.length === 0 && contractsSearchNormalized) {
                        return (
                          <tr>
                            <td colSpan={2} style={{ padding: '1rem', color: 'var(--text-muted)' }}>No matches.</td>
                          </tr>
                        )
                      }
                      if (contractsPersonNamesFiltered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={2} style={{ padding: '1rem', color: 'var(--text-muted)' }}>No one under this filter — switch to Everyone.</td>
                          </tr>
                        )
                      }
                      const renderRosterRow = (personName: string, archived: boolean) => {
                        const docs = getDocumentsForPerson(personName)
                        const statusCounts = countPersonContractStatuses(docs)
                        const isExpanded = selectedContractsPersonName === personName
                        return (
                          <Fragment key={personName}>
                            <tr
                              data-contracts-person-row={personName}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                background: isExpanded ? 'var(--bg-sky-tint)' : undefined,
                              }}
                              onClick={() => setSelectedContractsPersonName((prev) => (prev === personName ? null : personName))}
                            >
                              <td style={{ padding: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                  <PersonNameDoor name={personName} payName={personName} />
                                  {statusCounts.unsent > 0 ? <ContractStatusChip status="unsent" label={`${statusCounts.unsent} unsent`} /> : null}
                                  {statusCounts.sent > 0 ? <ContractStatusChip status="sent" label={`${statusCounts.sent} waiting`} /> : null}
                                  {statusCounts.signed > 0 ? <ContractStatusChip status="signed" label={`${statusCounts.signed} signed`} /> : null}
                                  {archived ? (
                                    <span style={{ fontSize: '0.7rem', fontWeight: 500, padding: '0.1rem 0.45rem', borderRadius: 999, background: 'var(--bg-200)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                      archived
                                    </span>
                                  ) : null}
                                  {personContractAssignments
                                    .filter((a) => a.person_name === personName)
                                    .map((a) => {
                                      const t = contractTemplates.find((x) => x.id === a.template_id)
                                      const tStatus = getAggregateStatusForTemplate(personName, a.template_id)
                                      const tColor = tStatus === 'green' ? '#22c55e' : tStatus === 'yellow' ? '#eab308' : tStatus === 'red' ? '#dc2626' : '#9ca3af'
                                      return (
                                        <span
                                          key={a.id}
                                          style={{
                                            fontSize: '0.7rem',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: 4,
                                            backgroundColor: tColor,
                                            color: '#fff',
                                            fontWeight: 500,
                                          }}
                                          title={tStatus === 'green' ? 'All signed' : tStatus === 'yellow' ? 'Sent for signature' : tStatus === 'red' ? 'Unsent' : 'No documents'}
                                        >
                                          {t?.name ?? '—'}
                                        </span>
                                      )
                                    })}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', width: 1 }}>
                                <span style={{ fontSize: '0.75rem' }}>{isExpanded ? '▾' : '▸'}</span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={2} style={{ padding: '1rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setContractsAssignModalOpen(true)
                                          setContractsError(null)
                                          setAssignPacketsSelectedIds(new Set())
                                          setAssignPacketMenuOpenId(null)
                                        }}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Assign packets
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingContractDocument(null)
                                          setContractsError(null)
                                          setContractDocumentFormPersonName(personName)
                                          setContractDocumentFormDocumentName('')
                                          setContractDocumentFormUrl('')
                                          setContractDocumentFormSigningBodyHtml('')
                                          setContractDocumentFormSigningBodyFormat('html')
                                          setContractDocumentFormCanonicalUrl('')
                                          setContractDocumentFormStatus('unsent')
                                          setContractDocumentFormSignedAt('')
                                          setContractDocumentFormNote('')
                                          setContractDocumentFormDashboardPrompt(false)
                                          setContractDocumentFormAppliedTemplateDocId('')
                                          setContractDocumentFormAppliedVersionDate('')
                                          setCanonicalUrlCheckStatus('idle')
                                          setCanonicalUrlCheckMessage('')
                                          setContractDocumentAddTab('request_signature')
                                          setContractAddDocSource('choose')
                                          setContractAddBookPickedRowId(null)
                                          setContractAddBookCustomizeOpen(false)
                                          setContractDocumentModalOpen(true)
                                        }}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                                      >
                                        + Add document
                                      </button>
                                    </div>
                                    {docs.length === 0 ? (
                                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No documents. Assign a packet or add a document.</p>
                                    ) : contractsDocsAsCards ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {docs.map(({ document_name, version, templateNames, bookLastEditedAt, lineageId }) => {
                                          const doc = version
                                          const appliedCustom = formatAppliedVersionPlainDate(doc?.applied_version_date)
                                          const appliedLabel = appliedCustom ?? formatAppliedVersionPlainDate(bookLastEditedAt)
                                          const metaBits = [
                                            templateNames.join(', '),
                                            doc?.signing_body_html?.trim()
                                              ? isMarkdownBodyFormat(doc.signing_body_format)
                                                ? 'Markdown'
                                                : isPlainBodyFormat(doc.signing_body_format)
                                                  ? 'Plain'
                                                  : 'HTML'
                                              : '',
                                            doc && doc.lineage_version > 1 ? `v${doc.lineage_version}` : '',
                                            appliedLabel ? `applied ${appliedLabel}${appliedCustom ? ' (set manually)' : ''}` : '',
                                            doc?.signed_at ? `signed ${doc.signed_at}` : '',
                                          ].filter(Boolean)
                                          return (
                                            <div
                                              key={`${document_name}-${lineageId ?? 'none'}-${doc?.id ?? 'pending'}`}
                                              style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.6rem 0.75rem' }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ flex: 1, minWidth: 0, fontWeight: 500, overflowWrap: 'anywhere' }}>{document_name}</span>
                                                <ContractStatusChip status={doc?.status ?? 'unsent'} label={doc?.status ?? 'unsent'} />
                                              </div>
                                              {metaBits.length > 0 ? (
                                                <div style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{metaBits.join(' · ')}</div>
                                              ) : null}
                                              {doc?.note?.trim() ? (
                                                <div style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{doc.note}</div>
                                              ) : null}
                                              {doc?.url?.trim() ? (
                                                <div style={{ margin: '0.2rem 0 0', fontSize: '0.75rem' }}>
                                                  <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                                                    Reference link
                                                  </a>
                                                </div>
                                              ) : null}
                                              <div style={{ marginTop: '0.45rem' }}>{renderContractDocActions(personName, document_name, doc)}</div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                          <tr>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Document</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Applied</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {docs.map(({ document_name, version, templateNames, bookLastEditedAt, lineageId }) => {
                                            const doc = version
                                            return (
                                            <tr
                                              key={`${document_name}-${lineageId ?? 'none'}-${doc?.id ?? 'pending'}`}
                                              style={{ borderBottom: '1px solid var(--border)' }}
                                            >
                                              <td style={{ padding: '0.5rem' }}>
                                                {templateNames.length > 0 && (
                                                  <span style={{ marginRight: '0.35rem', display: 'inline-flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                                                    {templateNames.map((n) => (
                                                      <span
                                                        key={n}
                                                        style={{
                                                          fontSize: '0.7rem',
                                                          padding: '0.1rem 0.3rem',
                                                          borderRadius: 4,
                                                          backgroundColor: 'var(--bg-200)',
                                                          color: 'var(--text-700)',
                                                        }}
                                                      >
                                                        {n}
                                                      </span>
                                                    ))}
                                                  </span>
                                                )}
                                                <span>{document_name}</span>
                                                {doc?.signing_body_html?.trim() ? (
                                                  <span
                                                    style={{
                                                      marginLeft: '0.25rem',
                                                      fontSize: '0.65rem',
                                                      padding: '0.1rem 0.3rem',
                                                      borderRadius: 4,
                                                      backgroundColor: 'var(--bg-blue-200)',
                                                      color: 'var(--text-blue-800)',
                                                    }}
                                                  >
                                                    {isMarkdownBodyFormat(doc.signing_body_format)
                                                      ? 'Markdown'
                                                      : isPlainBodyFormat(doc.signing_body_format)
                                                        ? 'Plain'
                                                        : 'HTML'}
                                                  </span>
                                                ) : null}
                                                {doc?.canonical_document_url?.trim() ? (
                                                  <span
                                                    style={{
                                                      marginLeft: '0.25rem',
                                                      fontSize: '0.65rem',
                                                      padding: '0.1rem 0.3rem',
                                                      borderRadius: 4,
                                                      backgroundColor: 'var(--bg-amber-100)',
                                                      color: 'var(--text-amber-800)',
                                                    }}
                                                  >
                                                    Link
                                                  </span>
                                                ) : null}
                                                {doc && doc.lineage_version > 1 ? (
                                                  <span
                                                    style={{
                                                      marginLeft: '0.25rem',
                                                      fontSize: '0.65rem',
                                                      padding: '0.1rem 0.3rem',
                                                      borderRadius: 4,
                                                      backgroundColor: 'var(--bg-200)',
                                                      color: 'var(--text-700)',
                                                    }}
                                                    title="Lineage version"
                                                  >
                                                    v{doc.lineage_version}
                                                  </span>
                                                ) : null}
                                                {doc?.url?.trim() || doc?.note?.trim() ? (
                                                  <div style={{ marginTop: '0.15rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    {doc?.url?.trim() ? (
                                                      <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                                                        Reference link
                                                      </a>
                                                    ) : null}
                                                    {doc?.note?.trim() ? <span style={{ overflowWrap: 'anywhere' }}>{doc.note}</span> : null}
                                                  </div>
                                                ) : null}
                                              </td>
                                              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', color: 'var(--text-600)' }}>
                                                {(() => {
                                                  const customLabel = formatAppliedVersionPlainDate(doc?.applied_version_date)
                                                  if (customLabel) {
                                                    return (
                                                      <span
                                                        title="Applied date set manually — Contract Book edits don't move it"
                                                        style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                                                      >
                                                        {customLabel}
                                                      </span>
                                                    )
                                                  }
                                                  return formatAppliedVersionPlainDate(bookLastEditedAt) ?? '—'
                                                })()}
                                              </td>
                                              <td style={{ padding: '0.5rem' }}>
                                                <ContractStatusChip status={doc?.status ?? 'unsent'} label={doc?.status ?? 'unsent'} />
                                                {doc?.signed_at ? (
                                                  <div style={{ marginTop: '0.15rem', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{doc.signed_at}</div>
                                                ) : null}
                                              </td>
                                              <td style={{ padding: '0.5rem' }}>
                                                {renderContractDocActions(personName, document_name, doc)}
                                              </td>
                                            </tr>
                                          )
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      }
                      return (
                        <>
                          {contractsPersonNamesFiltered.map((personName) => renderRosterRow(personName, false))}
                          {contractsArchivedVisible.length > 0 ? (
                            <>
                              <tr
                                onClick={() => setContractsArchivedSectionOpen((v) => !v)}
                                style={{ cursor: 'pointer', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}
                              >
                                <td colSpan={2} style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  <span aria-hidden style={{ marginRight: '0.4rem' }}>{contractsArchivedOpen ? '▾' : '▸'}</span>
                                  Archived · {contractsArchivedVisible.length}
                                </td>
                              </tr>
                              {contractsArchivedOpen
                                ? contractsArchivedVisible.map((personName) => renderRosterRow(personName, true))
                                : null}
                            </>
                          ) : null}
                        </>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            {contractsWideViewport && !agreementsPanelHidden ? (
              <div style={{ flex: 7, minWidth: 0, borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
                <ContractsAgreementsPanel
                  summaries={agreementSummaries}
                  onJumpToPerson={jumpToContractsPerson}
                  onHide={() => setAgreementsPanelHiddenStored(true)}
                  onQuickSend={(documentName) => {
                    setContractsError(null)
                    setQuickSendDocumentName(documentName)
                  }}
                  quickSendDocumentNames={quickSendDocumentNames}
                />
              </div>
            ) : null}
            </div>
            </>
          )}
        </div>

      {contractsAssignModalOpen && selectedContractsPersonName && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 'min(92vw, 520px)', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>Assign packets — {selectedContractsPersonName}</h3>
            {contractsError && <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{contractsError}</p>}
            {contractTemplates.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                No packets yet. Create one in the <strong>Contract library</strong> first.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.75rem' }}>
                {contractTemplates.map((t) => {
                  const docs = contractTemplateDocuments
                    .filter((d) => d.template_id === t.id)
                    .map((d) => d.document_name)
                    .sort()
                  const alreadyAssigned = personContractAssignments.some(
                    (a) => a.person_name === selectedContractsPersonName && a.template_id === t.id,
                  )
                  const checked = alreadyAssigned || assignPacketsSelectedIds.has(t.id)
                  const busyUnassign = assignPacketUnassigningTemplateId === t.id
                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.6rem',
                        border: checked ? '1.5px solid var(--border-blue)' : '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.55rem 0.7rem',
                        background: alreadyAssigned ? 'var(--bg-subtle)' : checked ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        opacity: alreadyAssigned ? 0.75 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={alreadyAssigned || assignPacketsSaving || assignPacketUnassigningTemplateId !== null}
                        aria-label={`Assign ${t.name}`}
                        onChange={(e) => {
                          setAssignPacketsSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(t.id)
                            else next.delete(t.id)
                            return next
                          })
                        }}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                          {t.name}
                          {alreadyAssigned ? (
                            <span
                              style={{
                                marginLeft: '0.4rem',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                padding: '0.08rem 0.45rem',
                                borderRadius: 999,
                                background: 'var(--bg-green-100)',
                                color: 'var(--text-green-800)',
                                verticalAlign: 'middle',
                              }}
                            >
                              assigned
                            </span>
                          ) : null}
                        </span>
                        {docs.length > 0 ? (
                          <span style={{ display: 'block', marginTop: '0.1rem', fontSize: '0.75rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                            {docs.join(' · ')}
                          </span>
                        ) : null}
                      </div>
                      {alreadyAssigned && canDeletePeopleContracts ? (
                        <div data-assign-packet-menu-wrap={t.id} style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            aria-label={`More actions for ${t.name}`}
                            aria-haspopup="menu"
                            aria-expanded={assignPacketMenuOpenId === t.id}
                            disabled={assignPacketsSaving || assignPacketUnassigningTemplateId !== null}
                            onClick={() => setAssignPacketMenuOpenId((id) => (id === t.id ? null : t.id))}
                            style={{
                              padding: '0.15rem 0.4rem',
                              fontSize: '1rem',
                              lineHeight: 1,
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: 'var(--surface)',
                              cursor: 'pointer',
                            }}
                          >
                            ⋯
                          </button>
                          {assignPacketMenuOpenId === t.id ? (
                            <div
                              role="menu"
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: 2,
                                zIndex: 20,
                                minWidth: 140,
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 6,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                padding: '0.25rem 0',
                              }}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setAssignPacketMenuOpenId(null)
                                  void unassignPacketFromPerson(t.id)
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  width: '100%',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.8125rem',
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: 'var(--text-red-700)',
                                  textAlign: 'left',
                                }}
                              >
                                {busyUnassign ? 'Unassigning…' : 'Unassign'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
            {(() => {
              if (!selectedContractsPersonName) return null
              if (assignPacketsSelectedIds.size === 0) {
                return (
                  <p
                    style={{
                      margin: '0 0 1rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-subtle)',
                      border: '1px dashed var(--border-strong)',
                      borderRadius: 8,
                      padding: '0.5rem 0.7rem',
                      lineHeight: 1.45,
                    }}
                  >
                    Nothing selected yet — tick a packet to see what it adds.
                  </p>
                )
              }
              const { newDocNames } = assignPacketsConsequence({
                personName: selectedContractsPersonName,
                selectedTemplateIds: [...assignPacketsSelectedIds],
                templateDocuments: contractTemplateDocuments,
                personDocuments: personContractDocuments,
              })
              return (
                <p
                  style={{
                    margin: '0 0 1rem',
                    fontSize: '0.78rem',
                    color: 'var(--text-amber-800)',
                    background: 'var(--bg-amber-100)',
                    borderRadius: 8,
                    padding: '0.5rem 0.7rem',
                    lineHeight: 1.45,
                  }}
                >
                  {newDocNames.length === 0 ? (
                    <>
                      Will add for <strong>{selectedContractsPersonName}</strong>: no new documents — they already
                      have a copy of everything in the selected {assignPacketsSelectedIds.size === 1 ? 'packet' : 'packets'}.
                    </>
                  ) : (
                    <>
                      Will add for <strong>{selectedContractsPersonName}</strong>: {newDocNames.join(', ')} —{' '}
                      <strong>
                        {newDocNames.length} {newDocNames.length === 1 ? 'document' : 'documents'}, created as unsent
                      </strong>
                      . {newDocNames.length === 1 ? 'It' : 'They'} will count under &ldquo;Needs attention&rdquo; until sent.
                    </>
                  )}
                </p>
              )
            })()}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setContractsAssignModalOpen(false)
                  setAssignPacketsSelectedIds(new Set())
                  setAssignPacketMenuOpenId(null)
                  setContractsError(null)
                }}
                disabled={assignPacketsSaving || assignPacketUnassigningTemplateId !== null}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  cursor:
                    assignPacketsSaving || assignPacketUnassigningTemplateId !== null ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void assignSelectedPacketsToPerson()}
                disabled={
                  assignPacketsSaving ||
                  assignPacketUnassigningTemplateId !== null ||
                  assignPacketsSelectedIds.size === 0
                }
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor:
                    assignPacketsSaving || assignPacketsSelectedIds.size === 0 ? 'not-allowed' : 'pointer',
                  opacity: assignPacketsSelectedIds.size === 0 ? 0.55 : 1,
                }}
              >
                {assignPacketsSaving ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {contractDocumentModalOpen && (
        <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 'min(92vw, 520px)', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>
              {editingContractDocument
                ? 'Edit document'
                : `Add document${contractDocumentFormPersonName.trim() ? ` — ${contractDocumentFormPersonName.trim()}` : ''}`}
            </h3>
            {contractsError ? (
              <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{contractsError}</p>
            ) : null}
            {!editingContractDocument && contractAddDocSource !== 'choose' ? (
              <button
                type="button"
                onClick={() => setContractAddDocSource('choose')}
                style={{
                  padding: '0.15rem 0.4rem',
                  marginBottom: '0.6rem',
                  fontSize: '0.75rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-link)',
                }}
              >
                ‹ Start over
              </button>
            ) : null}
            {!editingContractDocument && contractAddDocSource === 'choose' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setContractDocumentAddTab('request_signature')
                    setContractDocumentFormStatus('unsent')
                    setContractAddBookPickedRowId(null)
                    setContractAddBookCustomizeOpen(false)
                    setContractAddDocSource('book')
                  }}
                  disabled={contractTemplateDocuments.length === 0}
                  style={{
                    textAlign: 'left',
                    padding: '0.8rem 0.9rem',
                    border: '1.5px solid var(--border-blue)',
                    borderRadius: 8,
                    background: 'var(--bg-blue-tint)',
                    cursor: contractTemplateDocuments.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: contractTemplateDocuments.length === 0 ? 0.6 : 1,
                    font: 'inherit',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                    From Contract Book
                    <span
                      style={{
                        marginLeft: '0.4rem',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--text-blue-700)',
                        border: '1px solid var(--border-blue)',
                        borderRadius: 999,
                        padding: '0.08rem 0.4rem',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Most common
                    </span>
                  </span>
                  <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-600)', lineHeight: 1.4 }}>
                    {contractTemplateDocuments.length === 0
                      ? 'The Contract Book is empty — add a library document there first.'
                      : 'Pick a library document. Name, contract text, and applied version all fill in automatically.'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setContractAddDocSource('custom')}
                  style={{
                    textAlign: 'left',
                    padding: '0.8rem 0.9rem',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 8,
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                    Custom or already-signed
                  </span>
                  <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-600)', lineHeight: 1.4 }}>
                    Blank one-off document, or record a copy that&rsquo;s already signed. Opens the full form.
                  </span>
                </button>
                {contractTemplateDocuments.some((d) => d.form_template_id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPaperEntryFor(contractDocumentFormPersonName.trim())
                      setContractDocumentModalOpen(false)
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '0.8rem 0.9rem',
                      border: '1.5px solid var(--border-strong)',
                      borderRadius: 8,
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>Enter from paper</span>
                    <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-600)', lineHeight: 1.4 }}>
                      They handed you a filled-out form (a W-9). Type it into the boxes, attach the scan, file it as signed on paper.
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}
            {!editingContractDocument && contractAddDocSource === 'custom' ? (
              <div
                role="tablist"
                aria-label="Add document workflow"
                onKeyDown={handleContractAddTabKeyDown}
                style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}
              >
                <button
                  type="button"
                  role="tab"
                  id={`${contractAddDocTabBaseId}-tab-upload`}
                  aria-selected={contractDocumentAddTab === 'upload_signed'}
                  aria-controls={`${contractAddDocTabBaseId}-panel-upload`}
                  tabIndex={contractDocumentAddTab === 'upload_signed' ? 0 : -1}
                  onClick={() => {
                    setContractDocumentAddTab('upload_signed')
                    setContractDocumentFormStatus('signed')
                  }}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    background: contractDocumentAddTab === 'upload_signed' ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: contractDocumentAddTab === 'upload_signed' ? 'var(--text-blue-700)' : 'var(--text-700)',
                    cursor: 'pointer',
                  }}
                >
                  Upload Signed
                </button>
                <button
                  type="button"
                  role="tab"
                  id={`${contractAddDocTabBaseId}-tab-request`}
                  aria-selected={contractDocumentAddTab === 'request_signature'}
                  aria-controls={`${contractAddDocTabBaseId}-panel-request`}
                  tabIndex={contractDocumentAddTab === 'request_signature' ? 0 : -1}
                  onClick={() => {
                    setContractDocumentAddTab('request_signature')
                    setContractDocumentFormStatus('unsent')
                  }}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    background: contractDocumentAddTab === 'request_signature' ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: contractDocumentAddTab === 'request_signature' ? 'var(--text-blue-700)' : 'var(--text-700)',
                    cursor: 'pointer',
                  }}
                >
                  Request Signature
                </button>
              </div>
            ) : null}
            {!editingContractDocument && contractAddDocSource === 'book' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Document
                  </label>
                  <div role="radiogroup" aria-label="Contract Book document" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 260, overflowY: 'auto' }}>
                    {listQuickAddBookDocuments(contractTemplateDocuments).map(({ documentName, row }) => {
                      const selected = contractAddBookPickedRowId === row.id
                      const versionLabel = effectiveBookVersionLabel(row)
                      return (
                        <button
                          key={row.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setContractAddBookPickedRowId(row.id)
                            setContractDocumentFormDocumentName(documentName)
                            setContractDocumentFormSigningBodyHtml(row.book_body_html ?? '')
                            setContractDocumentFormSigningBodyFormat(parseContractBodyFormat(row.book_body_format))
                            setContractDocumentFormCanonicalUrl(row.canonical_document_url?.trim() ?? '')
                            setContractDocumentFormAppliedTemplateDocId(row.id)
                            setContractDocumentFormAppliedVersionDate('')
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.5rem 0.65rem',
                            border: selected ? '1.5px solid var(--border-blue)' : '1px solid var(--border)',
                            borderRadius: 6,
                            background: selected ? 'var(--bg-blue-tint)' : 'var(--surface)',
                            cursor: 'pointer',
                            font: 'inherit',
                            fontSize: '0.875rem',
                            textAlign: 'left',
                            color: 'var(--text-strong)',
                          }}
                        >
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{documentName}</span>
                          {versionLabel ? (
                            <span style={{ flexShrink: 0, fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              version {versionLabel}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {contractAddBookPickedRowId ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.78rem',
                      color: 'var(--text-green-800)',
                      background: 'var(--bg-green-100)',
                      borderRadius: 6,
                      padding: '0.45rem 0.6rem',
                      lineHeight: 1.45,
                    }}
                  >
                    ✓ Name, contract text, and applied version prefill from{' '}
                    <strong>{contractDocumentFormDocumentName}</strong> — nothing else to fill in.
                  </p>
                ) : null}
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <button
                    type="button"
                    aria-expanded={contractAddBookCustomizeOpen}
                    onClick={() => setContractAddBookCustomizeOpen((v) => !v)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.5rem 0.65rem',
                      border: 'none',
                      background: 'var(--bg-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-strong)',
                    }}
                  >
                    <span>Customize text or applied date (optional)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} aria-hidden>
                      {contractAddBookCustomizeOpen ? '▾' : '▸'}
                    </span>
                  </button>
                  {contractAddBookCustomizeOpen ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.65rem 0.75rem' }}>
                      {renderContractDocAppliedVersionBox()}
                      {contractDocModalContractTextField}
                      {contractDocModalCanonicalUrlField}
                    </div>
                  ) : null}
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    lineHeight: 1.4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={contractDocumentFormDashboardPrompt}
                    onChange={(e) => setContractDocumentFormDashboardPrompt(e.target.checked)}
                    style={{ marginTop: '0.15rem' }}
                  />
                  <span>Remind on Dashboard after clock-in (until signed)</span>
                </label>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {editingContractDocument || contractAddDocSource === 'custom' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    Person
                    <span aria-hidden="true" style={{ color: 'var(--text-red-700)' }}>
                      {' '}
                      *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={contractDocumentFormPersonName}
                    onChange={(e) => setContractDocumentFormPersonName(e.target.value)}
                    readOnly
                    disabled
                    aria-required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    Document name
                    <span aria-hidden="true" style={{ color: 'var(--text-red-700)' }}>
                      {' '}
                      *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={contractDocumentFormDocumentName}
                    onChange={(e) => setContractDocumentFormDocumentName(e.target.value)}
                    placeholder="e.g. Farm Work Agreement"
                    readOnly={!!editingContractDocument}
                    disabled={!!editingContractDocument}
                    required={!editingContractDocument}
                    aria-required={!editingContractDocument}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: editingContractDocument ? 'var(--bg-subtle)' : undefined }}
                  />
                </div>
              </div>
              ) : null}
              {(editingContractDocument ||
                (!editingContractDocument &&
                  contractAddDocSource === 'custom' &&
                  contractDocumentAddTab === 'request_signature')) &&
                renderContractDocAppliedVersionBox()}
              {editingContractDocument ? (
                <>
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={contractEditModalContractTextExpanded}
                      onClick={() => setContractEditModalContractTextExpanded((v) => !v)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        border: 'none',
                        background: 'var(--bg-subtle)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--text-strong)',
                      }}
                    >
                      <span>Contract text</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} aria-hidden>
                        {contractEditModalContractTextExpanded ? '▾' : '▸'}
                      </span>
                    </button>
                    {contractEditModalContractTextExpanded ? contractDocModalContractTextField : null}
                  </div>
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={contractEditModalCanonicalExpanded}
                      onClick={() => setContractEditModalCanonicalExpanded((v) => !v)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        border: 'none',
                        background: 'var(--bg-subtle)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--text-strong)',
                      }}
                    >
                      <span>Canonical document URL (Doc / PDF)</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} aria-hidden>
                        {contractEditModalCanonicalExpanded ? '▾' : '▸'}
                      </span>
                    </button>
                    {contractEditModalCanonicalExpanded ? contractDocModalCanonicalUrlField : null}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                      Signed / reference link
                    </label>
                    <input
                      type="url"
                      value={contractDocumentFormUrl}
                      onChange={(e) => setContractDocumentFormUrl(e.target.value)}
                      placeholder="Optional link to a signed copy or other reference"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                    To use <strong>Send for signature</strong>, fill at least one of: contract text, canonical URL, or signed/reference link (not required to save).
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Status</label>
                      <select
                        value={contractDocumentFormStatus}
                        onChange={(e) => setContractDocumentFormStatus(e.target.value as 'unsent' | 'sent' | 'signed')}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      >
                        <option value="unsent">Unsent</option>
                        <option value="sent">Sent</option>
                        <option value="signed">Signed</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Signed date</label>
                      <input
                        type="date"
                        value={contractDocumentFormSignedAt}
                        onChange={(e) => setContractDocumentFormSignedAt(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      />
                    </div>
                  </div>
                  {contractDocumentFormStatus !== 'signed' ? (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        fontSize: '0.8125rem',
                        marginTop: '0.25rem',
                        cursor: 'pointer',
                        lineHeight: 1.4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={contractDocumentFormDashboardPrompt}
                        onChange={(e) => setContractDocumentFormDashboardPrompt(e.target.checked)}
                        style={{ marginTop: '0.15rem' }}
                      />
                      <span>Remind on Dashboard after clock-in (until signed)</span>
                    </label>
                  ) : null}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Note</label>
                    <textarea
                      value={contractDocumentFormNote}
                      onChange={(e) => setContractDocumentFormNote(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical' }}
                    />
                  </div>
                </>
              ) : contractAddDocSource !== 'custom' ? null : contractDocumentAddTab === 'upload_signed' ? (
                  <div
                    role="tabpanel"
                    id={`${contractAddDocTabBaseId}-panel-upload`}
                    aria-labelledby={`${contractAddDocTabBaseId}-tab-upload`}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-600)', margin: 0, lineHeight: 1.45 }}>
                        Use this when you already have a signed copy (link to PDF or Drive). Add signed date and note as needed.
                      </p>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          Signed / reference link
                        </label>
                        <input
                          type="url"
                          value={contractDocumentFormUrl}
                          onChange={(e) => setContractDocumentFormUrl(e.target.value)}
                          placeholder="Optional link to a signed copy or other reference"
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Signed date</label>
                        <input
                          type="date"
                          value={contractDocumentFormSignedAt}
                          onChange={(e) => setContractDocumentFormSignedAt(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Note</label>
                        <textarea
                          value={contractDocumentFormNote}
                          onChange={(e) => setContractDocumentFormNote(e.target.value)}
                          rows={2}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  </div>
              ) : (
                  <div
                    role="tabpanel"
                    id={`${contractAddDocTabBaseId}-panel-request`}
                    aria-labelledby={`${contractAddDocTabBaseId}-tab-request`}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-600)', margin: 0, lineHeight: 1.45 }}>
                        Prepare what appears on the public signing page. Use <strong>Send</strong> below to save and open the email step, or <strong>Save</strong> and use <strong>Send</strong> on the document row later.
                      </p>
                      {contractDocModalContractTextField}
                      {contractDocModalCanonicalUrlField}
                      {!editingContractDocument ? (
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                            lineHeight: 1.4,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={contractDocumentFormDashboardPrompt}
                            onChange={(e) => setContractDocumentFormDashboardPrompt(e.target.checked)}
                            style={{ marginTop: '0.15rem' }}
                          />
                          <span>Remind on Dashboard after clock-in (until signed)</span>
                        </label>
                      ) : null}
                    </div>
                  </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: '1rem',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {editingContractDocument &&
                canDeletePeopleContracts &&
                isDeletablePersonContractStatus(String(editingContractDocument.status)) ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingContractDocument) return
                      setContractDocumentDeleteTarget(editingContractDocument)
                      setContractDocumentDeleteConfirmOpen(true)
                    }}
                    disabled={contractDocumentFormSaving || contractDocumentDeleting}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      background: 'var(--bg-red-tint)',
                      color: 'var(--text-red-700)',
                      cursor:
                        contractDocumentFormSaving || contractDocumentDeleting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setContractDocumentModalOpen(false)
                    setContractDocumentDeleteConfirmOpen(false)
                    setContractDocumentDeleteTarget(null)
                  }}
                  style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                {editingContractDocument || contractAddDocSource !== 'choose' ? (
                  <button
                    type="button"
                    onClick={saveContractDocument}
                    disabled={
                      contractDocumentFormSaving ||
                      (!editingContractDocument && contractAddDocSource === 'book' && !contractAddBookPickedRowId)
                    }
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: contractDocumentFormSaving ? 'not-allowed' : 'pointer',
                      opacity:
                        !editingContractDocument && contractAddDocSource === 'book' && !contractAddBookPickedRowId
                          ? 0.55
                          : 1,
                    }}
                  >
                    {contractDocumentFormSaving
                      ? 'Saving…'
                      : !editingContractDocument && contractAddDocSource === 'book'
                        ? 'Save for later'
                        : 'Save'}
                  </button>
                ) : null}
                {!editingContractDocument &&
                contractAddDocSource !== 'choose' &&
                contractDocumentAddTab === 'request_signature' ? (
                  <button
                    type="button"
                    onClick={() => void saveContractDocumentAndOpenSend()}
                    disabled={
                      contractDocumentFormSaving ||
                      (contractAddDocSource === 'book' && !contractAddBookPickedRowId)
                    }
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#0ea5e9',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: contractDocumentFormSaving ? 'not-allowed' : 'pointer',
                      opacity: contractAddDocSource === 'book' && !contractAddBookPickedRowId ? 0.55 : 1,
                    }}
                  >
                    {contractDocumentFormSaving
                      ? 'Saving…'
                      : contractAddDocSource === 'book'
                        ? 'Send now'
                        : 'Send'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {contractDocumentDeleteConfirmOpen &&
        canDeletePeopleContracts &&
        contractDocumentDeleteTarget &&
        isDeletablePersonContractStatus(contractDocumentDeleteTarget.status) && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 12,
            }}
            onClick={() => {
              if (!contractDocumentDeleting) {
                setContractDocumentDeleteConfirmOpen(false)
                setContractDocumentDeleteTarget(null)
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="contract-delete-confirm-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface)',
                padding: '1.5rem',
                borderRadius: 8,
                minWidth: 320,
                maxWidth: 'min(92vw, 420px)',
              }}
            >
              <h3 id="contract-delete-confirm-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
                Delete document?
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-600)', margin: '0 0 1rem', lineHeight: 1.45 }}>
                This removes <strong>{contractDocumentDeleteTarget.document_name}</strong> for{' '}
                <strong>{contractDocumentDeleteTarget.person_name}</strong>. This cannot be undone.
              </p>
              {(contractDocumentDeleteTarget.status === 'sent' ||
                contractDocumentDeleteTarget.status === 'signed') && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-600)', margin: '0 0 1rem', lineHeight: 1.45 }}>
                  <strong>Note:</strong> This removes the contract record from ClickTooling, including any stored
                  signature. Email or files saved outside this app are not affected.
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setContractDocumentDeleteConfirmOpen(false)
                    setContractDocumentDeleteTarget(null)
                  }}
                  disabled={contractDocumentDeleting}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    cursor: contractDocumentDeleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void deleteContractDocument()}
                  disabled={contractDocumentDeleting}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: 6,
                    background: '#b91c1c',
                    color: '#fff',
                    cursor: contractDocumentDeleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {contractDocumentDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      {quickSendDocumentName ? (
        <ContractQuickSendPicker
          documentName={quickSendDocumentName}
          rosterNames={contractsPersonNamesSorted}
          personDocuments={personContractDocuments}
          busy={false}
          onPick={(personName) => openQuickSendForPerson(quickSendDocumentName, personName)}
          onClose={() => setQuickSendDocumentName(null)}
        />
      ) : null}

      <PersonContractSignedRecordModal
        open={contractSignedRecordModalDocId !== null}
        documentId={contractSignedRecordModalDocId}
        onClose={() => setContractSignedRecordModalDocId(null)}
      />

      <ContractsTabHelpModal
        open={contractsHelpModalOpen}
        onClose={() => setContractsHelpModalOpen(false)}
        onOpenHelp={() => navigate('/help')}
      />

      {contractBookModalOpen && (
        <ContractBookModal
          open={contractBookModalOpen}
          onClose={() => setContractBookModalOpen(false)}
          templates={contractTemplates}
          templateDocuments={contractTemplateDocuments}
          onSaved={() => void loadContracts()}
          onPickEntry={contractBookPickFromDocumentModal ? handlePickContractFromBook : undefined}
          canDeleteLibraryEntries={canDeletePeopleContracts}
        />
      )}

      {officeModalDocId ? (
        <ContractFormOfficeModal
          documentId={officeModalDocId}
          onClose={() => setOfficeModalDocId(null)}
          onCompleted={() => void loadContracts()}
        />
      ) : null}

      {paperEntryFor ? (
        <ContractFormPaperEntryModal
          personName={paperEntryFor}
          personId={people.find((p) => (p.name ?? '').trim() === paperEntryFor)?.id ?? null}
          forms={listQuickAddBookDocuments(contractTemplateDocuments)
            .filter(({ row }) => row.form_template_id)
            .map(({ documentName, row }) => ({ bookEntryId: row.id, documentName }))}
          onClose={() => setPaperEntryFor(null)}
          onFiled={() => void loadContracts()}
        />
      ) : null}

      {contractLibraryModalOpen && (
        <ContractLibraryModal
          open={contractLibraryModalOpen}
          onClose={() => setContractLibraryModalOpen(false)}
          templates={contractTemplates}
          templateDocuments={contractTemplateDocuments}
          assignments={personContractAssignments}
          personDocuments={personContractDocuments}
          canDeletePeopleContracts={canDeletePeopleContracts}
          isDev={isDev}
          onSaved={() => void loadContracts()}
          onQuickSend={(documentName) => {
            setContractsError(null)
            setQuickSendDocumentName(documentName)
          }}
        />
      )}

      {contractSendModalOpen && (contractSendDocId || contractSendQuickSend) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 14 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(640px, 92vw)', maxHeight: '92vh', overflow: 'auto', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>Send for signature</h3>
            {contractsError ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{contractsError}</p> : null}
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Signer email</span>
              <input
                type="email"
                value={contractSendEmail}
                onChange={(e) => setContractSendEmail(e.target.value)}
                placeholder="name@example.com"
                style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontWeight: 400 }}
              />
            </label>
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Email subject (optional)</span>
              <input
                type="text"
                value={contractSendSubject}
                onChange={(e) => setContractSendSubject(e.target.value)}
                placeholder={`Default: ${contractSigningEmailDefaultSubject(contractSendTarget?.documentName ?? 'your agreement')}`}
                maxLength={200}
                style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontWeight: 400 }}
              />
            </label>
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Opening message (optional, plain text)</span>
              <textarea
                value={contractSendIntro}
                onChange={(e) => setContractSendIntro(e.target.value)}
                placeholder={`Default: ${CONTRACT_SIGNING_EMAIL_DEFAULT_INTRO} Leave blank to use it, or write it in your own words.`}
                rows={4}
                maxLength={4000}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '0.25rem',
                  padding: '0.5rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontWeight: 400,
                }}
              />
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
              Your message opens the email. The document name, the three signing steps, the button, and the link&rsquo;s expiry date follow it.
            </p>
            {contractSendEmailPreview ? (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>Email preview</div>
                {contractSendEmailPreview.kind === 'missing' ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Unable to load preview.</p>
                ) : (
                  <>
                    <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem', lineHeight: 1.45 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>From: </span>
                        {contractSendEmailPreview.fromName}
                        {contractSendEmailPreview.replyTo ? (
                          <>
                            {' '}· <span style={{ fontWeight: 600 }}>Reply-To: </span>
                            {contractSendEmailPreview.replyTo}
                          </>
                        ) : null}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600 }}>Subject: </span>
                        {contractSendEmailPreview.subject}
                      </div>
                    </div>
                    <iframe
                      title="Contract email preview"
                      sandbox=""
                      srcDoc={contractSendEmailPreview.html}
                      style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 6, background: '#f6f3ec' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                      Built by the same code that sends it. The signing link is generated when you send; the link works for 14 days.
                    </p>
                  </>
                )}
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                marginTop: '1rem',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  // Nothing was written for a quick-send pick, so there is nothing to undo.
                  setContractSendModalOpen(false)
                  setContractSendDocId(null)
                  setContractSendQuickSend(null)
                  setContractSendEmail('')
                  setContractSendSubject('')
                  setContractSendIntro('')
                  setContractsError(null)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendContractForSignature()}
                disabled={contractSendSaving}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0ea5e9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: contractSendSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {contractSendSaving ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
