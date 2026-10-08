/**
 * GC mode, the trade partner portal's writes (P2b-i, to-dos/gc-mode/mockups/portal-p2b.md): the rules
 * `submit-gc-trade-portal` applies before it calls a `gc_trade_<verb>` (P2a). Pure, with no Deno or browser API,
 * so `src/lib/gc/gcTradeSubmit.test.ts` holds them:
 *   - the shape of each kind, read into the verb's call (the company is added by the function, from the link);
 *   - the hourly cap on free-text writes;
 *   - the refusal keys, each with its status, as the page says them in the company's language (decision 11);
 *   - Spanish's hold, copied from `src/lib/gc/portalI18n.ts` (a test keeps the two equal).
 */

/** Copy of `PORTAL_SPANISH_ON` in `src/lib/gc/portalI18n.ts`: the edge functions cannot import `src`. */
export const PORTAL_SPANISH_ON = false

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
] as const

export type TradeSubmitKind = (typeof TRADE_SUBMIT_KINDS)[number]

/** The kinds that write a company's own words, under the hourly cap. The rest are clicks. */
export const FREE_TEXT_KINDS: ReadonlySet<TradeSubmitKind> = new Set<TradeSubmitKind>(['submit_quote', 'quote_day', 'add_person', 'ask_question'])

/** The function's own refusals. */
export const TRADE_FUNCTION_ERRORS = { badRequest: 400, linkOff: 404, spanishHeld: 400, tooMany: 429, failed: 500 } as const

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
  amountNeeded: 400,
  answerEach: 400,
  sovMustAdd: 400,
  nameNeeded: 400,
  emailNeeded: 400,
  pickAKind: 400,
  questionNeeded: 400,
  tooLong: 400,
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

export type TradeSubmitParsed = { ok: true; token: string; kind: TradeSubmitKind; call: TradeCall } | { ok: false }

const MAIL_GROUPS = ['quotes', 'job', 'contracts', 'pay']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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
  }
}

/** The request read: its token, its kind and the verb's call, or not a shape the portal sends. */
export function parseTradeSubmit(body: unknown): TradeSubmitParsed {
  if (!isObject(body)) return { ok: false }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const kind = body.kind
  if (token === '' || typeof kind !== 'string' || !(TRADE_SUBMIT_KINDS as readonly string[]).includes(kind)) return { ok: false }
  try {
    return { ok: true, token, kind: kind as TradeSubmitKind, call: callOf(kind as TradeSubmitKind, body) }
  } catch (e) {
    if (e instanceof Bad) return { ok: false }
    throw e
  }
}

/** A Spanish choice while Spanish is held (decision 8). */
export function spanishHeld(call: TradeCall): boolean {
  return !PORTAL_SPANISH_ON && call.rpc === 'gc_trade_set_lang' && call.params.p_lang === 'es'
}
