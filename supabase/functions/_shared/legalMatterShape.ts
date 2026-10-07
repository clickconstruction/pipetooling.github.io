/**
 * What of one referred matter may travel to the collections law firm (punch
 * list #85, item 23). The matter path of `legal-portal` read whole rows
 * (`select('*')` on addresses, demand letters and lien filings) and sent more
 * than the page draws: an address's office note, a demand letter's whole draft
 * and the debtor's address and email, a filing's note and every address it was
 * sent to, the customer's whole contact JSON, the job's Drive and photo links,
 * and up to 500 job notes with their authors. The page reads a short list from
 * each row (traced through `buildMatterPacket` → `buildLegalPacket`, the
 * coverage, promise and lien-paper kernels, and `LegalFirmMatterView`).
 *
 * Here: one column list per table, the select strings the function uses (each
 * list plus the few columns only the function needs, such as the storage paths
 * it signs), and `shapeMatterForCounsel`, which cuts every row of a built
 * matter to its list before it is sent, so a select widened later cannot leak
 * by itself. Same pattern as `legalLienBookShape.ts` (item 2), whose property
 * record and owner lists this file reuses.
 *
 * Lives in `_shared` so the function and the client's tests read one list;
 * `src/lib/legal/legalMatterShape.ts` is the client's door.
 */
import { LIEN_BOOK_ADDRESS_COLUMNS, LIEN_BOOK_OWNER_COLUMNS } from './legalLienBookShape.ts'
import { MATTER_DOCUMENT_PAYLOAD_KEYS } from './legalMatterDocuments.ts'
import { NARRATIVE_PAYLOAD_KEYS } from './legalNarrative.ts'

type Row = Record<string, unknown>

/**
 * `jobs_ledger`: the job's identity, money, dates, lien facts and collections note. `customer_address_id`
 * stays for item 6 (the property per job); `contract_not_needed_at` / `_reason` feed the coverage kernel's
 * *not needed* reading (item 4, v2.4634). Never the Drive or photo links, or the job's status.
 */
export const MATTER_JOB_COLUMNS = ['id', 'hcp_number', 'click_number', 'job_name', 'job_address', 'customer_id', 'customer_name', 'customer_email', 'customer_phone', 'gc_customer_id', 'customer_address_id', 'revenue', 'payments_made', 'last_bill_date', 'last_work_date', 'created_at', 'lien_contract_ended_on', 'lien_retainage_held', 'lien_payment_bond', 'collections_at', 'collections_by', 'collections_note', 'contract_not_needed_at', 'contract_not_needed_reason'] as const
/** What the function adds to each job: its bills, its payments, the GC's name, the name of who flagged it. */
const MATTER_JOB_ADDED = ['invoices', 'payments', 'gcCustomer', 'collections_by_name'] as const
/**
 * `jobs_ledger_invoices`: amount, state, when billed and sent, the agreed write-down. `sequence_order` orders
 * the bills for the payment rule (item 5); `created_at` dates a bill for the promise rule,
 * `COALESCE(billed_at, created_at)` (item 9). Never the Stripe id.
 */
export const MATTER_INVOICE_COLUMNS = ['id', 'job_id', 'amount', 'status', 'billed_at', 'sent_to_customer_at', 'external_send_channel', 'stripe_invoice_status', 'sequence_order', 'agreed_write_down_at', 'agreed_write_down_note', 'agreed_write_down_previous_amount', 'created_at'] as const
/** `jobs_ledger_payments`: the payment as the ledger prints it. */
export const MATTER_PAYMENT_COLUMNS = ['id', 'job_id', 'invoice_id', 'amount', 'paid_on', 'sent_on', 'payment_type', 'reference_number'] as const
/** `customers` (the payer): name, address and kind. `contact_info` is cut to its emails and phones. Never the credit terms (item 4 took *Terms* off the firm's page). */
export const MATTER_CUSTOMER_COLUMNS = ['id', 'name', 'address', 'contact_info', 'customer_type'] as const
/** The keys of `customers.contact_info` the packet reads. */
export const MATTER_CONTACT_INFO_KEYS = ['email', 'billing_email', 'ap_email', 'phone', 'mobile', 'office_phone'] as const
/** `customer_contact_persons`: who to reach. `note` is the person's role as the office wrote it, printed in the packet. */
export const MATTER_CONTACT_PERSON_COLUMNS = ['name', 'email', 'phone', 'note'] as const
/** `customer_addresses`: the property record (item 2's list). Never the office's note on the address. */
export const MATTER_ADDRESS_COLUMNS = LIEN_BOOK_ADDRESS_COLUMNS
/** `job_property_owners`: the owner of record (item 2's list), sent as `jobOwners` for item 6. Never the owner's email. */
export const MATTER_PROPERTY_OWNER_COLUMNS = LIEN_BOOK_OWNER_COLUMNS
/** `legal_matters`: the matter's own row, named column by column (no `select('*')`). */
export const MATTER_ROW_COLUMNS = ['id', 'firm_id', 'stage', 'customer_id', 'payer_key', 'payer_name', 'handling_name', 'note_to_firm', 'released_at', 'held_overrides', 'fees_to_statement'] as const
/** `job_contracts`: who signed what and when, and the signed PDF as a short-lived link. Never the storage paths or the Doc link. */
export const MATTER_CONTRACT_COLUMNS = ['id', 'job_id', 'status', 'revision', 'recipient_email', 'recipient_name', 'sent_at', 'last_sent_at', 'view_count', 'signed_at', 'signer_printed_name', 'signer_mode', 'signer_consented_at', 'co_signer_name', 'co_signed_at', 'co_signer_printed_name', 'voided_at', 'signedPdfUrl'] as const
/** `estimates` accepted with consent: the coverage kernel's columns. Never the total. */
export const MATTER_ESTIMATE_COLUMNS = ['id', 'job_ledger_id', 'bid_id', 'doc_kind', 'status', 'acceptor_consented_at', 'acceptor_printed_name', 'estimate_number'] as const
/** `job_demand_letters`: sent when, how, tracking, deadline, to whom, for how much. `fields` is cut to the fee clock and the exhibits. */
export const MATTER_DEMAND_COLUMNS = ['id', 'job_id', 'amount', 'sent_at', 'sent_method', 'tracking_number', 'deadline_date', 'recipient_name', 'fields', 'voided_at', 'created_at'] as const
/** `job_lien_filings`: the paper and the public record. `sends` is cut to recipient, method, tracking and day. Never the office's note, the draft fields or the invoice ids. */
export const MATTER_FILING_COLUMNS = ['id', 'job_id', 'kind', 'amount', 'months_covered', 'filed_at', 'served_at', 'serve_due', 'county', 'recording_number', 'sends', 'document_url', 'packet_id', 'printed_claim', 'by_hand', 'voided_at', 'created_at'] as const
/**
 * `legal_matter_entries`: the matter's own stream. `acknowledged_at` tells a withdrawn ask from an open one and a
 * seen act from a waiting one. `voided_at`, `voided_via_portal` and `void_reason` are item 18 PR 2's (#4637), listed
 * now so a voided entry never travels as live once they exist.
 */
export const MATTER_ENTRY_COLUMNS = ['id', 'matter_id', 'kind', 'amount', 'body', 'occurred_on', 'meta', 'via_portal', 'acknowledged_at', 'created_at', 'voided_at', 'voided_via_portal', 'void_reason'] as const
/**
 * The entry columns item 18 PR 2's migration adds (`20261006160000`). `legal-portal`'s `readMatterEntries` asks
 * for them and falls back without them while that migration is unpushed (selecting a missing column fails the
 * whole read); the shaper carries them either way, so a voided entry never travels as live.
 */
export const MATTER_ENTRY_PENDING_COLUMNS: ReadonlyArray<string> = ['voided_at', 'voided_via_portal', 'void_reason']

/** The select strings: each list, plus the columns only the function reads (the PDF paths it signs, the payer key). */
export const MATTER_COUNSEL_SELECT = {
  jobs: MATTER_JOB_COLUMNS.join(', '),
  invoices: MATTER_INVOICE_COLUMNS.join(', '),
  payments: MATTER_PAYMENT_COLUMNS.join(', '),
  customers: MATTER_CUSTOMER_COLUMNS.join(', '),
  contactPersons: ['customer_id', ...MATTER_CONTACT_PERSON_COLUMNS].join(', '),
  addresses: MATTER_ADDRESS_COLUMNS.join(', '),
  jobAddresses: MATTER_ADDRESS_COLUMNS.join(', '),
  jobOwners: MATTER_PROPERTY_OWNER_COLUMNS.join(', '),
  matters: MATTER_ROW_COLUMNS.join(', '),
  contracts: [...MATTER_CONTRACT_COLUMNS.filter((c) => c !== 'signedPdfUrl'), 'signed_pdf_path', 'paper_upload_path'].join(', '),
  estimates: MATTER_ESTIMATE_COLUMNS.join(', '),
  demandLetters: MATTER_DEMAND_COLUMNS.join(', '),
  filings: MATTER_FILING_COLUMNS.join(', '),
  entries: MATTER_ENTRY_COLUMNS.filter((c) => !MATTER_ENTRY_PENDING_COLUMNS.includes(c)).join(', '),
} as const

function isRecord(v: unknown): v is Row {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

function pick(row: unknown, keys: ReadonlyArray<string>): Row {
  const r = isRecord(row) ? row : {}
  const out: Row = {}
  for (const k of keys) out[k] = k in r ? r[k] : null
  return out
}

function rows(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

/** `customers.contact_info` cut to its emails and phones. */
export function shapeContactInfo(info: unknown): Row {
  return isRecord(info) ? pick(info, MATTER_CONTACT_INFO_KEYS) : {}
}

/** A demand letter's snapshot cut to what the packet reads: the fee clock and the exhibits it enclosed (label, kind, title, pages). */
export function shapeDemandFields(fields: unknown): Row {
  const f = isRecord(fields) ? fields : {}
  const enclosures = rows(f.enclosures).filter(isRecord).map((e) => pick(e, ['label', 'kind', 'title', 'pages']))
  return { feeClockYmd: typeof f.feeClockYmd === 'string' ? f.feeClockYmd : null, enclosures }
}

/** A filing's sends cut to who, how, the tracking number and the day. Never an address or an email. */
export function shapeFilingSends(sends: unknown): Row[] {
  return rows(sends).filter(isRecord).map((s) => pick(s, ['recipient', 'method', 'tracking', 'sent_on']))
}

/**
 * One built matter as the firm may hold it: every row cut to its list. Job notes travel as a count's worth
 * of `{ jobId, createdAt }` with no body and no author; the packet counts them per job and draws nothing else.
 * Keys the matter carries that are not rows (stage, payer, the note to the firm, promises, sessions, …) pass
 * through: the function builds those already shaped.
 */
export function shapeMatterForCounsel(matter: Row): Row {
  const out: Row = { ...matter }
  out.jobs = rows(matter.jobs).map((j) => {
    const job = isRecord(j) ? j : {}
    const shaped = pick(job, [...MATTER_JOB_COLUMNS, ...MATTER_JOB_ADDED])
    shaped.invoices = rows(job.invoices).map((i) => pick(i, MATTER_INVOICE_COLUMNS))
    shaped.payments = rows(job.payments).map((p) => pick(p, MATTER_PAYMENT_COLUMNS))
    shaped.gcCustomer = isRecord(job.gcCustomer) ? pick(job.gcCustomer, ['id', 'name']) : null
    return shaped
  })
  if ('customer' in matter) {
    out.customer = isRecord(matter.customer) ? { ...pick(matter.customer, MATTER_CUSTOMER_COLUMNS), contact_info: shapeContactInfo(matter.customer.contact_info) } : null
  }
  if ('contacts' in matter) out.contacts = rows(matter.contacts).map((c) => pick(c, MATTER_CONTACT_PERSON_COLUMNS))
  if ('addresses' in matter) out.addresses = rows(matter.addresses).map((a) => pick(a, MATTER_ADDRESS_COLUMNS))
  if ('jobAddresses' in matter) out.jobAddresses = rows(matter.jobAddresses).map((a) => pick(a, MATTER_ADDRESS_COLUMNS))
  if ('jobOwners' in matter) out.jobOwners = rows(matter.jobOwners).map((o) => pick(o, MATTER_PROPERTY_OWNER_COLUMNS))
  if ('contracts' in matter) out.contracts = rows(matter.contracts).map((c) => pick(c, MATTER_CONTRACT_COLUMNS))
  if ('signedEstimates' in matter) out.signedEstimates = rows(matter.signedEstimates).map((e) => pick(e, MATTER_ESTIMATE_COLUMNS))
  if ('demandLetters' in matter) out.demandLetters = rows(matter.demandLetters).map((d) => ({ ...pick(d, MATTER_DEMAND_COLUMNS), fields: shapeDemandFields(isRecord(d) ? d.fields : null) }))
  if ('lienFilings' in matter) out.lienFilings = rows(matter.lienFilings).map((f) => ({ ...pick(f, MATTER_FILING_COLUMNS), sends: shapeFilingSends(isRecord(f) ? f.sends : null) }))
  if ('threadNotes' in matter) out.threadNotes = rows(matter.threadNotes).filter(isRecord).map((n) => ({ jobId: n.jobId ?? null, createdAt: n.createdAt ?? null, body: '', authorName: null }))
  if ('entries' in matter) out.entries = rows(matter.entries).map((e) => pick(e, MATTER_ENTRY_COLUMNS))
  // Documents from the office (v2.4810): the title, the line, the kind, the size, the day, who added it, the link. Never the storage path or a hold reason.
  if ('documents' in matter) out.documents = rows(matter.documents).map((d) => pick(d, MATTER_DOCUMENT_PAYLOAD_KEYS))
  // The narrative (v2.4812): the office's own words for the firm, who saved them and when; nothing else.
  if ('narrative' in matter) out.narrative = isRecord(matter.narrative) ? pick(matter.narrative, NARRATIVE_PAYLOAD_KEYS) : null
  return out
}
