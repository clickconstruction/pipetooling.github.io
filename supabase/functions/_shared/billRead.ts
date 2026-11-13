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
    document_kind: { type: 'string', enum: ['invoice', 'credit_memo', 'ship_ticket', 'acknowledgement', 'quote', 'bid', 'statement', 'other'], description: 'invoice for an invoice or a counter ticket with a total; credit_memo for a credit, a return or a price correction; ship_ticket for a packing list, pick ticket or delivery ticket that prices nothing or says it is not an invoice; acknowledgement for an order acknowledgement or sales order confirmation; quote for a quote or proposal; bid for a bid; statement for a paper that lists several invoices with a balance; other for anything else.' },
    number: { type: 'string', description: "The document's own number, as printed: the invoice number, the credit memo number, the ticket, order, quote or statement number. Empty when none." },
    date: { type: 'string', description: 'The document date as YYYY-MM-DD. Empty when none is printed.' },
    order_number: { type: 'string', description: "The supplier's sales order number, as printed, when the paper carries one apart from its own number: the order an acknowledgement, a ship ticket and an invoice share. Empty when none." },
    po_text: { type: 'string', description: 'The purchase order, PO, job or reference text printed on the paper, as printed. Empty when none.' },
    account_ref: { type: 'string', description: "The customer's account number or job account reference printed on the paper, as printed. Empty when none." },
    ship_to: { type: 'string', description: 'The ship-to or job-site address and name, in one line. Empty when none.' },
    job_text: { type: 'string', description: 'A job name, site name or project the paper names apart from the ship-to. Empty when none.' },
    terms: { type: 'string', description: 'The payment terms as printed, such as Net 30 or Due on receipt. Empty when none.' },
    references_number: { type: 'string', description: 'For a credit memo: the invoice number it credits, from an RE, original invoice or reference line. Empty otherwise.' },
    lines: {
      type: 'array',
      description: 'Every line item on the paper, in order, each printed line its own entry: a part, a charge such as freight or a restock fee, or a component of a kit printed under the kit line with no price of its own. Not the subtotal, tax or total rows.',
      items: {
        type: 'object',
        properties: {
          line_kind: { type: 'string', enum: ['part', 'charge', 'component'], description: 'part for an item; charge for freight, delivery, fuel, a restock fee or any other charge that is not an item; component for a line printed under a kit or a bundle that carries no price of its own.' },
          house_code: { type: 'string', description: "The supply house's own part code for the line, as printed in its item, product, SKU or code column. Empty when none." },
          mfr_number: { type: 'string', description: "The manufacturer's part number when the paper prints one apart from the house's code. Empty when none." },
          description: { type: 'string', description: 'The item as printed, in one line.' },
          unit: { type: 'string', description: 'The unit of measure as printed: EA, FT, BX, C, M, LF. Empty when none.' },
          quantity: { type: 'string', description: 'The quantity the line is priced for, as printed, digits only: the quantity shipped when the paper prints shipped and ordered apart. Empty when none.' },
          qty_ordered: { type: 'string', description: 'The quantity ordered when the paper prints it in its own column, digits only. Empty when none.' },
          qty_shipped: { type: 'string', description: 'The quantity shipped when the paper prints it in its own column, digits only. Empty when none.' },
          qty_backordered: { type: 'string', description: 'The quantity back ordered when the paper prints it in its own column, digits only. Empty when none.' },
          unit_price: { type: 'string', description: 'The unit price as printed, digits and a decimal point, with every decimal the paper prints. Empty when none.' },
          pricing_unit: { type: 'string', enum: ['each', 'per_hundred', 'per_thousand'], description: 'What the unit price is for: each when it is for one; per_hundred when the paper marks the price per C or per 100; per_thousand when it marks it per M or per 1000.' },
          extended: { type: 'string', description: "The extended price of the line as printed, digits and a decimal point. A credit memo's lines are still positive numbers. A line that takes money off the paper it is on, a rebate, a discount, a return or a credit printed among an invoice's items with a minus sign, in parentheses or with CR, keeps a minus sign in front: -40.00. Empty when none." },
        },
        required: ['line_kind', 'house_code', 'mfr_number', 'description', 'unit', 'quantity', 'qty_ordered', 'qty_shipped', 'qty_backordered', 'unit_price', 'pricing_unit', 'extended'],
        additionalProperties: false,
      },
    },
    subtotal: { type: 'string', description: 'The subtotal before tax as printed, digits and a decimal point. Empty when none.' },
    tax: { type: 'string', description: 'The sales tax as printed, digits and a decimal point. Empty when none.' },
    freight: { type: 'string', description: 'Freight, delivery or shipping printed as its own row below the lines and outside the subtotal, digits and a decimal point. Empty when none, or when freight is a line of its own.' },
    total: { type: 'string', description: 'The total, amount due, or credit total as printed, digits and a decimal point, always positive. Empty when none.' },
    page_count: { type: 'integer', description: 'How many pages the document has.' },
    statement_numbers: { type: 'array', items: { type: 'string' }, description: 'For a statement: every invoice and credit number it lists, in order. Empty otherwise.' },
    notes: { type: 'string', description: 'Anything on the paper a person should know that the fields above cannot hold, in one short sentence. Empty when nothing.' },
  },
  required: ['house_name', 'document_kind', 'number', 'date', 'order_number', 'po_text', 'account_ref', 'ship_to', 'job_text', 'terms', 'references_number', 'lines', 'subtotal', 'tax', 'freight', 'total', 'page_count', 'statement_numbers', 'notes'],
  additionalProperties: false,
} as const

export const BILL_SYSTEM = [
  'You read a plumbing supply house\'s bill for a contractor\'s office and copy what it prints into fields.',
  'Copy exactly what is printed. Never guess a value the paper does not print; leave the field empty instead.',
  'Amounts and quantities are the digits as printed, with a decimal point and no currency sign or thousands separator.',
  'A credit memo\'s amounts are still positive numbers.',
  'A line that takes money off the paper it is on, a rebate, a discount, a return or a credit among an invoice\'s items, keeps a minus sign on its extended price.',
  'The lines are the item rows only. The subtotal, tax and total rows go in their own fields.',
  'Every printed line is its own entry, with the house\'s own part code copied exactly as printed, letter for letter and digit for digit.',
  'A line printed under a kit or a bundle with no price of its own is a component; a freight, delivery or restock row among the lines is a charge.',
  'When a unit price is marked per C, per 100, per M or per 1000, copy it as printed and set pricing_unit; never divide it.',
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

/** What the paper is. Only an invoice and a credit are bills; the rest are read for their lines (punch list #298) and never fill a bill's row. */
export type BillKind = 'invoice' | 'credit' | 'ship_ticket' | 'acknowledgement' | 'quote' | 'bid' | 'statement' | 'other'

export type BillLineKind = 'part' | 'charge' | 'component'
export type BillPricingUnit = 'each' | 'per_hundred' | 'per_thousand'

export interface BillLine {
  description: string
  /** Null when the paper prints none. */
  quantity: number | null
  /** Cents; null when the paper prints none. Rounded: a wholesaler's 2.159 is kept whole in `unitPrice`. */
  unitPriceCents: number | null
  /** Cents, signed since v2.7103: negative for a line that takes money off the paper it is on (a rebate among an invoice's parts). */
  extendedCents: number | null
  /** The paper's own columns (v2.6817): the house's part code, the manufacturer's number, the unit, the three quantities, the price as printed with its pricing unit, the kind of line. */
  lineKind: BillLineKind
  houseCode: string
  mfrNumber: string
  unit: string
  qtyOrdered: number | null
  qtyShipped: number | null
  qtyBackordered: number | null
  /** The unit price as printed, in dollars with every decimal the paper prints; null when none. */
  unitPrice: number | null
  pricingUnit: BillPricingUnit
}

/** The paper, read: what the model said, held to the schema and turned into cents and a kind. */
export interface BillRead {
  houseName: string
  kind: BillKind
  number: string
  /** YYYY-MM-DD, or '' when the paper prints no date the reader could place. */
  dateYmd: string
  /** The supplier's sales order number when printed apart from the paper's own number; '' when none. */
  orderNumber: string
  poText: string
  accountRef: string
  shipTo: string
  jobText: string
  terms: string
  referencesNumber: string
  lines: BillLine[]
  subtotalCents: number | null
  taxCents: number | null
  /** Freight printed as its own row outside the subtotal; null when none. */
  freightCents: number | null
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
  if (!/^\d+(?:\.\d{1,4})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  // Two decimals are read as digits; a wholesaler's 2.159 (three or four, v2.6817) is rounded to the cent, the whole price kept by priceNumber.
  if (frac.length > 2) return Math.round(Number(s) * 100)
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2))
}

/**
 * A line's printed extension to cents, with its sign (PR 1c of punch list #298, v2.7103): '-40.00', '(40.00)',
 * '40.00-' and '40.00 CR' → -4000; '40.00' → 4000. A rebate or a credit printed among an invoice's parts takes money
 * off the paper, so its line is negative and the lines still sum to the subtotal. A paper's own money (the subtotal,
 * the tax, the total) stays unsigned through `moneyCents`: there the kind carries the direction.
 */
export function signedMoneyCents(printed: unknown): number | null {
  if (typeof printed === 'number') return Number.isFinite(printed) ? Math.round(printed * 100) : null
  if (typeof printed !== 'string') return null
  const t = printed.trim()
  const negative = /^-/.test(t) || /^\(.*\)$/.test(t) || /-$/.test(t) || /\bCR$/i.test(t)
  const cents = moneyCents(t.replace(/-$/, '').replace(/\s*CR$/i, ''))
  return cents == null ? null : negative && cents !== 0 ? -cents : cents
}

/** A printed unit price kept whole, in dollars: '2.159' → 2.159, '$48.10' → 48.1, '' → null. Four decimals at most, the column's width. */
export function priceNumber(printed: unknown): number | null {
  if (typeof printed === 'number') return Number.isFinite(printed) ? Math.round(Math.abs(printed) * 10000) / 10000 : null
  if (typeof printed !== 'string') return null
  const s = printed.replace(/[\s$,()]/g, '').replace(/^-/, '').replace(/^USD/i, '')
  if (!/^\d+(?:\.\d{1,4})?$/.test(s)) return null
  return Number(s)
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

const KINDS: Record<string, BillKind> = { invoice: 'invoice', credit_memo: 'credit', credit: 'credit', ship_ticket: 'ship_ticket', acknowledgement: 'acknowledgement', quote: 'quote', bid: 'bid', statement: 'statement', other: 'other' }
const LINE_KINDS: Record<string, BillLineKind> = { part: 'part', charge: 'charge', component: 'component' }
const PRICING_UNITS: Record<string, BillPricingUnit> = { each: 'each', per_hundred: 'per_hundred', per_thousand: 'per_thousand' }

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
      const extendedCents = signedMoneyCents(l.extended)
      if (!description && extendedCents === null) continue
      const qtyShipped = quantityNumber(l.qty_shipped)
      lines.push({
        description,
        quantity: quantityNumber(l.quantity) ?? qtyShipped,
        unitPriceCents: moneyCents(l.unit_price),
        extendedCents,
        lineKind: LINE_KINDS[text(l.line_kind, 20).toLowerCase()] ?? 'part',
        houseCode: text(l.house_code, 60),
        mfrNumber: text(l.mfr_number, 60),
        unit: text(l.unit, 12),
        qtyOrdered: quantityNumber(l.qty_ordered),
        qtyShipped,
        qtyBackordered: quantityNumber(l.qty_backordered),
        unitPrice: priceNumber(l.unit_price),
        pricingUnit: PRICING_UNITS[text(l.pricing_unit, 20).toLowerCase()] ?? 'each',
      })
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
    orderNumber: text(o.order_number, 60),
    poText: text(o.po_text, 160),
    accountRef: text(o.account_ref, 80),
    shipTo: text(o.ship_to, 200),
    jobText: text(o.job_text, 160),
    terms: text(o.terms, 60),
    referencesNumber: text(o.references_number, 60),
    lines,
    subtotalCents: moneyCents(o.subtotal),
    taxCents: moneyCents(o.tax),
    freightCents: moneyCents(o.freight),
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
