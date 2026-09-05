import { normalizeCustomerAttachmentUrl } from '../estimateCustomerAttachment'

/**
 * "Add document" for a sub (journey-map Tier-2 #33, J32-F4/N1/N2): the pure
 * half of filing a COI / W-9 / license / paper-signed agreement straight onto
 * a sub's row or their Desk, typed from birth. Before this, the only way a
 * `coi` or `w9` row could exist was to mint a contract on the Contracts tab
 * and then re-type it in the Subs expander — 0 COI rows ever.
 *
 * Draft → validity → insert payload are all pure so the two doors (Subs row
 * expander, Person Desk → Paperwork) share one contract and one test file.
 */

export type SubDocumentType = 'coi' | 'w9' | 'license' | 'agreement' | 'other'

export const SUB_DOCUMENT_TYPES: ReadonlyArray<{ value: SubDocumentType; label: string; defaultName: string }> = [
  { value: 'coi', label: 'COI — insurance certificate', defaultName: 'COI (filed)' },
  { value: 'w9', label: 'W-9', defaultName: 'W-9 (filed)' },
  { value: 'license', label: 'License', defaultName: 'License (filed)' },
  { value: 'agreement', label: 'Agreement — signed on paper', defaultName: 'Agreement (filed)' },
  { value: 'other', label: 'Other', defaultName: 'Document (filed)' },
]

export const SUB_DOCUMENT_TYPE_LABEL: Record<SubDocumentType, string> = {
  coi: 'COI',
  w9: 'W-9',
  license: 'License',
  agreement: 'Agreement',
  other: 'Other',
}

/** Types whose badge turns on expiry — the draft requires a date for these. */
export const SUB_DOCUMENT_TYPES_REQUIRING_EXPIRY: ReadonlySet<SubDocumentType> = new Set(['coi'])

export type SubDocumentDraft = {
  /** '' until the user picks one. */
  docType: SubDocumentType | ''
  /** YYYY-MM-DD or ''. */
  expiresAt: string
  /** Optional https link to the file (Drive, etc.); '' = none. */
  url: string
  /** Display name; '' falls back to the type's default name on save. */
  documentName: string
}

export function emptySubDocumentDraft(): SubDocumentDraft {
  return { docType: '', expiresAt: '', url: '', documentName: '' }
}

export function isSubDocumentType(value: string): value is SubDocumentType {
  return SUB_DOCUMENT_TYPES.some((t) => t.value === value)
}

export function defaultSubDocumentName(docType: SubDocumentType): string {
  return SUB_DOCUMENT_TYPES.find((t) => t.value === docType)?.defaultName ?? 'Document (filed)'
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

export type SubDocumentDraftValidity = { ok: true } | { ok: false; reason: string }

/**
 * Save-gate for the draft. Type is required; a COI needs an expiry (the badge
 * is meaningless without one); an expiry, when given, must be a calendar day;
 * a link, when given, must be an https URL.
 */
export function subDocumentDraftValid(draft: SubDocumentDraft): SubDocumentDraftValidity {
  if (!draft.docType) return { ok: false, reason: 'Pick what the document is.' }
  if (!isSubDocumentType(draft.docType)) return { ok: false, reason: 'Unknown document type.' }
  const expires = draft.expiresAt.trim()
  if (SUB_DOCUMENT_TYPES_REQUIRING_EXPIRY.has(draft.docType) && !expires) {
    return { ok: false, reason: `A ${SUB_DOCUMENT_TYPE_LABEL[draft.docType]} needs its expiration date.` }
  }
  if (expires && !YMD.test(expires)) return { ok: false, reason: 'Expiration must be a calendar date.' }
  const url = draft.url.trim()
  if (url && !normalizeCustomerAttachmentUrl(url)) return { ok: false, reason: 'The file link must be an https:// URL.' }
  return { ok: true }
}

export type SubDocumentInsertRow = {
  person_id: string | null
  person_name: string
  document_name: string
  doc_type: SubDocumentType
  expires_at: string | null
  url: string | null
  status: 'signed'
  signed_at: string
  contract_lineage_id: string
  lineage_version: 1
  supersedes_person_contract_document_id: null
}

/**
 * The row to INSERT for a valid draft. Filed paperwork is "on file", which in
 * person_contract_documents is `status = 'signed'` (the Paperwork rollup shows
 * unsent/sent as red/blue). Callers must have passed `subDocumentDraftValid`.
 */
export function buildSubDocumentInsert(
  draft: SubDocumentDraft,
  person: { personId: string | null; personName: string },
  nowIso: string,
  lineageId: string,
): SubDocumentInsertRow {
  const docType = draft.docType as SubDocumentType
  const name = draft.documentName.trim() || defaultSubDocumentName(docType)
  return {
    person_id: person.personId,
    person_name: person.personName,
    document_name: name,
    doc_type: docType,
    expires_at: draft.expiresAt.trim() || null,
    url: normalizeCustomerAttachmentUrl(draft.url),
    status: 'signed',
    signed_at: nowIso,
    contract_lineage_id: lineageId,
    lineage_version: 1,
    supersedes_person_contract_document_id: null,
  }
}

/**
 * Name-based guess at what a document is. The DB defaults `doc_type` to
 * 'agreement' on every row the Contracts tab mints, so a "COI 2026" uploaded
 * there reads as the sub's Agreement (J32-N2). There is no "untyped" state to
 * detect — the column is NOT NULL — so the honest signal is a row whose NAME
 * says one thing and whose TYPE says another.
 */
export function suggestSubDocumentType(documentName: string): Exclude<SubDocumentType, 'agreement' | 'other'> | null {
  const n = documentName.toLowerCase()
  if (/\bw[\s-]?9\b/.test(n)) return 'w9'
  if (/\bcoi\b|certificate of (liability |general )?insurance|insurance cert/.test(n)) return 'coi'
  if (/\blicen[sc]e\b/.test(n)) return 'license'
  return null
}

/**
 * When a row's type looks wrong for its name, the type the name suggests;
 * otherwise null. Only fires for rows still carrying the DB default
 * ('agreement') — a deliberate 'other' or a typed row is left alone.
 */
export function suggestedRetype(doc: { document_name: string; doc_type: string | null | undefined }): SubDocumentType | null {
  if ((doc.doc_type ?? 'agreement') !== 'agreement') return null
  return suggestSubDocumentType(doc.document_name)
}
