/**
 * Supply-house bill capture, the reading (punch list #179 PR 2, v2.6088): what `bill-read` asks the model for and how
 * it reads the answer. Pure, no Deno globals, so the app's tests hold it and `src/lib/materials/bills/billRead.ts`
 * re-exports it. The model gets the bill's PDF as a document block (or a picture of the counter ticket as an image
 * block) and answers one JSON object held to `BILL_SCHEMA`: the house on the letterhead, what the paper is, its
 * number and date, every line with its extended price, the tax and the total, the PO text, the ship-to, the account
 * reference, the invoice a credit memo names, the terms, and whether the paper is a statement listing several
 * invoices. Every amount comes back as the digits the paper prints, in a string, and `readBillAnswer` turns them into
 * cents, so the schema never needs a nullable number. Nothing here writes: the read goes back to the form, and Save
 * invoice is the person's.
 */

/** The model that fills the form, and the one tried beside it on the made-up test set (the card's call 4). */
export const BILL_MODEL = 'claude-sonnet-5-5'
export const BILL_TRIAL_MODEL = 'claude-haiku-5-5'
export const BILL_MODELS: readonly string[] = [BILL_MODEL, BILL_TRIAL_MODEL]

/** A fill that refuses a bill goes to Anthropic's default fallback inside the same call (Sonnet only; Haiku has none). */
export const BILL_BETAS = ['server-side-fallback-2026-07-01'] as const

/** The `app_settings` key of the switch. 'true' lets the office start a bill from its PDF; anything else is off. */
export const BILL_READ_SWITCH_KEY = 'bill_read_on_v1'

export function billReadIsOn(valueText: string | null | undefined): boolean {
  return valueText === 'true'
}

/** How many fills the function makes in a rolling day before it says no. Cents a bill, so this is a tripwire, not a budget. */
export const BILL_READ_DAILY_CAP = 150

/** The biggest file the function reads. A phone's photo is 2 to 5 MB; a scanned statement rarely passes 8. */
export const BILL_FILE_MAX_BYTES = 10_000_000

/** Who may ask for a fill: the roles that see the Supply houses tab and its Add Invoice. */
export const BILL_READ_ROLES: ReadonlySet<string> = new Set(['dev', 'master_technician', 'assistant', 'controller'])

export type BillMedia = { kind: 'pdf'; mediaType: 'application/pdf' } | { kind: 'image'; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }

/** What the model can read: a PDF, or a picture in one of the four kinds the API takes. Null for anything else (a HEIC, a Word file). */
export function billMedia(mime: string | null | undefined, name: string): BillMedia | null {
  const m = (mime ?? '').toLowerCase().split(';')[0]!.trim()
  const ext = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase() ?? ''
  if (m === 'application/pdf' || (!m && ext === 'pdf') || (m === 'application/octet-stream' && ext === 'pdf')) return { kind: 'pdf', mediaType: 'application/pdf' }
  const byMime: Record<string, BillMedia['mediaType']> = { 'image/jpeg': 'image/jpeg', 'image/jpg': 'image/jpeg', 'image/png': 'image/png', 'image/gif': 'image/gif', 'image/webp': 'image/webp' }
  const byExt: Record<string, BillMedia['mediaType']> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
  const mediaType = byMime[m] ?? (!m || m === 'application/octet-stream' ? byExt[ext] : undefined)
  return mediaType && mediaType !== 'application/pdf' ? { kind: 'image', mediaType } : null
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

export type BillReadRequest =
  /** A file on the house's thread: `message_attachments.id`; the house the form is open on when the caller knows it. */
  | { source: 'attachment'; attachmentId: string; supplyHouseId: string | null; model: string }
  /** Another file, dropped on the form: its bytes as base64, kept in the bucket under the house. */
  | { source: 'upload'; supplyHouseId: string; name: string; mime: string; base64: string; model: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The request as the function reads it, or why it cannot. A model may be named only from the two the card allows. */
export function readBillRequest(body: unknown): { ok: true; request: BillReadRequest } | { ok: false; why: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const modelRaw = typeof b.model === 'string' ? b.model.trim() : ''
  if (modelRaw && !BILL_MODELS.includes(modelRaw)) return { ok: false, why: `The model must be ${BILL_MODEL} or ${BILL_TRIAL_MODEL}.` }
  const model = modelRaw || BILL_MODEL
  const attachmentId = typeof b.attachment_id === 'string' ? b.attachment_id.trim() : ''
  const supplyHouseId = typeof b.supply_house_id === 'string' ? b.supply_house_id.trim() : ''
  if (attachmentId) {
    if (!UUID.test(attachmentId)) return { ok: false, why: 'That is not a file on a thread.' }
    return { ok: true, request: { source: 'attachment', attachmentId, supplyHouseId: UUID.test(supplyHouseId) ? supplyHouseId : null, model } }
  }
  const file = (b.file && typeof b.file === 'object' ? b.file : null) as Record<string, unknown> | null
  if (!file) return { ok: false, why: 'Name the file on the thread, or send the file.' }
  if (!UUID.test(supplyHouseId)) return { ok: false, why: 'A dropped-in file needs the house it is for.' }
  const name = typeof file.name === 'string' ? file.name.trim().slice(0, 200) : ''
  const mime = typeof file.mime === 'string' ? file.mime.trim().slice(0, 100) : ''
  const base64 = typeof file.base64 === 'string' ? file.base64.replace(/\s+/g, '') : ''
  if (!name || !base64) return { ok: false, why: 'The file came with no name or no bytes.' }
  if (!billMedia(mime, name)) return { ok: false, why: 'The fill reads a PDF or a picture: a JPEG, a PNG, a GIF or a WebP.' }
  // Base64 is four characters for every three bytes.
  if (Math.floor((base64.length * 3) / 4) > BILL_FILE_MAX_BYTES) return { ok: false, why: `The file is over ${Math.round(BILL_FILE_MAX_BYTES / 1_000_000)} MB. Send a smaller scan.` }
  return { ok: true, request: { source: 'upload', supplyHouseId, name, mime, base64, model } }
}

/** A file name safe for a bucket path: letters, digits, dot, dash and underscore; never empty. */
export function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 120)
  return cleaned || 'bill'
}

/** Where a dropped-in file goes in the `message-attachments` bucket: under the house, in a folder of its own. */
export function billStoragePath(supplyHouseId: string, id: string, name: string): string {
  return `bills/${supplyHouseId}/${id}/${safeFileName(name)}`
}

// ---------------------------------------------------------------------------
// The schema and the words the model reads
// ---------------------------------------------------------------------------

/**
 * The one shape the model may answer with. Every amount and quantity is a string of the digits the paper prints
 * ('952.28', '12', '' when not printed): structured output has no clean nullable number and refuses `minimum` /
 * `maximum`, and the digits as printed are what the sum check wants anyway.
 */
export const BILL_SCHEMA = {
  type: 'object',
  properties: {
    house_name: { type: 'string', description: 'The supply house on the letterhead, as printed. Empty when none is printed.' },
    document_kind: { type: 'string', enum: ['invoice', 'credit_memo', 'statement', 'other'], description: 'invoice for an invoice or a counter ticket with a total; credit_memo for a credit, a return or a price correction; statement for a paper that lists several invoices with a balance; other for anything else.' },
    number: { type: 'string', description: "The document's own number, as printed: the invoice number, the credit memo number, or the statement number. Empty when none." },
    date: { type: 'string', description: 'The document date as YYYY-MM-DD. Empty when none is printed.' },
    po_text: { type: 'string', description: 'The purchase order, PO, job or reference text printed on the paper, as printed. Empty when none.' },
    account_ref: { type: 'string', description: "The customer's account number or job account reference printed on the paper, as printed. Empty when none." },
    ship_to: { type: 'string', description: 'The ship-to or job-site address and name, in one line. Empty when none.' },
    job_text: { type: 'string', description: 'A job name, site name or project the paper names apart from the ship-to. Empty when none.' },
    terms: { type: 'string', description: 'The payment terms as printed, such as Net 30 or Due on receipt. Empty when none.' },
    references_number: { type: 'string', description: 'For a credit memo: the invoice number it credits, from an RE, original invoice or reference line. Empty otherwise.' },
    lines: {
      type: 'array',
      description: 'Every line item on the paper, in order. Not the subtotal, tax or total rows.',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'The item as printed, in one line.' },
          quantity: { type: 'string', description: 'The quantity as printed, digits only. Empty when none.' },
          unit_price: { type: 'string', description: 'The unit price as printed, digits and a decimal point. Empty when none.' },
          extended: { type: 'string', description: 'The extended price of the line as printed, digits and a decimal point. A credit or a return is still a positive number. Empty when none.' },
        },
        required: ['description', 'quantity', 'unit_price', 'extended'],
        additionalProperties: false,
      },
    },
    subtotal: { type: 'string', description: 'The subtotal before tax as printed, digits and a decimal point. Empty when none.' },
    tax: { type: 'string', description: 'The sales tax as printed, digits and a decimal point. Empty when none.' },
    total: { type: 'string', description: 'The total, amount due, or credit total as printed, digits and a decimal point, always positive. Empty when none.' },
    page_count: { type: 'integer', description: 'How many pages the document has.' },
    statement_numbers: { type: 'array', items: { type: 'string' }, description: 'For a statement: every invoice and credit number it lists, in order. Empty otherwise.' },
    notes: { type: 'string', description: 'Anything on the paper a person should know that the fields above cannot hold, in one short sentence. Empty when nothing.' },
  },
  required: ['house_name', 'document_kind', 'number', 'date', 'po_text', 'account_ref', 'ship_to', 'job_text', 'terms', 'references_number', 'lines', 'subtotal', 'tax', 'total', 'page_count', 'statement_numbers', 'notes'],
  additionalProperties: false,
} as const

export const BILL_SYSTEM = [
  'You read a plumbing supply house\'s bill for a contractor\'s office and copy what it prints into fields.',
  'Copy exactly what is printed. Never guess a value the paper does not print; leave the field empty instead.',
  'Amounts and quantities are the digits as printed, with a decimal point and no currency sign or thousands separator.',
  'A credit memo\'s amounts are still positive numbers.',
  'The lines are the item rows only. The subtotal, tax and total rows go in their own fields.',
  'A paper that lists several invoices with a balance forward is a statement: set document_kind to statement and list every number it shows.',
].join(' ')

/** The message the model reads beside the document: which house the form is open on, so a wrong letterhead is easy to see. */
export function billUserMessage(houseName: string): string {
  return [
    `This file came in for the supply house ${houseName.trim() || '(unnamed)'}.`,
    'Read it and fill the fields. If the letterhead names another house, copy that name exactly as printed.',
  ].join(' ')
}

// ---------------------------------------------------------------------------
// The answer, read
// ---------------------------------------------------------------------------

export type BillKind = 'invoice' | 'credit' | 'statement' | 'other'

export interface BillLine {
  description: string
  /** Null when the paper prints none. */
  quantity: number | null
  /** Cents; null when the paper prints none. */
  unitPriceCents: number | null
  extendedCents: number | null
}

/** The paper, read: what the model said, held to the schema and turned into cents and a kind. */
export interface BillRead {
  houseName: string
  kind: BillKind
  number: string
  /** YYYY-MM-DD, or '' when the paper prints no date the reader could place. */
  dateYmd: string
  poText: string
  accountRef: string
  shipTo: string
  jobText: string
  terms: string
  referencesNumber: string
  lines: BillLine[]
  subtotalCents: number | null
  taxCents: number | null
  totalCents: number | null
  pageCount: number
  statementNumbers: string[]
  notes: string
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

/**
 * Printed money to cents: '952.28' → 95228, '$1,284.10' → 128410, '(128.40)' and '-128.40' → 12840 (the sign is the
 * kind's, never the amount's), '' → null. Anything that is not a number is null.
 */
export function moneyCents(printed: unknown): number | null {
  if (typeof printed === 'number') return Number.isFinite(printed) ? Math.round(Math.abs(printed) * 100) : null
  if (typeof printed !== 'string') return null
  const s = printed.replace(/[\s$,()]/g, '').replace(/^-/, '').replace(/^USD/i, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2))
}

/** A printed quantity: '12' → 12, '2.5' → 2.5, '' → null. */
export function quantityNumber(printed: unknown): number | null {
  if (typeof printed === 'number') return Number.isFinite(printed) ? printed : null
  if (typeof printed !== 'string') return null
  const s = printed.replace(/[\s,]/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null
  return Number(s)
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** A printed date read back to YYYY-MM-DD: the schema asks for that shape, and a US 10/22/2026 is turned when the model slips. */
export function dateYmd(printed: unknown): string {
  const s = text(printed, 40)
  if (YMD.test(s)) return s
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s)
  if (!us) return ''
  const year = us[3]!.length === 2 ? `20${us[3]}` : us[3]!
  return `${year}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}`
}

const KINDS: Record<string, BillKind> = { invoice: 'invoice', credit_memo: 'credit', credit: 'credit', statement: 'statement', other: 'other' }

/** The model's answer as a read; null when it is not the shape asked for. */
export function readBillAnswer(json: unknown): BillRead | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  const kind = KINDS[text(o.document_kind, 20).toLowerCase()]
  if (!kind) return null
  const lines: BillLine[] = []
  if (Array.isArray(o.lines)) {
    for (const raw of o.lines.slice(0, 200)) {
      const l = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const description = text(l.description, 240)
      const extendedCents = moneyCents(l.extended)
      if (!description && extendedCents === null) continue
      lines.push({ description, quantity: quantityNumber(l.quantity), unitPriceCents: moneyCents(l.unit_price), extendedCents })
    }
  }
  const pageRaw = o.page_count
  const pageCount = typeof pageRaw === 'number' && Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.round(pageRaw) : 1
  const statementNumbers = Array.isArray(o.statement_numbers) ? o.statement_numbers.map((n) => text(n, 60)).filter(Boolean).slice(0, 100) : []
  return {
    houseName: text(o.house_name, 120),
    kind,
    number: text(o.number, 60),
    dateYmd: dateYmd(o.date),
    poText: text(o.po_text, 160),
    accountRef: text(o.account_ref, 80),
    shipTo: text(o.ship_to, 200),
    jobText: text(o.job_text, 160),
    terms: text(o.terms, 60),
    referencesNumber: text(o.references_number, 60),
    lines,
    subtotalCents: moneyCents(o.subtotal),
    taxCents: moneyCents(o.tax),
    totalCents: moneyCents(o.total),
    pageCount,
    statementNumbers,
    notes: text(o.notes, 300),
  }
}

/** The text block of a Messages answer, parsed; null when there is none or it is not JSON. */
export function billFromAnswer(content: ReadonlyArray<{ type: string; text?: string }>): BillRead | null {
  const block = content.find((b) => b.type === 'text' && typeof b.text === 'string')
  if (!block?.text) return null
  try {
    return readBillAnswer(JSON.parse(block.text))
  } catch {
    return null
  }
}

/** Dollars a million tokens in and out, the card's two models (the claude-api reference, 2026-10). */
const RATES: Record<string, { input: number; output: number }> = {
  [BILL_MODEL]: { input: 2, output: 10 },
  [BILL_TRIAL_MODEL]: { input: 0.1, output: 0.5 },
}

/** What a fill cost, in cents to the hundredth, at the model's own rates. An unknown model is costed as Sonnet. */
export function billCostCents(model: string, usage: { input_tokens?: number; output_tokens?: number } | null | undefined): number {
  const rate = RATES[model] ?? RATES[BILL_MODEL]!
  const i = usage?.input_tokens ?? 0
  const o = usage?.output_tokens ?? 0
  return Math.round(((i * rate.input + o * rate.output) / 1_000_000) * 100 * 100) / 100
}

// ---------------------------------------------------------------------------
// The function's words, so the form shows the reason
// ---------------------------------------------------------------------------

export const BILL_READ_WORDS = {
  signIn: 'Sign in first.',
  notAllowed: 'This account cannot fill a bill from its PDF.',
  off: 'Filling a bill from its PDF is off. The owner or a dev turns it on.',
  noKey: 'No model key yet. The owner adds one on Settings → Phone and texts → Model keys. Type the bill from the paper for now.',
  capped: `The fill has read ${BILL_READ_DAILY_CAP} bills in the last day, its limit. Type this one from the paper, or try tomorrow.`,
  notHere: 'That file is not here. It may have been too big to keep when it came in.',
  notReadable: 'The fill reads a PDF or a picture: a JPEG, a PNG, a GIF or a WebP.',
  refused: 'The model would not read this one. Type the bill from the paper.',
  failed: 'The read did not come back whole. Type the bill from the paper, or try again.',
  notSetUp: 'The fill is not set up yet.',
} as const
