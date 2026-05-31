import { Fragment, useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { SearchableSelect, type SearchableSelectSelectableOption } from '../SearchableSelect'
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
import { buildContractSendEmailPreview } from '../../lib/contractSendEmailPreview'
import { normalizeCustomerAttachmentUrl } from '../../lib/estimateCustomerAttachment'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { ContractBookModal, type ContractBookTemplateDocument } from '../contracts/ContractBookModal'
import { PersonContractSignedRecordModal } from '../contracts/PersonContractSignedRecordModal'
import { ContractBookIcon } from '../icons/ContractBookIcon'
import { useToastContext } from '../../contexts/ToastContext'

function formatContractBookLastEditedCalendarDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
  canDeletePeopleContracts: boolean
}

export default function PeopleContractsTab({ people, users, canDeletePeopleContracts }: PeopleContractsTabProps) {
  const { showToast } = useToastContext()

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
    note: string | null
    dashboard_prompt_after_clock_in?: boolean | null
    applied_contract_template_document_id: string | null
    contract_lineage_id: string
    lineage_version: number
    supersedes_person_contract_document_id: string | null
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
  const [contractsTemplateModalOpen, setContractsTemplateModalOpen] = useState(false)
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
  const [contractSendEmail, setContractSendEmail] = useState('')
  const [contractSendSubject, setContractSendSubject] = useState('')
  const [contractSendIntro, setContractSendIntro] = useState('')
  const [contractSendSaving, setContractSendSaving] = useState(false)
  const [canonicalUrlCheckStatus, setCanonicalUrlCheckStatus] = useState<
    'idle' | 'loading' | 'success' | 'warn' | 'error'
  >('idle')
  const [canonicalUrlCheckMessage, setCanonicalUrlCheckMessage] = useState('')
  const [contractDocumentAddTab, setContractDocumentAddTab] = useState<'upload_signed' | 'request_signature'>(
    'request_signature',
  )
  const [contractDocumentFormDashboardPrompt, setContractDocumentFormDashboardPrompt] = useState(false)
  const [contractDashboardPromptSavingId, setContractDashboardPromptSavingId] = useState<string | null>(null)
  const [contractSignedRecordModalDocId, setContractSignedRecordModalDocId] = useState<string | null>(null)
  const contractAddDocTabBaseId = useId()
  const assignTemplateSearchInputId = useId()
  const assignTemplateRadioGroupLabelId = useId()
  const contractsTabSearchInputId = useId()
  const templateBookPickerLabelId = useId()
  const [editingContractTemplate, setEditingContractTemplate] = useState<ContractTemplate | null>(null)
  const [templateFormName, setTemplateFormName] = useState('')
  const [templateFormDocumentNames, setTemplateFormDocumentNames] = useState<string[]>([])
  /** Picker-added names only: `document_name` → source `contract_template_documents.id` for insert copy. */
  const [templateFormDocumentSourceByName, setTemplateFormDocumentSourceByName] = useState<Record<string, string>>({})
  const [templateBookPickerValue, setTemplateBookPickerValue] = useState('')
  const [templateFormSaving, setTemplateFormSaving] = useState(false)
  const [templateFormMode, setTemplateFormMode] = useState<'none' | 'create' | 'edit'>('none')

  const templateBookPickerOptions = useMemo((): SearchableSelectSelectableOption[] => {
    const existing = new Set(templateFormDocumentNames.map((n) => n.trim().toLowerCase()))
    return contractTemplateDocuments
      .filter((d) => !existing.has(d.document_name.trim().toLowerCase()))
      .map((d) => {
        const tname = contractTemplates.find((t) => t.id === d.template_id)?.name ?? '—'
        return {
          value: d.id,
          label: `${tname} — ${d.document_name}`,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [contractTemplateDocuments, contractTemplates, templateFormDocumentNames])

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

  const contractBodyFormatBtn = (active: boolean) =>
    ({
      padding: '0.25rem 0.55rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      border: '1px solid #d1d5db',
      borderRadius: 6,
      background: active ? '#eff6ff' : '#fff',
      color: active ? '#1d4ed8' : '#374151',
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
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Format:</span>
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
        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.35rem', lineHeight: 1.45 }}>
          <strong>HTML:</strong> rich text (sanitized). <strong>Plain:</strong> exact text including angle brackets.{' '}
          <strong>Markdown:</strong> rendered on the signing page (then sanitized).
        </p>
        <textarea
          value={contractDocumentFormSigningBodyHtml}
          onChange={(e) => setContractDocumentFormSigningBodyHtml(e.target.value)}
          placeholder="Optional. Shown on the public signing page."
          rows={6}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical', fontFamily: 'inherit' }}
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
              border: '1px solid #d1d5db',
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
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background:
                canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? '#3b82f6' : '#f9fafb',
              color: canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? '#fff' : '#9ca3af',
              cursor:
                canonicalUrlIsCheckable && canonicalUrlCheckStatus !== 'loading' ? 'pointer' : 'not-allowed',
              opacity: canonicalUrlIsCheckable ? 1 : 0.65,
            }}
          >
            {canonicalUrlCheckStatus === 'loading' ? 'Checking…' : 'Check link'}
          </button>
        </div>
        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.35rem' }}>
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
            style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#b45309', lineHeight: 1.45 }}
          >
            {canonicalUrlCheckMessage}
          </p>
        ) : null}
        {canonicalUrlCheckStatus === 'error' && canonicalUrlCheckMessage ? (
          <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.45 }}>
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
          'id, template_id, document_name, sequence_order, book_body_html, book_body_format, tags, canonical_document_url, updated_at',
        )
        .order('template_id')
        .order('sequence_order'),
      supabase.from('person_contract_assignments').select('id, person_name, template_id'),
      supabase
        .from('person_contract_documents')
        .select(
          'id, person_name, document_name, url, signing_body_html, signing_body_format, canonical_document_url, status, signed_at, sent_at, note, dashboard_prompt_after_clock_in, applied_contract_template_document_id, contract_lineage_id, lineage_version, supersedes_person_contract_document_id',
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
      setPersonContractAssignments((assignmentsRes.data ?? []) as PersonContractAssignment[])
      setPersonContractDocuments((documentsRes.data ?? []) as PersonContractDocument[])
    }
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
      const u = td.updated_at
      const datePart = u ? formatContractBookLastEditedCalendarDate(u) : '—'
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

  function getDocumentsForPerson(personName: string): PersonContractTableRow[] {
    const assignedTemplateIds = personContractAssignments.filter((a) => a.person_name === personName).map((a) => a.template_id)
    const docNamesFromTemplates = new Set<string>()
    const docToTemplateNames = new Map<string, string[]>()
    const docNameToBookUpdated = new Map<string, string>()
    for (const tid of assignedTemplateIds) {
      const template = contractTemplates.find((t) => t.id === tid)
      const templateName = template?.name ?? ''
      for (const td of contractTemplateDocuments.filter((d) => d.template_id === tid)) {
        docNamesFromTemplates.add(td.document_name)
        const arr = docToTemplateNames.get(td.document_name) ?? []
        if (!arr.includes(templateName)) arr.push(templateName)
        docToTemplateNames.set(td.document_name, arr)
        const u = td.updated_at
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
        if (pinOk && pinned.updated_at) {
          bookLastEditedAt = pinned.updated_at
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

  function getAggregateStatus(docs: PersonContractTableRow[]): 'red' | 'yellow' | 'green' | null {
    if (docs.length === 0) return null
    const statuses = docs.map((d) => d.version?.status ?? 'unsent')
    if (statuses.some((s) => s === 'unsent')) return 'red'
    if (statuses.some((s) => s === 'sent')) return 'yellow'
    return 'green'
  }

  const contractsPersonNamesSorted = useMemo(() => {
    return [...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])]
      .filter((n): n is string => Boolean(n?.trim()))
      .sort((a, b) => a.localeCompare(b))
  }, [people, users])

  const contractsSearchNormalized = useMemo(() => contractsSearchQuery.trim().toLowerCase(), [contractsSearchQuery])

  const contractsPersonNamesFiltered = useMemo(() => {
    if (!contractsSearchNormalized) return contractsPersonNamesSorted
    return contractsPersonNamesSorted.filter((personName) => {
      if (personName.toLowerCase().includes(contractsSearchNormalized)) return true
      return getDocumentsForPerson(personName).some(({ document_name }) =>
        document_name.toLowerCase().includes(contractsSearchNormalized),
      )
    })
  }, [
    contractsPersonNamesSorted,
    contractsSearchNormalized,
    contractTemplates,
    contractTemplateDocuments,
    personContractAssignments,
    personContractDocuments,
  ])

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

  const contractSendEmailPreview = useMemo(() => {
    if (!contractSendDocId) return null
    const doc = personContractDocuments.find((d) => d.id === contractSendDocId)
    if (!doc) return { kind: 'missing' as const }
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin.replace(/\/$/, '')
        : 'https://pipetooling.github.io'
    const linkPlaceholder = `${origin}/contract/accept?t=…`
    return {
      kind: 'ok' as const,
      ...buildContractSendEmailPreview({
        documentName: doc.document_name,
        personName: doc.person_name,
        emailSubject: contractSendSubject,
        emailIntroPlain: contractSendIntro,
        linkPlaceholder,
      }),
    }
  }, [contractSendDocId, personContractDocuments, contractSendSubject, contractSendIntro])

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
      setContractSendEmail('')
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
    if (!contractSendDocId || !contractSendEmail.trim()) {
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
            person_contract_document_id: contractSendDocId,
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
      setContractSendModalOpen(false)
      setContractSendDocId(null)
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

  function openTemplateForm(template?: ContractTemplate) {
    setEditingContractTemplate(template ?? null)
    setTemplateFormName(template?.name ?? '')
    setTemplateFormDocumentNames(
      template ? contractTemplateDocuments.filter((d) => d.template_id === template.id).map((d) => d.document_name).sort() : []
    )
    setTemplateFormDocumentSourceByName({})
    setTemplateBookPickerValue('')
    setTemplateFormMode(template ? 'edit' : 'create')
  }

  function closeTemplateForm() {
    setEditingContractTemplate(null)
    setTemplateFormName('')
    setTemplateFormDocumentNames([])
    setTemplateFormDocumentSourceByName({})
    setTemplateBookPickerValue('')
    setTemplateFormMode('none')
  }

  /** New template documents must come from Contract Book (picker maps name → source row id). */
  function templateFormBookSourceValidationError(docNamesRequiringSource: string[]): string | null {
    for (const docName of docNamesRequiringSource) {
      const sourceId = templateFormDocumentSourceByName[docName]
      if (!sourceId) {
        return 'Each document must be added from Contract Book using the dropdown (pick an existing library entry).'
      }
      const sourceRow = contractTemplateDocuments.find((d) => d.id === sourceId)
      if (!sourceRow) {
        return 'A selected Contract Book entry is no longer available. Refresh the page and add documents from the library again.'
      }
    }
    return null
  }

  async function saveTemplate() {
    const name = templateFormName.trim()
    if (!name) {
      setContractsError('Template name is required.')
      return
    }
    setTemplateFormSaving(true)
    setContractsError(null)
    try {
      if (editingContractTemplate) {
        const templateId = editingContractTemplate.id
        const existing = contractTemplateDocuments.filter((d) => d.template_id === templateId).map((d) => d.document_name)
        const toAdd = templateFormDocumentNames.filter((n) => !existing.includes(n))
        const bookErrEdit = templateFormBookSourceValidationError(toAdd)
        if (bookErrEdit) {
          setContractsError(bookErrEdit)
          return
        }
        const toRemove = existing.filter((n) => !templateFormDocumentNames.includes(n))
        if (!canDeletePeopleContracts && toRemove.length > 0) {
          setContractsError('Removing documents from a template requires a Dev or Master Technician.')
          return
        }
        await withSupabaseRetry(
          async () => supabase.from('contract_templates').update({ name }).eq('id', templateId),
          'update contract template'
        )
        const assignees = personContractAssignments.filter((a) => a.template_id === templateId)
        for (const docName of toRemove) {
          for (const a of assignees) {
            const pcds = personContractDocuments.filter((d) => d.person_name === a.person_name && d.document_name === docName)
            for (const pcd of pcds) {
              if (!personContractDocumentHasStaffData(pcd)) {
                await withSupabaseRetry(
                  async () => supabase.from('person_contract_documents').delete().eq('id', pcd.id),
                  'remove empty person contract document'
                )
              }
            }
          }
          const doc = contractTemplateDocuments.find((d) => d.template_id === templateId && d.document_name === docName)
          if (doc) {
            await withSupabaseRetry(
              async () => supabase.from('contract_template_documents').delete().eq('id', doc.id),
              'remove template document'
            )
          }
        }
        for (let i = 0; i < toAdd.length; i++) {
          const docName = toAdd[i]!
          const sourceId = templateFormDocumentSourceByName[docName]!
          const sourceRow = contractTemplateDocuments.find((d) => d.id === sourceId)!
          const insertRow: {
            template_id: string
            document_name: string
            sequence_order: number
            book_body_html?: string | null
            book_body_format?: string
            tags?: string[]
            canonical_document_url?: string | null
          } = {
            template_id: templateId,
            document_name: docName,
            sequence_order: i,
            book_body_html: sourceRow.book_body_html,
            book_body_format: sourceRow.book_body_format,
            tags: sourceRow.tags ?? [],
            canonical_document_url: sourceRow.canonical_document_url?.trim() ? sourceRow.canonical_document_url : null,
          }
          await withSupabaseRetry(
            async () => supabase.from('contract_template_documents').insert(insertRow),
            'add template document'
          )
        }
        for (const docName of toAdd) {
          const sourceId = templateFormDocumentSourceByName[docName]!
          const sourceRow = contractTemplateDocuments.find((d) => d.id === sourceId)!
          for (const a of assignees) {
            await withSupabaseRetry(
              async () =>
                supabase.from('person_contract_documents').insert({
                  person_name: a.person_name,
                  document_name: docName,
                  contract_lineage_id: globalThis.crypto.randomUUID(),
                  lineage_version: 1,
                  supersedes_person_contract_document_id: null,
                  status: 'unsent',
                  signing_body_format: 'html',
                  canonical_document_url: sourceRow.canonical_document_url?.trim() || null,
                }),
              'backfill person contract documents'
            )
          }
        }
      } else {
        const bookErrNew = templateFormBookSourceValidationError(templateFormDocumentNames)
        if (bookErrNew) {
          setContractsError(bookErrNew)
          return
        }
        const inserted = await withSupabaseRetry(
          async () => supabase.from('contract_templates').insert({ name, sequence_order: contractTemplates.length }).select('id').single(),
          'create contract template'
        )
        const templateId = (inserted as { id: string } | null)?.id
        if (templateId) {
          const tid = templateId
          for (let i = 0; i < templateFormDocumentNames.length; i++) {
            const docName = templateFormDocumentNames[i]!
            const sourceId = templateFormDocumentSourceByName[docName]!
            const sourceRow = contractTemplateDocuments.find((d) => d.id === sourceId)!
            const insertRow: {
              template_id: string
              document_name: string
              sequence_order: number
              book_body_html?: string | null
              book_body_format?: string
              tags?: string[]
              canonical_document_url?: string | null
            } = {
              template_id: tid,
              document_name: docName,
              sequence_order: i,
              book_body_html: sourceRow.book_body_html,
              book_body_format: sourceRow.book_body_format,
              tags: sourceRow.tags ?? [],
              canonical_document_url: sourceRow.canonical_document_url?.trim() ? sourceRow.canonical_document_url : null,
            }
            await withSupabaseRetry(
              async () => supabase.from('contract_template_documents').insert(insertRow),
              'add template document'
            )
          }
        }
      }
      closeTemplateForm()
      loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to save template')
    } finally {
      setTemplateFormSaving(false)
    }
  }

  async function deleteContractTemplate(template: ContractTemplate) {
    if (!canDeletePeopleContracts) return
    if (!confirm(`Delete template "${template.name}"? This will remove the template and its document list.`)) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('contract_templates').delete().eq('id', template.id),
        'delete contract template'
      )
      loadContracts()
      if (editingContractTemplate?.id === template.id) closeTemplateForm()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to delete template')
    }
  }

  const [assignTemplateSelectedId, setAssignTemplateSelectedId] = useState<string | null>(null)
  const [assignTemplateSearchQuery, setAssignTemplateSearchQuery] = useState('')
  const [assignTemplateSaving, setAssignTemplateSaving] = useState(false)
  const [assignTemplateUnassigningTemplateId, setAssignTemplateUnassigningTemplateId] = useState<string | null>(null)

  const filteredAssignContractTemplates = useMemo(() => {
    const q = assignTemplateSearchQuery.trim().toLowerCase()
    if (!q) return contractTemplates
    return contractTemplates.filter((t) => t.name.toLowerCase().includes(q))
  }, [contractTemplates, assignTemplateSearchQuery])

  useEffect(() => {
    if (assignTemplateSelectedId == null) return
    if (!filteredAssignContractTemplates.some((t) => t.id === assignTemplateSelectedId)) {
      setAssignTemplateSelectedId(null)
    }
  }, [filteredAssignContractTemplates, assignTemplateSelectedId])

  async function assignTemplateToPerson() {
    const personName = selectedContractsPersonName
    const templateId = assignTemplateSelectedId
    if (!personName || !templateId) {
      setContractsError('Please select a template.')
      return
    }
    const alreadyAssigned = personContractAssignments.some((a) => a.person_name === personName && a.template_id === templateId)
    if (alreadyAssigned) {
      setContractsError('This template is already assigned to this person.')
      return
    }
    setAssignTemplateSaving(true)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        async () => supabase.from('person_contract_assignments').insert({ person_name: personName, template_id: templateId }),
        'assign template to person'
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
      setContractsAssignModalOpen(false)
      setAssignTemplateSelectedId(null)
      setAssignTemplateSearchQuery('')
      loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to assign template')
    } finally {
      setAssignTemplateSaving(false)
    }
  }

  async function unassignTemplateFromPerson(templateId: string) {
    if (!canDeletePeopleContracts) return
    const personName = selectedContractsPersonName
    if (!personName) return
    const assignment = personContractAssignments.find((a) => a.person_name === personName && a.template_id === templateId)
    if (!assignment) {
      setContractsError('That template is not assigned to this person.')
      return
    }
    setAssignTemplateUnassigningTemplateId(templateId)
    setContractsError(null)
    try {
      await withSupabaseRetry(
        () => supabase.from('person_contract_assignments').delete().eq('id', assignment.id),
        'unassign contract template',
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
      showToast('Template unassigned.', 'success')
      await loadContracts()
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to unassign template')
    } finally {
      setAssignTemplateUnassigningTemplateId(null)
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
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Contracts</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setContractBookModalOpen(true)}
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
                Contract Book
              </button>
              <button
                type="button"
                onClick={() => setContractsTemplateModalOpen(true)}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                Manage templates
              </button>
            </div>
          </div>
          {contractsError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{contractsError}</p>}
          {contractsLoading ? (
            <p style={{ color: '#6b7280' }}>Loading…</p>
          ) : (
            <>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor={contractsTabSearchInputId} style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.35rem', color: '#374151' }}>
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
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              {contractsSearchNormalized && contractDocumentSearchLines.length > 0 ? (
                <div
                  role="region"
                  aria-label="Matching contract documents"
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    background: '#fafafa',
                    maxHeight: 200,
                    overflowY: 'auto',
                    fontSize: '0.8125rem',
                  }}
                >
                  {contractDocumentSearchLines.map((line) => (
                    <div
                      key={`${line.personName}-${line.document_name}`}
                      style={{ padding: '0.2rem 0', color: '#374151' }}
                    >
                      {line.personName} — {line.document_name} — {line.status}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 48 }}>Status</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', width: 1 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (contractsPersonNamesSorted.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} style={{ padding: '1rem', color: '#6b7280' }}>No people in roster. Add people in Users tab first.</td>
                          </tr>
                        )
                      }
                      if (contractsPersonNamesFiltered.length === 0 && contractsSearchNormalized) {
                        return (
                          <tr>
                            <td colSpan={3} style={{ padding: '1rem', color: '#6b7280' }}>No matches.</td>
                          </tr>
                        )
                      }
                      return contractsPersonNamesFiltered.map((personName) => {
                        const docs = getDocumentsForPerson(personName)
                        const status = getAggregateStatus(docs)
                        const isExpanded = selectedContractsPersonName === personName
                        const statusColor = status === 'green' ? '#22c55e' : status === 'yellow' ? '#eab308' : status === 'red' ? '#dc2626' : '#9ca3af'
                        return (
                          <Fragment key={personName}>
                            <tr
                              style={{
                                borderBottom: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                background: isExpanded ? '#f0f9ff' : undefined,
                              }}
                              onClick={() => setSelectedContractsPersonName((prev) => (prev === personName ? null : personName))}
                            >
                              <td style={{ padding: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                  <span>{personName}</span>
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
                              <td style={{ padding: '0.75rem' }}>
                                {status !== null && (
                                  <span
                                    title={status === 'green' ? 'All signed' : status === 'yellow' ? 'Sent for signature' : 'Unsent'}
                                    style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor }}
                                    aria-hidden
                                  />
                                )}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', width: 1 }}>
                                <span style={{ fontSize: '0.75rem' }}>{isExpanded ? '▾' : '▸'}</span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={3} style={{ padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setContractsAssignModalOpen(true)
                                          setContractsError(null)
                                          setAssignTemplateSelectedId(null)
                                          setAssignTemplateSearchQuery('')
                                        }}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Assign template
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
                                          setCanonicalUrlCheckStatus('idle')
                                          setCanonicalUrlCheckMessage('')
                                          setContractDocumentAddTab('request_signature')
                                          setContractDocumentModalOpen(true)
                                        }}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                                      >
                                        + Add document
                                      </button>
                                    </div>
                                    {docs.length === 0 ? (
                                      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No documents. Assign a template or add a document.</p>
                                    ) : (
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                          <tr>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Document</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Ver.</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Applied version</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Ref link</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Signed</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Note</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {docs.map(({ document_name, version, templateNames, bookLastEditedAt, lineageId }) => {
                                            const doc = version
                                            return (
                                            <tr
                                              key={`${document_name}-${lineageId ?? 'none'}-${doc?.id ?? 'pending'}`}
                                              style={{ borderBottom: '1px solid #e5e7eb' }}
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
                                                          backgroundColor: '#e5e7eb',
                                                          color: '#374151',
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
                                                      backgroundColor: '#dbeafe',
                                                      color: '#1e40af',
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
                                                      backgroundColor: '#fef3c7',
                                                      color: '#92400e',
                                                    }}
                                                  >
                                                    Link
                                                  </span>
                                                ) : null}
                                              </td>
                                              <td style={{ padding: '0.5rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                                {doc ? doc.lineage_version : '—'}
                                              </td>
                                              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', color: '#4b5563' }}>
                                                {bookLastEditedAt ? formatContractBookLastEditedCalendarDate(bookLastEditedAt) : '—'}
                                              </td>
                                              <td style={{ padding: '0.5rem' }}>{doc?.status ?? 'unsent'}</td>
                                              <td style={{ padding: '0.5rem' }}>
                                                {doc?.url ? (
                                                  <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                                    Link
                                                  </a>
                                                ) : (
                                                  '—'
                                                )}
                                              </td>
                                              <td style={{ padding: '0.5rem' }}>{doc?.signed_at ?? '—'}</td>
                                              <td style={{ padding: '0.5rem' }}>{doc?.note ?? '—'}</td>
                                              <td style={{ padding: '0.5rem' }}>
                                                <div
                                                  style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                  }}
                                                >
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
                                                        setContractSendEmail('')
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
                                                          border: '1px solid #d1d5db',
                                                          borderRadius: 4,
                                                          background: '#fff',
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
                                                            background: '#fff',
                                                            border: '1px solid #e5e7eb',
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
                                                              color: '#111827',
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
                                                                color: '#b91c1c',
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
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      {contractsTemplateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 420, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Manage templates</h3>
              <button
                type="button"
                onClick={() => setContractsTemplateModalOpen(false)}
                style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {contractsError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{contractsError}</p>}
            {templateFormMode !== 'none' ? (
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>{editingContractTemplate ? 'Edit template' : 'New template'}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Template name</label>
                    <input
                      type="text"
                      value={templateFormName}
                      onChange={(e) => setTemplateFormName(e.target.value)}
                      placeholder="e.g. Farm Work"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Documents</label>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.45 }}>
                      Only library entries from <strong>Contract Book</strong> can be attached. Create or edit them there, then pick each one below.
                    </p>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label htmlFor={templateBookPickerLabelId} style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Add from Contract Book
                      </label>
                      {contractTemplateDocuments.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
                          No library entries yet. Open <strong>Contract Book</strong> on the Contracts tab and add at least one contract under a template, then return here.
                        </p>
                      ) : (
                        <>
                          <SearchableSelect
                            id={templateBookPickerLabelId}
                            value={templateBookPickerValue}
                            onChange={(id) => {
                              if (!id) {
                                setTemplateBookPickerValue('')
                                return
                              }
                              const row = contractTemplateDocuments.find((d) => d.id === id)
                              if (!row) {
                                setTemplateBookPickerValue('')
                                return
                              }
                              const pickedName = row.document_name
                              setTemplateFormDocumentNames((prev) => {
                                if (prev.some((x) => x.trim().toLowerCase() === pickedName.trim().toLowerCase())) {
                                  return prev
                                }
                                return [...prev, pickedName].sort()
                              })
                              setTemplateFormDocumentSourceByName((prev) => ({ ...prev, [pickedName]: id }))
                              setTemplateBookPickerValue('')
                            }}
                            options={templateBookPickerOptions}
                            emptyOption={{ value: '', label: 'Select…' }}
                            placeholder={templateBookPickerOptions.length === 0 ? 'No more to add' : 'Search…'}
                            disabled={templateBookPickerOptions.length === 0}
                            listAriaLabel="Add document from contract book library"
                            portalZIndex={1200}
                          />
                          {templateBookPickerOptions.length === 0 ? (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                              Every library document name is already attached to this template.
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                      {templateFormDocumentNames.map((docName) => (
                        <li key={docName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          {docName}
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateFormDocumentNames((prev) => prev.filter((d) => d !== docName))
                              setTemplateFormDocumentSourceByName((prev) => {
                                const next = { ...prev }
                                delete next[docName]
                                return next
                              })
                            }}
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem', color: '#b91c1c', border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={saveTemplate}
                      disabled={templateFormSaving}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: templateFormSaving ? 'not-allowed' : 'pointer' }}
                    >
                      {templateFormSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={closeTemplateForm}
                      style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem' }}>Templates</h4>
                <button
                  type="button"
                  onClick={() => openTemplateForm()}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
                >
                  + New template
                </button>
              </div>
              {contractTemplates.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No templates yet. Create one to assign to people.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'none' }}>
                  {contractTemplates.map((t) => {
                    const docs = contractTemplateDocuments.filter((d) => d.template_id === t.id).map((d) => d.document_name).sort()
                    return (
                      <li key={t.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#f9fafb', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{t.name}</strong>
                          {docs.length > 0 ? (
                            <ul
                              style={{
                                margin: '0.25rem 0 0',
                                paddingLeft: '1.25rem',
                                listStyle: 'disc',
                                listStylePosition: 'outside',
                                color: '#6b7280',
                                fontSize: '0.8125rem',
                              }}
                            >
                              {docs.map((docName) => (
                                <li key={docName} style={{ marginBottom: '0.15rem' }}>
                                  {docName}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => openTemplateForm(t)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          {canDeletePeopleContracts ? (
                            <button
                              type="button"
                              onClick={() => deleteContractTemplate(t)}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {contractsAssignModalOpen && selectedContractsPersonName && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 'min(92vw, 520px)', width: '100%' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>Assign template to {selectedContractsPersonName}</h3>
            {contractsError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{contractsError}</p>}
            {(() => {
              const assignedRows = personContractAssignments
                .filter((a) => a.person_name === selectedContractsPersonName)
                .map((a) => ({
                  assignment: a,
                  template: contractTemplates.find((x) => x.id === a.template_id),
                }))
                .sort((r, s) => (r.template?.name ?? '').localeCompare(s.template?.name ?? ''))
              if (assignedRows.length === 0) return null
              return (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.35rem' }}>Assigned templates</p>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.5rem', lineHeight: 1.45 }}>
                    Signed or in-progress documents stay on file; only empty placeholders are removed.
                  </p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {assignedRows.map(({ assignment: a, template: t }) => {
                      const docCount = contractTemplateDocuments.filter((d) => d.template_id === a.template_id).length
                      const docLabel = docCount > 0 ? ` (${docCount} docs)` : ''
                      const busyUnassign = assignTemplateUnassigningTemplateId === a.template_id
                      return (
                        <li
                          key={a.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.45rem 0.65rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            fontSize: '0.875rem',
                          }}
                        >
                          <span>
                            <span style={{ fontWeight: 600 }}>{t?.name ?? '—'}</span>
                            {docLabel}
                          </span>
                          {canDeletePeopleContracts ? (
                            <button
                              type="button"
                              onClick={() => void unassignTemplateFromPerson(a.template_id)}
                              disabled={
                                assignTemplateSaving ||
                                assignTemplateUnassigningTemplateId !== null
                              }
                              style={{
                                padding: '0.25rem 0.55rem',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                border: '1px solid #fecaca',
                                borderRadius: 6,
                                background: '#fef2f2',
                                color: '#b91c1c',
                                cursor:
                                  assignTemplateSaving || assignTemplateUnassigningTemplateId !== null
                                    ? 'not-allowed'
                                    : 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              {busyUnassign ? 'Unassigning…' : 'Unassign'}
                            </button>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })()}
            {contractTemplates.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>No templates. Create one in Manage templates first.</p>
            ) : (
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor={assignTemplateSearchInputId} style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                  Search templates
                </label>
                <input
                  id={assignTemplateSearchInputId}
                  type="search"
                  value={assignTemplateSearchQuery}
                  onChange={(e) => setAssignTemplateSearchQuery(e.target.value)}
                  placeholder="Type to filter…"
                  autoComplete="off"
                  aria-label="Search templates"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    marginBottom: '0.65rem',
                    boxSizing: 'border-box',
                  }}
                />
                <p id={assignTemplateRadioGroupLabelId} style={{ fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
                  Select template
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby={assignTemplateRadioGroupLabelId}
                  style={{
                    maxHeight: 280,
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '0.35rem',
                  }}
                >
                  {filteredAssignContractTemplates.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0.35rem' }}>No templates match your search.</p>
                  ) : (
                    filteredAssignContractTemplates.map((t) => {
                      const alreadyAssigned = personContractAssignments.some(
                        (a) => a.person_name === selectedContractsPersonName && a.template_id === t.id
                      )
                      const docCount = contractTemplateDocuments.filter((d) => d.template_id === t.id).length
                      const docLabel = docCount > 0 ? ` (${docCount} docs)` : ''
                      const selected = assignTemplateSelectedId === t.id
                      return (
                        <div
                          key={t.id}
                          role="radio"
                          aria-checked={selected}
                          aria-disabled={alreadyAssigned}
                          tabIndex={alreadyAssigned ? -1 : 0}
                          onClick={() => {
                            if (assignTemplateUnassigningTemplateId !== null) return
                            if (!alreadyAssigned) setAssignTemplateSelectedId(t.id)
                          }}
                          onKeyDown={(e) => {
                            if (assignTemplateUnassigningTemplateId !== null) return
                            if (alreadyAssigned) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setAssignTemplateSelectedId(t.id)
                            }
                          }}
                          style={{
                            padding: '0.5rem 0.65rem',
                            borderRadius: 4,
                            cursor:
                              alreadyAssigned || assignTemplateUnassigningTemplateId !== null
                                ? 'not-allowed'
                                : 'pointer',
                            opacity: alreadyAssigned || assignTemplateUnassigningTemplateId !== null ? 0.55 : 1,
                            background: selected ? '#eff6ff' : alreadyAssigned ? '#f9fafb' : 'transparent',
                            border: selected ? '1px solid #93c5fd' : '1px solid transparent',
                            marginBottom: 2,
                            fontSize: '0.875rem',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{t.name}</span>
                          {docLabel}
                          {alreadyAssigned ? (
                            <span style={{ color: '#6b7280', fontWeight: 400 }}> — already assigned (use Unassign above)</span>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={assignTemplateToPerson}
                disabled={
                  assignTemplateSaving ||
                  assignTemplateUnassigningTemplateId !== null ||
                  !assignTemplateSelectedId ||
                  contractTemplates.length === 0
                }
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor:
                    assignTemplateSaving || assignTemplateUnassigningTemplateId !== null ? 'not-allowed' : 'pointer',
                }}
              >
                {assignTemplateSaving ? 'Assigning…' : 'Assign'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setContractsAssignModalOpen(false)
                  setAssignTemplateSelectedId(null)
                  setAssignTemplateSearchQuery('')
                  setContractsError(null)
                }}
                disabled={assignTemplateSaving || assignTemplateUnassigningTemplateId !== null}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  cursor:
                    assignTemplateSaving || assignTemplateUnassigningTemplateId !== null ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {contractDocumentModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 'min(92vw, 520px)', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>{editingContractDocument ? 'Edit document' : 'Add document'}</h3>
            {contractsError ? (
              <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{contractsError}</p>
            ) : null}
            {!editingContractDocument ? (
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
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: contractDocumentAddTab === 'upload_signed' ? '#eff6ff' : '#fff',
                    color: contractDocumentAddTab === 'upload_signed' ? '#1d4ed8' : '#374151',
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
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: contractDocumentAddTab === 'request_signature' ? '#eff6ff' : '#fff',
                    color: contractDocumentAddTab === 'request_signature' ? '#1d4ed8' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Request Signature
                </button>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  Person
                  <span aria-hidden="true" style={{ color: '#b91c1c' }}>
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  Document name
                  <span aria-hidden="true" style={{ color: '#b91c1c' }}>
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: editingContractDocument ? '#f9fafb' : undefined }}
                />
              </div>
              {(editingContractDocument ||
                (!editingContractDocument && contractDocumentAddTab === 'request_signature')) && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    Applied version (Contract Book)
                  </label>
                  <select
                    value={contractDocumentFormAppliedTemplateDocId}
                    onChange={(e) => setContractDocumentFormAppliedTemplateDocId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    <option value="">Automatic (latest edit among assigned templates)</option>
                    {listAppliedContractBookVersionOptions(
                      contractDocumentFormPersonName,
                      contractDocumentFormDocumentName,
                    ).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.35rem 0 0', lineHeight: 1.45 }}>
                    Pins which Contract Book row sets the &quot;Applied version&quot; date for this person. Leave automatic
                    when any assigned template&apos;s copy is fine.
                  </p>
                </div>
              )}
              {editingContractDocument ? (
                <>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
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
                        background: '#f9fafb',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      <span>Contract text</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }} aria-hidden>
                        {contractEditModalContractTextExpanded ? '▾' : '▸'}
                      </span>
                    </button>
                    {contractEditModalContractTextExpanded ? contractDocModalContractTextField : null}
                  </div>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
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
                        background: '#f9fafb',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      <span>Canonical document URL (Doc / PDF)</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }} aria-hidden>
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
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0, lineHeight: 1.45 }}>
                    To use <strong>Send for signature</strong>, fill at least one of: contract text, canonical URL, or signed/reference link (not required to save).
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Status</label>
                    <select
                      value={contractDocumentFormStatus}
                      onChange={(e) => setContractDocumentFormStatus(e.target.value as 'unsent' | 'sent' | 'signed')}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    >
                      <option value="unsent">Unsent</option>
                      <option value="sent">Sent</option>
                      <option value="signed">Signed</option>
                    </select>
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
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Signed date</label>
                    <input
                      type="date"
                      value={contractDocumentFormSignedAt}
                      onChange={(e) => setContractDocumentFormSignedAt(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Note</label>
                    <textarea
                      value={contractDocumentFormNote}
                      onChange={(e) => setContractDocumentFormNote(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical' }}
                    />
                  </div>
                </>
              ) : contractDocumentAddTab === 'upload_signed' ? (
                  <div
                    role="tabpanel"
                    id={`${contractAddDocTabBaseId}-panel-upload`}
                    aria-labelledby={`${contractAddDocTabBaseId}-tab-upload`}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: 0, lineHeight: 1.45 }}>
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
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Signed date</label>
                        <input
                          type="date"
                          value={contractDocumentFormSignedAt}
                          onChange={(e) => setContractDocumentFormSignedAt(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>Note</label>
                        <textarea
                          value={contractDocumentFormNote}
                          onChange={(e) => setContractDocumentFormNote(e.target.value)}
                          rows={2}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical' }}
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
                      <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: 0, lineHeight: 1.45 }}>
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
                <button
                  type="button"
                  onClick={() => {
                    setContractDocumentModalOpen(false)
                    setContractDocumentDeleteConfirmOpen(false)
                    setContractDocumentDeleteTarget(null)
                  }}
                  style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
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
                      background: '#fef2f2',
                      color: '#b91c1c',
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
                  onClick={saveContractDocument}
                  disabled={contractDocumentFormSaving}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: contractDocumentFormSaving ? 'not-allowed' : 'pointer' }}
                >
                  {contractDocumentFormSaving ? 'Saving…' : 'Save'}
                </button>
                {!editingContractDocument && contractDocumentAddTab === 'request_signature' ? (
                  <button
                    type="button"
                    onClick={() => void saveContractDocumentAndOpenSend()}
                    disabled={contractDocumentFormSaving}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#0ea5e9',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: contractDocumentFormSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {contractDocumentFormSaving ? 'Saving…' : 'Send'}
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
                background: 'white',
                padding: '1.5rem',
                borderRadius: 8,
                minWidth: 320,
                maxWidth: 'min(92vw, 420px)',
              }}
            >
              <h3 id="contract-delete-confirm-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
                Delete document?
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 1rem', lineHeight: 1.45 }}>
                This removes <strong>{contractDocumentDeleteTarget.document_name}</strong> for{' '}
                <strong>{contractDocumentDeleteTarget.person_name}</strong>. This cannot be undone.
              </p>
              {(contractDocumentDeleteTarget.status === 'sent' ||
                contractDocumentDeleteTarget.status === 'signed') && (
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 1rem', lineHeight: 1.45 }}>
                  <strong>Note:</strong> This removes the contract record from PipeTooling, including any stored
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
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
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

      <PersonContractSignedRecordModal
        open={contractSignedRecordModalDocId !== null}
        documentId={contractSignedRecordModalDocId}
        onClose={() => setContractSignedRecordModalDocId(null)}
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

      {contractSendModalOpen && contractSendDocId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>Send for signature</h3>
            {contractsError ? <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{contractsError}</p> : null}
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Signer email</span>
              <input
                type="email"
                value={contractSendEmail}
                onChange={(e) => setContractSendEmail(e.target.value)}
                placeholder="name@example.com"
                style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', fontWeight: 400 }}
              />
            </label>
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Email subject (optional)</span>
              <input
                type="text"
                value={contractSendSubject}
                onChange={(e) => setContractSendSubject(e.target.value)}
                placeholder="Default: Sign contract: …"
                maxLength={200}
                style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', fontWeight: 400 }}
              />
            </label>
            <label style={{ display: 'block', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600 }}>Opening message (optional, plain text)</span>
              <textarea
                value={contractSendIntro}
                onChange={(e) => setContractSendIntro(e.target.value)}
                placeholder="Default: Please review and sign your contract. Leave blank to use the default opening line."
                rows={4}
                maxLength={4000}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '0.25rem',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontWeight: 400,
                }}
              />
            </label>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.5rem 0 0' }}>
              The email always includes the document name and a link to the signing page after your message.
            </p>
            {contractSendEmailPreview ? (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>Email preview</div>
                {contractSendEmailPreview.kind === 'missing' ? (
                  <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>Unable to load preview.</p>
                ) : (
                  <>
                    <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem', lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 600 }}>Subject: </span>
                      {contractSendEmailPreview.subject}
                    </div>
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: '0.75rem',
                        maxHeight: 220,
                        overflow: 'auto',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        background: '#fafafa',
                        color: '#111827',
                      }}
                      // eslint-disable-next-line react/no-danger -- app-generated contract email-preview HTML; values are escaped by the tested contractSendEmailPreview builder
                      dangerouslySetInnerHTML={{ __html: contractSendEmailPreview.htmlBody }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.35rem 0 0' }}>
                      The signing link is generated when you send.
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
                  setContractSendModalOpen(false)
                  setContractSendDocId(null)
                  setContractSendEmail('')
                  setContractSendSubject('')
                  setContractSendIntro('')
                  setContractsError(null)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
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
