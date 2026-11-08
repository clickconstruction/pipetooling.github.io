/**
 * The proceedings beside a legal matter's claim (punch list #174, v2.6726; the table and its RPCs came with
 * v2.6705's migration). A collections claim rarely runs alone: an agency complaint, a records request or a bond
 * claim runs beside it, each with its own agency, reference number, contact, status and papers — and the papers
 * behind an agency complaint must stay out of a settlement letter to the other side (the card's example, job 891,
 * had no place on the matter for any of it). This kernel reads the stored rows (`legal_matter_proceedings`), checks a draft the way the RPC
 * does, names the documents a held proceeding keeps out, and cuts a proceeding to what the firm's portal may read
 * (never the office's note, never a person's reason). Pure and dependency-free: `legal-portal` and the client read
 * one rule; `src/lib/legal/legalProceedings.ts` is the client's door.
 */

export const LEGAL_PROCEEDING_KINDS = ['agency_complaint', 'records_request', 'bond_claim', 'permit', 'other'] as const
export type LegalProceedingKind = (typeof LEGAL_PROCEEDING_KINDS)[number]

export const LEGAL_PROCEEDING_STATUSES = ['open', 'answered', 'closed'] as const
export type LegalProceedingStatus = (typeof LEGAL_PROCEEDING_STATUSES)[number]

export const LEGAL_PROCEEDING_TITLE_MAX = 160
export const LEGAL_PROCEEDING_AGENCY_MAX = 160
export const LEGAL_PROCEEDING_REFERENCE_MAX = 120
export const LEGAL_PROCEEDING_NOTE_MAX = 600

export function isProceedingKind(raw: unknown): raw is LegalProceedingKind {
  return typeof raw === 'string' && (LEGAL_PROCEEDING_KINDS as readonly string[]).includes(raw)
}
export function isProceedingStatus(raw: unknown): raw is LegalProceedingStatus {
  return typeof raw === 'string' && (LEGAL_PROCEEDING_STATUSES as readonly string[]).includes(raw)
}

/** The kind as the list and the form word it. */
export function proceedingKindWords(kind: LegalProceedingKind): string {
  switch (kind) {
    case 'agency_complaint': return 'Agency complaint'
    case 'records_request': return 'Records request'
    case 'bond_claim': return 'Bond claim'
    case 'permit': return 'Permit'
    default: return 'Other'
  }
}

/** Where it stands, as the list words it: *open*, *answered 2026-11-03*, *closed 2026-11-05*. */
export function proceedingStatusWords(status: LegalProceedingStatus, statusOn: string | null): string {
  return statusOn ? `${status} ${statusOn}` : status
}

/** A stored row as the list reads it (`legal_matter_proceedings`, live rows only). */
export type LegalMatterProceedingRow = {
  id: string
  kind: string
  title: string
  agency: string | null
  reference: string | null
  person_id: string | null
  status: string
  status_on: string | null
  note?: string | null
  document_ids: string[] | null
  keep_out: boolean | null
  added_at: string
}

/** One proceeding as the desk carries it. */
export type LegalProceedingLike = {
  id: string
  kind: LegalProceedingKind
  title: string
  agency: string
  reference: string
  /** One of the matter's people, or nobody. */
  personId: string | null
  status: LegalProceedingStatus
  /** YYYY-MM-DD the status was reached, or null. */
  statusOn: string | null
  note: string
  /** Ids of the matter's Evidence rows behind it. */
  documentIds: string[]
  /** Hold its documents out of anything addressed to the other side. */
  keepOut: boolean
}

const ymdOf = (raw: unknown): string | null => (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null)
const idsOf = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0) : [])

/** The stored rows as proceedings, in the order added; an unknown kind reads as *other*, an unknown status as *open*. */
export function proceedingsFromRows(rows: ReadonlyArray<LegalMatterProceedingRow>): LegalProceedingLike[] {
  return rows
    .slice()
    .sort((a, b) => a.added_at.localeCompare(b.added_at) || a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      kind: isProceedingKind(r.kind) ? r.kind : 'other',
      title: r.title,
      agency: r.agency ?? '',
      reference: r.reference ?? '',
      personId: r.person_id ?? null,
      status: isProceedingStatus(r.status) ? r.status : 'open',
      statusOn: ymdOf(r.status_on),
      note: r.note ?? '',
      documentIds: idsOf(r.document_ids),
      keepOut: r.keep_out !== false,
    }))
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

export type LegalProceedingDraft = {
  kind: LegalProceedingKind
  title: string
  agency: string
  reference: string
  personId: string | null
  status: LegalProceedingStatus
  /** YYYY-MM-DD or empty. */
  statusOn: string
  note: string
  documentIds: string[]
  keepOut: boolean
}

export function emptyProceedingDraft(): LegalProceedingDraft {
  return { kind: 'agency_complaint', title: '', agency: '', reference: '', personId: null, status: 'open', statusOn: '', note: '', documentIds: [], keepOut: true }
}

export function proceedingDraftOf(p: LegalProceedingLike): LegalProceedingDraft {
  return { kind: p.kind, title: p.title, agency: p.agency, reference: p.reference, personId: p.personId, status: p.status, statusOn: p.statusOn ?? '', note: p.note, documentIds: [...p.documentIds], keepOut: p.keepOut }
}

/** Why a proceeding cannot be saved as typed; null when it can. The RPC holds the same rules. */
export function proceedingDraftProblem(draft: LegalProceedingDraft): string | null {
  if (!isProceedingKind(draft.kind)) return 'Pick what kind of proceeding this is.'
  if (!draft.title.trim()) return 'Name the proceeding.'
  if (draft.title.trim().length > LEGAL_PROCEEDING_TITLE_MAX) return `Keep the name under ${LEGAL_PROCEEDING_TITLE_MAX} characters.`
  if (draft.agency.trim().length > LEGAL_PROCEEDING_AGENCY_MAX) return `Keep the agency under ${LEGAL_PROCEEDING_AGENCY_MAX} characters.`
  if (draft.reference.trim().length > LEGAL_PROCEEDING_REFERENCE_MAX) return `Keep the reference under ${LEGAL_PROCEEDING_REFERENCE_MAX} characters.`
  if (!isProceedingStatus(draft.status)) return 'Pick where it stands: open, answered or closed.'
  if (draft.statusOn.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(draft.statusOn.trim())) return 'Write the day as a date.'
  if (draft.note.trim().length > LEGAL_PROCEEDING_NOTE_MAX) return `Keep the note under ${LEGAL_PROCEEDING_NOTE_MAX} characters.`
  return null
}

// ---------------------------------------------------------------------------
// The keep-out hold
// ---------------------------------------------------------------------------

/** Every document a live proceeding with *keep out* names: the Evidence rows that stay out of anything addressed to the other side. */
export function keptOutDocumentIds(proceedings: ReadonlyArray<Pick<LegalProceedingLike, 'documentIds' | 'keepOut'>>): Set<string> {
  const out = new Set<string>()
  for (const p of proceedings) if (p.keepOut) for (const id of p.documentIds) out.add(id)
  return out
}

export const KEPT_OUT_WORDS = 'kept out of settlement letters'

/** The row's second line: *ref C-2026-0431 · contact: R. Calloway · 2 documents · kept out of settlement letters*. */
export function proceedingDetailWords(p: Pick<LegalProceedingLike, 'reference' | 'documentIds' | 'keepOut'>, contactName: string | null): string {
  const parts: string[] = []
  if (p.reference.trim()) parts.push(`ref ${p.reference.trim()}`)
  if (contactName && contactName.trim()) parts.push(`contact: ${contactName.trim()}`)
  if (p.documentIds.length) parts.push(`${p.documentIds.length} ${p.documentIds.length === 1 ? 'document' : 'documents'}`)
  if (p.keepOut && p.documentIds.length) parts.push(KEPT_OUT_WORDS)
  return parts.join(' · ')
}

export const PROCEEDINGS_EMPTY_WORDS = 'Nothing runs beside the claim yet. Add a proceeding when an agency complaint, a records request or a bond claim opens.'

// ---------------------------------------------------------------------------
// The firm's read
// ---------------------------------------------------------------------------

/** The keys of a proceeding that may travel to the firm; `shapeMatterForCounsel` cuts each row to these. Never the note, never a person's id or reason. */
export const PROCEEDING_PAYLOAD_KEYS = ['id', 'kind', 'title', 'agency', 'reference', 'contact_name', 'contact_role', 'status', 'status_on', 'document_ids', 'keep_out', 'added_at'] as const

/** A proceeding as the function sends it: the contact's name and role in place of the person's id. */
export type LegalProceedingPayloadRow = {
  id: string
  kind: LegalProceedingKind
  title: string
  agency: string
  reference: string
  contact_name: string
  contact_role: string
  status: LegalProceedingStatus
  status_on: string | null
  document_ids: string[]
  keep_out: boolean
  added_at: string
}

/**
 * One proceeding cut to the firm's shape: the contact read off the matter's people by id (name and role only), the
 * documents cut to the ones that travelled (a held one is not named). The note and the person's reason stay home.
 */
export function proceedingForFirm(
  p: LegalProceedingLike,
  people: ReadonlyArray<{ id: string; name: string; role: string }>,
  travellingDocumentIds: ReadonlySet<string> | null,
  addedAt = '',
): LegalProceedingPayloadRow {
  const person = p.personId ? people.find((x) => x.id === p.personId) : undefined
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    agency: p.agency,
    reference: p.reference,
    contact_name: person?.name ?? '',
    contact_role: person?.role ?? '',
    status: p.status,
    status_on: p.statusOn,
    document_ids: travellingDocumentIds ? p.documentIds.filter((id) => travellingDocumentIds.has(id)) : [...p.documentIds],
    keep_out: p.keepOut,
    added_at: addedAt,
  }
}

/** A proceeding as the firm's page reads it. */
export type LegalProceedingForFirm = {
  id: string
  kind: LegalProceedingKind
  title: string
  agency: string
  reference: string
  contactName: string
  contactRole: string
  status: LegalProceedingStatus
  statusOn: string | null
  documentIds: string[]
  keepOut: boolean
}

/** The payload's proceedings, read defensively: a row without an id and a name is dropped; [] from an older function. */
export function parseLegalPortalProceedings(raw: unknown): LegalProceedingForFirm[] {
  if (!Array.isArray(raw)) return []
  const out: LegalProceedingForFirm[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue
    const p = r as Record<string, unknown>
    if (typeof p.id !== 'string' || typeof p.title !== 'string' || !p.title.trim()) continue
    out.push({
      id: p.id,
      kind: isProceedingKind(p.kind) ? p.kind : 'other',
      title: p.title,
      agency: typeof p.agency === 'string' ? p.agency : '',
      reference: typeof p.reference === 'string' ? p.reference : '',
      contactName: typeof p.contact_name === 'string' ? p.contact_name : '',
      contactRole: typeof p.contact_role === 'string' ? p.contact_role : '',
      status: isProceedingStatus(p.status) ? p.status : 'open',
      statusOn: ymdOf(p.status_on),
      documentIds: idsOf(p.document_ids),
      keepOut: p.keep_out !== false,
    })
  }
  return out
}
