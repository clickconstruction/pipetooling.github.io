/**
 * GC mode, the trade partner portal's writes (P2b-i, to-dos/gc-mode/mockups/portal-p2b.md): the rules
 * `submit-gc-trade-portal` applies before it calls a `gc_trade_<verb>` (P2a). Pure, with no Deno or browser API,
 * so `src/lib/gc/gcTradeSubmit.test.ts` holds them:
 *   - the shape of each kind, read into the verb's call (the company is added by the function, from the link), and
 *     for a signature (P2c-ii, and P5c-3b's waiver and change) the drawn image, the e-sign consent and the paper its
 *     ledger row is keyed by, which the function handles around the verb;
 *   - the hourly cap on free-text writes;
 *   - the refusal keys, each with its status, as the page says them in the company's language (decision 11);
 *   - Spanish's hold, copied from `src/lib/gc/portalI18n.ts`, and the waiver's, copied from `src/lib/gc/drawEmail.ts` (a
 *     test keeps each pair equal).
 */

/** Copy of `PORTAL_SPANISH_ON` in `src/lib/gc/portalI18n.ts`: the edge functions cannot import `src`. */
export const PORTAL_SPANISH_ON = false

/**
 * Copy of `WAIVER_SIGN_LIVE` in `src/lib/gc/drawEmail.ts` (a test keeps the two equal): every lien waiver a trade signs in
 * the portal waits on the owner's call 2 in portal-p5.md, the unconditional one and the conditional one a pay application
 * signs, and until then those kinds are refused as ones the page never sends.
 */
export const WAIVER_SIGN_LIVE = false

/** The kinds that sign a lien waiver (P5c-3b, P5c-3c-ii): held by `WAIVER_SIGN_LIVE`. */
export const WAIVER_KINDS: ReadonlySet<string> = new Set(['unconditional_waiver', 'pay_app', 'final_pay_app'])

/** Free-text writes a company may make in an hour (PORTAL_REAL_BUILD.md → The functions). */
export const TRADE_HOURLY_CAP = 10

export const TRADE_SUBMIT_KINDS = [
  'got_it',
  'set_lang',
  'add_person',
  'remove_person',
  'set_gets',
  'open_plans',
  'quote_day',
  'submit_quote',
  'confirm_quote',
  'answer_lines',
  'decline',
  'ask_question',
  // P4b-i: a charge agreed or disputed, and a change asked for (P4a's verbs).
  'answer_back_charge',
  'ask_change',
  // P2c-ii: the company signs its statement of work (P2c-i's verb).
  'sign_sow',
  // P5c-2: Building's punch list, submittals and questions while we build (U3b-i's, U4a's and U5a's verbs).
  'punch_fixed',
  'submittal_send',
  'rfi_ask',
  // P5c-3b: a line's percent reported, the unconditional waiver on a paid draw, and a change signed (U6a's verbs).
  'sow_report',
  'unconditional_waiver',
  'sign_change',
  // P5c-3c-ii: a pay application and the final one (U6a's and U6c's verbs), each signing its conditional waiver.
  'pay_app',
  'final_pay_app',
] as const

export type TradeSubmitKind = (typeof TRADE_SUBMIT_KINDS)[number]

/** The kinds that write a company's own words, under the hourly cap. The rest are clicks. */
export const FREE_TEXT_KINDS: ReadonlySet<TradeSubmitKind> = new Set<TradeSubmitKind>(['submit_quote', 'quote_day', 'add_person', 'ask_question', 'ask_change', 'submittal_send', 'rfi_ask'])

/** The function's own refusals. `consentNeeded`: a signature without the e-sign consent (P2c-ii), refused before any write. */
export const TRADE_FUNCTION_ERRORS = { badRequest: 400, linkOff: 404, spanishHeld: 400, tooMany: 429, consentNeeded: 400, failed: 500 } as const

/** The SQL's refusals (P2a's `gc_trade_<verb>`), raised as P0001 with the key as the message. */
export const TRADE_SQL_ERRORS = {
  notFound: 404,
  notYours: 409,
  projectLost: 409,
  youPassed: 409,
  openFirst: 409,
  alreadyQuoted: 409,
  noQuote: 409,
  nothingToAnswer: 409,
  dayPassed: 409,
  notOnTrade: 409,
  questionsClosed: 409,
  everyKindNeedsSomeone: 409,
  alreadyAnswered: 409,
  notAwarded: 409,
  // P2c-i's gc_trade_sign_sow. alreadySigned reads for any paper: U6's waiver and signed change raise it too.
  sowNotSent: 409,
  alreadySigned: 409,
  msaFirst: 409,
  // P5c-2: Building's punch list (U3b-i), submittals (U4a) and questions while we build (U5a). jobNotBuilding is raised by
  // every verb on a job we are building, the report's and the pay application's too (P5c-3).
  punchNotOpen: 409,
  notYourMove: 409,
  jobNotBuilding: 409,
  // P5c-3b: Building's U6a, the report and the unconditional waiver.
  sowNotSigned: 409,
  splitLine: 409,
  notPaidYet: 409,
  // P5c-3c-ii: a pay application with us already, nothing new to bill, and the final one sent or not open yet (U6c).
  drawWaiting: 409,
  nothingToBill: 409,
  finalSent: 409,
  finalNotYet: 409,
  fileNeeded: 400,
  amountNeeded: 400,
  answerEach: 400,
  sovMustAdd: 400,
  nameNeeded: 400,
  emailNeeded: 400,
  pickAKind: 400,
  questionNeeded: 400,
  tooLong: 400,
  noteNeeded: 400,
  descriptionNeeded: 400,
  badRequest: 400,
} as const

export type TradeSubmitErrorKey = keyof typeof TRADE_FUNCTION_ERRORS | keyof typeof TRADE_SQL_ERRORS

/** Every key the function can answer, for the words test. */
export const TRADE_SUBMIT_ERROR_KEYS = [...new Set([...Object.keys(TRADE_FUNCTION_ERRORS), ...Object.keys(TRADE_SQL_ERRORS)])] as TradeSubmitErrorKey[]

/** A refusal from the verb's call as the key and status the page reads. Anything unknown is `failed`, and logged. */
export function tradeErrorOf(error: { code?: string | null; message?: string | null } | null | undefined): { key: TradeSubmitErrorKey; status: number } {
  const message = error?.message ?? ''
  if (error?.code === 'P0001' && Object.prototype.hasOwnProperty.call(TRADE_SQL_ERRORS, message)) {
    const key = message as keyof typeof TRADE_SQL_ERRORS
    return { key, status: TRADE_SQL_ERRORS[key] }
  }
  return { key: 'failed', status: TRADE_FUNCTION_ERRORS.failed }
}

/** Over the cap: the company's free-text writes in the last hour, from each table that keeps them. */
export function overHourlyCap(counts: (number | null | undefined)[]): boolean {
  return counts.reduce<number>((sum, n) => sum + (n ?? 0), 0) >= TRADE_HOURLY_CAP
}

/** A real trade never fills the field its browser hides. */
export function isHoneypot(body: unknown): boolean {
  return isObject(body) && typeof body.website === 'string' && body.website.trim() !== ''
}

/** The verb to call and its fields, without `p_company_id`, which the function adds from the link. */
export interface TradeCall {
  rpc: string
  params: Record<string, unknown>
}

/**
 * A signature's part the function handles around the verb (P2c-ii): the drawn image it stores before the verb and
 * deletes if the verb refuses, or none for a typed one, and the e-sign consent words for the ledger row after, with the
 * paper it is keyed by and the printed name. The statement of work's row is `gc_sow`; since P5c-3b the unconditional
 * waiver's is `gc_draw`, keyed by the draw, and a change's is `gc_trade_change`, keyed by the change order; since P5c-3c-ii
 * a pay application's is `gc_draw` too, keyed by the draw its verb makes, and its printed name is who signs the G702.
 */
export interface TradeSignature {
  png: Uint8Array | null
  consent: Record<string, unknown>
  /** The paper the row is keyed by. A null id is the draw the verb makes and returns: a pay application (P5c-3c-ii). */
  record: { type: 'gc_sow' | 'gc_draw' | 'gc_trade_change'; id: string | null }
  printedName: string
}

export type TradeSubmitParsed =
  | { ok: true; token: string; kind: TradeSubmitKind; call: TradeCall; sign?: TradeSignature }
  | { ok: false; key?: 'consentNeeded' }

/** The most a drawn signature may weigh, as `accept-contract` holds it. */
export const SIGNATURE_PNG_MAX_BYTES = 512 * 1024

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** A drawn signature as the pad sends it (a data URL or bare base64), or null when it is not a PNG of a size we keep. */
export function signaturePngOf(v: string): Uint8Array | null {
  const raw = v.trim()
  const b64 = /^data:image\/png;base64,/i.test(raw) ? raw.slice(raw.indexOf(',') + 1) : raw.startsWith('data:') ? '' : raw
  if (b64 === '') return null
  let bytes: Uint8Array
  try {
    const bin = atob(b64)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch {
    return null
  }
  if (bytes.length > SIGNATURE_PNG_MAX_BYTES || bytes.length < PNG_MAGIC.length || PNG_MAGIC.some((m, i) => bytes[i] !== m)) return null
  return bytes
}

const MAIL_GROUPS = ['quotes', 'job', 'contracts', 'pay']
const CHANGE_REASONS = ['owner', 'field', 'plans']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HTTPS = /^https:\/\/\S+$/i
const YMD = /^\d{4}-\d{2}-\d{2}$/

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

class Bad extends Error {}

function uuid(v: unknown): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Bad()
  return v
}

function ymd(v: unknown): string {
  if (typeof v !== 'string' || !YMD.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Bad()
  return v
}

/** A text, trimmed, no longer than its cap. Missing reads empty. */
function text(v: unknown, max: number): string {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string' || v.trim().length > max) throw new Bad()
  return v.trim()
}

function num(v: unknown): number | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Bad()
  return v
}

function list(v: unknown, max: number): unknown[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v) || v.length > max) throw new Bad()
  return v
}

/**
 * A pay application as the window sends it (P5c-3c-ii): who signs it and where from, the last day it covers, and on a
 * new one each line's percent and its stored materials by the kernels' line ids. The SQL reads what the numbers mean;
 * a blank period or name reaches it, which says badRequest or nameNeeded.
 */
function payAppOf(v: unknown, withLines: boolean): Record<string, unknown> {
  if (!isObject(v)) throw new Bad()
  const periodTo = text(v.periodTo, 10)
  if (periodTo !== '') ymd(periodTo)
  const out: Record<string, unknown> = {
    periodTo,
    address: text(v.address, 300),
    license: text(v.license, 120),
    signedBy: text(v.signedBy, 200),
    signedTitle: text(v.signedTitle, 120),
  }
  if (withLines) {
    out.lines = list(v.lines, 200).map((l) => {
      if (!isObject(l)) throw new Bad()
      const toPct = num(l.toPct)
      const stored = num(l.stored)
      if (toPct === null || toPct < 0 || toPct > 100 || (stored !== null && stored < 0)) throw new Bad()
      return { line: uuid(l.line), toPct, ...(stored === null ? {} : { stored }) }
    })
  }
  return out
}

/** A Drive link the company types until P5a's upload: an https link, or none. */
function httpsOrNull(v: unknown): string | null {
  const t = text(v, 2000)
  if (t === '') return null
  if (!HTTPS.test(t)) throw new Bad()
  return t
}

/** The kinds of email, the known ones only, in the portal's order. */
function gets(v: unknown): string[] {
  const given = list(v, 8).map((g) => (typeof g === 'string' ? g : ''))
  return MAIL_GROUPS.filter((g) => given.includes(g))
}

function yesNoMap(v: unknown, max: number): Record<string, 'yes' | 'no'> {
  if (!isObject(v)) throw new Bad()
  const entries = Object.entries(v)
  if (entries.length > max) throw new Bad()
  const out: Record<string, 'yes' | 'no'> = {}
  for (const [k, value] of entries) {
    uuid(k)
    if (value !== 'yes' && value !== 'no') throw new Bad()
    out[k] = value
  }
  return out
}

function labelAmounts(v: unknown, max: number): { label: string; amount: number }[] {
  return list(v, max).map((line) => {
    if (!isObject(line)) throw new Bad()
    const amount = num(line.amount)
    if (amount === null) throw new Bad()
    return { label: text(line.label, 120), amount }
  })
}

/** The quote as the portal's form builds it; the SQL checks what the numbers mean. */
function quote(v: unknown): Record<string, unknown> {
  if (!isObject(v)) throw new Bad()
  const out: Record<string, unknown> = {
    amount: num(v.amount),
    includes: yesNoMap(v.includes ?? {}, 200),
    note: text(v.note, 2000),
    alternates: labelAmounts(v.alternates, 20),
  }
  const good = num(v.goodForDays)
  if (good !== null) out.goodForDays = good
  if (v.sov !== undefined && v.sov !== null) out.sov = labelAmounts(v.sov, 40)
  if (v.exclusions !== undefined && v.exclusions !== null) {
    out.exclusions = list(v.exclusions, 40).map((e) => {
      if (!isObject(e)) throw new Bad()
      const name = text(e.name, 120)
      if (name === '') throw new Bad()
      const row: Record<string, unknown> = { name }
      if (e.said !== undefined && e.said !== null) row.said = text(e.said, 200)
      if (e.unitPrice !== undefined && e.unitPrice !== null) {
        if (!isObject(e.unitPrice)) throw new Bad()
        const amount = num(e.unitPrice.amount)
        if (amount === null) throw new Bad()
        row.unitPrice = { amount, unit: text(e.unitPrice.unit, 40) }
      }
      return row
    })
  }
  if (v.exclusionsAnswered !== undefined && v.exclusionsAnswered !== null) out.exclusionsAnswered = list(v.exclusionsAnswered, 40).map((n) => text(n, 120))
  return out
}

function callOf(kind: TradeSubmitKind, b: Record<string, unknown>): TradeCall {
  switch (kind) {
    case 'got_it':
      return { rpc: 'gc_trade_got_it', params: {} }
    case 'set_lang':
      if (b.lang !== 'en' && b.lang !== 'es') throw new Bad()
      return { rpc: 'gc_trade_set_lang', params: { p_lang: b.lang } }
    case 'add_person':
      return { rpc: 'gc_trade_add_person', params: { p_name: text(b.name, 120), p_email: text(b.email, 254), p_role: text(b.role, 80), p_gets: gets(b.gets) } }
    case 'remove_person':
      return { rpc: 'gc_trade_remove_person', params: { p_person_id: uuid(b.personId) } }
    case 'set_gets':
      return { rpc: 'gc_trade_set_gets', params: { p_person_id: b.personId === null || b.personId === undefined ? null : uuid(b.personId), p_gets: gets(b.gets) } }
    case 'open_plans':
      return { rpc: 'gc_trade_open_plans', params: { p_invite_id: uuid(b.inviteId) } }
    case 'quote_day':
      return { rpc: 'gc_trade_quote_day', params: { p_invite_id: uuid(b.inviteId), p_by: ymd(b.by) } }
    case 'submit_quote':
      return { rpc: 'gc_trade_submit_quote', params: { p_invite_id: uuid(b.inviteId), q: quote(b.quote) } }
    case 'confirm_quote':
      return { rpc: 'gc_trade_confirm_quote', params: { p_invite_id: uuid(b.inviteId) } }
    case 'answer_lines':
      return { rpc: 'gc_trade_answer_lines', params: { p_invite_id: uuid(b.inviteId), p_answers: yesNoMap(b.answers, 200) } }
    case 'decline':
      return { rpc: 'gc_trade_decline', params: { p_invite_id: uuid(b.inviteId) } }
    case 'ask_question':
      return {
        rpc: 'gc_trade_ask_question',
        params: { p_package_id: uuid(b.packageId), p_text: text(b.text, 2000), p_sheets: list(b.sheets, 20).map((s) => text(s, 20)).filter((s) => s !== '') },
      }
    case 'answer_back_charge':
      if (typeof b.agree !== 'boolean') throw new Bad()
      return { rpc: 'gc_trade_answer_back_charge', params: { p_charge_id: uuid(b.chargeId), p_agree: b.agree, p_note: text(b.note, 2000) } }
    case 'ask_change': {
      // The SQL says what a missing amount or a blank description means; a fourth reason or part of a day is not the form's.
      if (typeof b.reason !== 'string' || !CHANGE_REASONS.includes(b.reason)) throw new Bad()
      const days = num(b.days) ?? 0
      if (!Number.isInteger(days)) throw new Bad()
      return {
        rpc: 'gc_trade_ask_change',
        params: { p_package_id: uuid(b.packageId), p_description: text(b.description, 2000), p_reason: b.reason, p_amount: num(b.amount), p_days: days },
      }
    }
    case 'punch_fixed':
      return { rpc: 'gc_trade_punch_fixed', params: { p_item_id: uuid(b.itemId) } }
    case 'submittal_send':
      // A blank file name reaches the SQL, which says fileNeeded in the company's words.
      return {
        rpc: 'gc_trade_submittal_send',
        params: { p_submittal_id: uuid(b.submittalId), p_file_name: text(b.fileName, 200), p_drive_url: httpsOrNull(b.driveUrl), p_note: text(b.note, 2000) },
      }
    case 'rfi_ask':
      return {
        rpc: 'gc_trade_rfi_ask',
        params: { p_package_id: uuid(b.packageId), p_question: text(b.question, 2000), p_sheets: list(b.sheets, 20).map((x) => text(x, 20)).filter((x) => x !== '') },
      }
    case 'sow_report': {
      // The SQL holds the percent at what was billed already; a percent past 0 to 100 is not the picker's.
      const pct = num(b.pct)
      if (pct === null || pct < 0 || pct > 100) throw new Bad()
      return { rpc: 'gc_trade_sow_report', params: { p_package_id: uuid(b.packageId), p_line: uuid(b.line), p_pct: pct } }
    }
    case 'unconditional_waiver':
      return { rpc: 'gc_trade_unconditional_waiver', params: { p_draw_id: uuid(b.drawId) } }
    case 'sign_change':
      return { rpc: 'gc_trade_sign_change', params: { p_change_order_id: uuid(b.changeOrderId) } }
    case 'pay_app':
      return { rpc: 'gc_trade_pay_app', params: { p_package_id: uuid(b.packageId), p_app: payAppOf(b.app, true) } }
    case 'final_pay_app':
      return { rpc: 'gc_trade_final_pay_app', params: { p_package_id: uuid(b.packageId), p_app: payAppOf(b.app, false) } }
    case 'sign_sow':
      // The function fills the image's path, the IP and the browser from what it stored and the request.
      return { rpc: 'gc_trade_sign_sow', params: { p_sow_id: uuid(b.sowId), p_printed_name: text(b.printedName, 200), p_signature_path: null, p_ip: null, p_user_agent: null } }
  }
}

/** The kinds that sign a paper, and what each signature's ledger row is keyed by. */
const SIGNED: Partial<Record<TradeSubmitKind, (call: TradeCall) => TradeSignature['record']>> = {
  sign_sow: (call) => ({ type: 'gc_sow', id: String(call.params.p_sow_id) }),
  unconditional_waiver: (call) => ({ type: 'gc_draw', id: String(call.params.p_draw_id) }),
  sign_change: (call) => ({ type: 'gc_trade_change', id: String(call.params.p_change_order_id) }),
  pay_app: () => ({ type: 'gc_draw', id: null }),
  final_pay_app: () => ({ type: 'gc_draw', id: null }),
}

/**
 * A signature's image and consent (P2c-ii). The consent is required, as `sign-owner-records` requires it: without it the
 * press is refused with consentNeeded. The function reads its words again with `parseEsignConsent` for the ledger row.
 * An image that is not a PNG we keep is a shape the portal never sends. The waiver and a change (P5c-3b) are typed only,
 * since their verbs keep no image, and their name is required here because the verb never reads it; the statement of
 * work's blank name reaches its verb, which says nameNeeded. A pay application (P5c-3c-ii) is typed too, and its printed
 * name is the G702's signer, whose blank its verb refuses the same way.
 */
function signatureOf(kind: TradeSubmitKind, b: Record<string, unknown>, record: TradeSignature['record']): TradeSignature | 'consentNeeded' {
  const raw = b.signaturePngBase64
  let png: Uint8Array | null = null
  if (raw !== undefined && raw !== null && raw !== '') {
    if (typeof raw !== 'string' || kind !== 'sign_sow') throw new Bad()
    png = signaturePngOf(raw)
    if (!png) throw new Bad()
  }
  const payApp = kind === 'pay_app' || kind === 'final_pay_app'
  const printedName = text(payApp ? (isObject(b.app) ? b.app.signedBy : '') : b.printedName, 200)
  if ((kind === 'unconditional_waiver' || kind === 'sign_change') && printedName === '') throw new Bad()
  const consent = b.esignConsent
  if (!isObject(consent) || typeof consent.clauseText !== 'string' || consent.clauseText.trim() === '') return 'consentNeeded'
  return { png, consent, record, printedName }
}

/** The request read: its token, its kind and the verb's call, or not a shape the portal sends. */
export function parseTradeSubmit(body: unknown): TradeSubmitParsed {
  if (!isObject(body)) return { ok: false }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const kind = body.kind
  if (token === '' || typeof kind !== 'string' || !(TRADE_SUBMIT_KINDS as readonly string[]).includes(kind)) return { ok: false }
  try {
    const k = kind as TradeSubmitKind
    const call = callOf(k, body)
    const record = SIGNED[k]
    if (!record) return { ok: true, token, kind: k, call }
    const sign = signatureOf(k, body, record(call))
    return sign === 'consentNeeded' ? { ok: false, key: 'consentNeeded' } : { ok: true, token, kind: k, call, sign }
  } catch (e) {
    if (e instanceof Bad) return { ok: false }
    throw e
  }
}

/** A kind that signs a lien waiver while the owner's call holds them (`WAIVER_SIGN_LIVE`). */
export function waiverHeld(kind: TradeSubmitKind): boolean {
  return !WAIVER_SIGN_LIVE && WAIVER_KINDS.has(kind)
}

/** A Spanish choice while Spanish is held (decision 8). */
export function spanishHeld(call: TradeCall): boolean {
  return !PORTAL_SPANISH_ON && call.rpc === 'gc_trade_set_lang' && call.params.p_lang === 'es'
}
