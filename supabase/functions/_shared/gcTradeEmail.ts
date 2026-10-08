/**
 * GC mode, every email to a trade partner (P3-a of the trade partner portal, plan `to-dos/gc-mode/mockups/portal-p3.md`
 * on branch spike/gc-mode): what `gc-trade-email` reads from a request, who at the company gets it, and the email
 * itself. Pure, so the function, What customers see's sample and the tests read the same rules
 * (`src/lib/gc/gcTradeEmail.test.ts`). The kind's group and the recipients are copies of `portalMailGroup` and
 * `mailRecipients` in `src/lib/gc/portal.ts`, and the words are copies of `portalI18n.ts`'s, because the edge functions
 * cannot import `src`; the test holds each copy to its original on the same records.
 */
import { PORTAL_SPANISH_ON } from './gcTradeSubmit.ts'

/** The portal's message kinds (`PortalMessage['kind']`), and `paper` for a paper sent from the company window. */
export const TRADE_EMAIL_KINDS = [
  'invite',
  'nudge',
  'plans',
  'bidTab',
  'msa',
  'sow',
  'start',
  'less',
  'change',
  'paid',
  'answer',
  'coi',
  'closed',
  'vetted',
  'preBid',
  'changeAsk',
  'backCharge',
  'dates',
  'startSoon',
  'paper',
] as const

export type TradeEmailKind = (typeof TRADE_EMAIL_KINDS)[number]

export type TradeMailGroup = 'quotes' | 'job' | 'contracts' | 'pay'

export const TRADE_MAIL_GROUPS: readonly TradeMailGroup[] = ['quotes', 'job', 'contracts', 'pay']

/** Copy of `KIND_GROUP` in `portal.ts`: the kind of email each message is, for who at the company gets it. */
const KIND_GROUP: Record<Exclude<TradeEmailKind, 'paper'>, TradeMailGroup> = {
  dates: 'job',
  startSoon: 'job',
  invite: 'quotes',
  nudge: 'quotes',
  bidTab: 'quotes',
  closed: 'quotes',
  preBid: 'quotes',
  plans: 'quotes',
  answer: 'quotes',
  start: 'job',
  msa: 'contracts',
  sow: 'contracts',
  change: 'contracts',
  changeAsk: 'contracts',
  vetted: 'contracts',
  paid: 'pay',
  less: 'pay',
  coi: 'pay',
  backCharge: 'pay',
}

/**
 * Who may send: a dev until the portal's door, then the office roles of `gc_office_team()`. The client's copy is
 * `GC_TRADE_EMAIL_TEAM` in `src/lib/gc/access.ts`, and `access.test.ts` fails when the two differ.
 */
export const GC_TRADE_EMAIL_ROLES: readonly string[] = ['dev']

/** The name the email comes from, on `EMAIL_FROM`'s address. Copy of `GC_COMPANY.name` in `src/lib/gc/company.ts`. */
export const GC_TRADE_EMAIL_FROM_NAME = 'Click Construction'

/** Each refusal and its status. The office says each in its own words (`gcTradeEmailRefusal` in `src/lib/gc/tradeEmail.ts`). */
export const TRADE_EMAIL_ERRORS = {
  badRequest: 400,
  spanishHeld: 400,
  signIn: 401,
  officeOnly: 403,
  readOnly: 403,
  notFound: 404,
  notOnProject: 409,
  noEmail: 422,
  sendFailed: 502,
  failed: 500,
} as const

export type TradeEmailErrorKey = keyof typeof TRADE_EMAIL_ERRORS

/** One line of an email: a paragraph, or a list under its title. The portal's Messages read the same shape (`SentLine`). */
export type TradeEmailLine = string | { title?: string; items: string[] }

/** What a lane sends: the company, the kind, the dedupe key, the project or null, the language and the words. */
export interface TradeEmailRequest {
  companyId: string
  kind: TradeEmailKind
  /** Unique per company: a key is sent once. An invitation's is `<invite id>:invite`. */
  key: string
  /** Null: about the company, not one project (the master agreement, a paper). */
  projectId: string | null
  lang: 'en' | 'es'
  subject: string
  /** The email's lines without the greeting, trimmed, with the empty ones dropped. */
  lines: TradeEmailLine[]
  /** Only for `paper`: a contract, or pay and papers. Every other kind takes its group from the kind. */
  group: TradeMailGroup | null
}

export const TRADE_EMAIL_LIMITS = { key: 200, subject: 200, lines: 40, line: 2000, items: 100 } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class Bad extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function text(v: unknown, max: number, required: boolean): string {
  if (v === undefined || v === null) {
    if (required) throw new Bad()
    return ''
  }
  if (typeof v !== 'string') throw new Bad()
  const s = v.trim()
  if (s.length > max || (required && s === '')) throw new Bad()
  return s
}

function lineOf(v: unknown): TradeEmailLine | null {
  if (typeof v === 'string') return text(v, TRADE_EMAIL_LIMITS.line, false) || null
  if (!isObject(v) || !Array.isArray(v.items) || v.items.length > TRADE_EMAIL_LIMITS.items) throw new Bad()
  const items = v.items.map((i) => text(i, TRADE_EMAIL_LIMITS.line, false)).filter((i) => i !== '')
  const title = text(v.title, TRADE_EMAIL_LIMITS.line, false)
  if (items.length === 0) return null
  return title ? { title, items } : { items }
}

/** A request `gc-trade-email` can read, or not: the first check after the caller. Anything off is `badRequest`. */
export function parseTradeEmail(body: unknown): { ok: true; req: TradeEmailRequest } | { ok: false } {
  try {
    if (!isObject(body)) throw new Bad()
    const companyId = text(body.companyId, 36, true)
    if (!UUID.test(companyId)) throw new Bad()
    const kind = body.kind
    if (typeof kind !== 'string' || !(TRADE_EMAIL_KINDS as readonly string[]).includes(kind)) throw new Bad()
    const key = text(body.key, TRADE_EMAIL_LIMITS.key, true)
    const projectId = body.projectId === undefined || body.projectId === null ? null : text(body.projectId, 36, true)
    if (projectId !== null && !UUID.test(projectId)) throw new Bad()
    if (body.lang !== 'en' && body.lang !== 'es') throw new Bad()
    const subject = text(body.subject, TRADE_EMAIL_LIMITS.subject, true)
    if (!Array.isArray(body.lines) || body.lines.length > TRADE_EMAIL_LIMITS.lines) throw new Bad()
    const lines = body.lines.map(lineOf).filter((l): l is TradeEmailLine => l !== null)
    if (lines.length === 0) throw new Bad()
    const raw = body.group === undefined ? null : body.group
    let group: TradeMailGroup | null = null
    if (kind === 'paper') {
      if (raw !== 'contracts' && raw !== 'pay') throw new Bad()
      group = raw
    } else if (raw !== null) throw new Bad()
    return { ok: true, req: { companyId, kind: kind as TradeEmailKind, key, projectId, lang: body.lang, subject, lines, group } }
  } catch (e) {
    if (e instanceof Bad) return { ok: false }
    throw e
  }
}

/** Spanish is held (decision 8): `es` is refused until `PORTAL_SPANISH_ON` turns on. */
export function spanishHeld(req: Pick<TradeEmailRequest, 'lang'>): boolean {
  return !PORTAL_SPANISH_ON && req.lang === 'es'
}

/** A project past bidding by its row's stage (`gc_projects.stage`): ours to build. The portal's `stageOf` reads it the same. */
export function pastBidding(stage: string | null | undefined): boolean {
  return stage === 'buyout' || stage === 'building' || stage === 'closed'
}

/**
 * The kind of email a message is (`portalMailGroup`): plans and answers on a job that is ours go to the job's people,
 * a paper says its own group, and the rest follow the kind.
 */
export function tradeEmailGroup(kind: TradeEmailKind, projectStage: string | null | undefined, group: TradeMailGroup | null): TradeMailGroup {
  if (kind === 'paper') return group ?? 'pay'
  if ((kind === 'plans' || kind === 'answer') && pastBidding(projectStage)) return 'job'
  return KIND_GROUP[kind]
}

/** The company's row as the function reads it: the main contact and the kinds it gets (null: every kind). */
export interface TradeMailCompany {
  contact_name: string | null
  email: string | null
  contact_gets: string[] | null
}

/** A person the company named in its portal, not taken off. */
export interface TradeMailPerson {
  name: string | null
  email: string | null
  gets: string[] | null
}

export interface TradeRecipient {
  name: string
  email: string | null
  main: boolean
}

const cleanEmail = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

/** Who gets one kind of email (`mailRecipients`): the main contact when it gets the kind, then each person ticked for it. Never empty. */
export function tradeEmailRecipients(company: TradeMailCompany, people: TradeMailPerson[], group: TradeMailGroup): TradeRecipient[] {
  const main: TradeRecipient = { name: (company.contact_name ?? '').trim(), email: cleanEmail(company.email), main: true }
  const mainGets = company.contact_gets ?? TRADE_MAIL_GROUPS
  const others = people.filter((p) => (p.gets ?? []).includes(group)).map((p) => ({ name: (p.name ?? '').trim(), email: cleanEmail(p.email), main: false }))
  const to = [...(mainGets.includes(group) ? [main] : []), ...others]
  return to.length > 0 ? to : [main]
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The recipients the email can reach: anyone without an email is skipped, and one address gets it once. Empty is `noEmail`. */
export function tradeEmailReach(recipients: TradeRecipient[]): { name: string; email: string }[] {
  const out: { name: string; email: string }[] = []
  for (const r of recipients) {
    if (!r.email || !EMAIL_SHAPE.test(r.email)) continue
    if (out.some((x) => x.email.toLowerCase() === r.email!.toLowerCase())) continue
    out.push({ name: r.name, email: r.email })
  }
  return out
}

/** Copies of `portalI18n.ts`'s words, the frame's only words. The test holds each equal. */
export const TRADE_EMAIL_WORDS = {
  mHello: { en: 'Hello {first},', es: 'Hola {first}:' },
  and: { en: ' and ', es: ' y ' },
  openPortal: { en: 'Open your portal', es: 'Abrir su portal' },
  linkYours: { en: 'This link is yours. It holds every job you have with us. There is no password.', es: 'Este enlace es suyo. Aquí están todos sus trabajos con nosotros. No hay contraseña.' },
  thanks: { en: 'Thank you,', es: 'Gracias,' },
} as const

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/** "Hello Dana,", "Hello Marcus and Dana,", "Hello Marcus, Ana and Dana,". With no names, the company's. */
export function tradeGreeting(lang: 'en' | 'es', names: string[], company: string): string {
  const firsts = names.map(firstName).filter((n) => n !== '')
  const and = TRADE_EMAIL_WORDS.and[lang]
  const who = firsts.length === 0 ? company.trim() : firsts.length === 1 ? firsts[0]! : `${firsts.slice(0, -1).join(', ')}${and}${firsts[firsts.length - 1]}`
  return TRADE_EMAIL_WORDS.mHello[lang].split('{first}').join(who)
}

/** The company's portal address: `<origin>/t/<token>`. */
export function tradePortalLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/t/${encodeURIComponent(token)}`
}

/** A new link's token, as `mint_gc_trade_portal_link` makes it: two uuids without their dashes, 64 hex characters. */
export function newTradeToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
}

export interface GcTradeEmailInput {
  lang: 'en' | 'es'
  /** The names it goes to, the main contact first: the greeting reads their first names. */
  recipients: string[]
  /** The company's name, for a greeting with no names. */
  company: string
  subject: string
  lines: TradeEmailLine[]
  /** The company's portal address. */
  linkUrl: string
  /** The project manager, else the sender. */
  signer: string
  /** Our company's name. */
  gc: string
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The portal's paper (`src/lib/portal/portalTheme.ts`): ink on paper, so the email and the page look like one thing.
const INK = '#16283c'
const PAPER = '#f6f3ec'
const MUTED = '#5a6b7e'
const HAIR = '#ddd6c8'
const FONT = `-apple-system, 'Segoe UI', Roboto, sans-serif`

/** The email a trade partner reads: the greeting, the lines, the button to its portal, then who it is from. */
export function buildGcTradeEmail(input: GcTradeEmailInput): { subject: string; text: string; html: string } {
  const w = (key: keyof typeof TRADE_EMAIL_WORDS) => TRADE_EMAIL_WORDS[key][input.lang]
  const greeting = tradeGreeting(input.lang, input.recipients, input.company)
  const subject = input.subject.trim()

  const textLines: string[] = [greeting, '']
  for (const line of input.lines) {
    if (typeof line === 'string') textLines.push(line, '')
    else textLines.push(...(line.title ? [line.title] : []), ...line.items.map((i) => `- ${i}`), '')
  }
  textLines.push(`${w('openPortal')}: ${input.linkUrl}`, '', w('linkYours'), '', w('thanks'), input.signer, input.gc)
  const text = textLines.join('\n')

  const p = (s: string, style = '') => `<p style="margin:0 0 12px;${style}">${esc(s)}</p>`
  const body = input.lines
    .map((line) =>
      typeof line === 'string'
        ? p(line)
        : `${line.title ? `<p style="margin:0 0 4px">${esc(line.title)}</p>` : ''}<ul style="margin:0 0 12px;padding-left:20px">${line.items.map((i) => `<li style="margin:0 0 2px">${esc(i)}</li>`).join('')}</ul>`,
    )
    .join('')
  const url = esc(input.linkUrl)
  const button =
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0 6px"><tr><td style="background:${INK};border-radius:6px">` +
    `<a href="${url}" style="display:inline-block;padding:10px 18px;color:${PAPER};font-weight:600;text-decoration:none">${esc(w('openPortal'))}</a>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 14px;font-size:12px;color:${MUTED};word-break:break-all">${url}</p>`
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#ffffff">` +
    `<div style="max-width:560px;margin:0 auto;padding:16px;font-family:${FONT}">` +
    `<div style="background:${PAPER};color:${INK};border:1px solid ${INK};border-radius:10px;overflow:hidden">` +
    `<div style="background:${INK};color:${PAPER};padding:10px 16px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase">${esc(input.gc)}</div>` +
    `<div style="padding:16px;font-size:15px;line-height:1.5">` +
    p(greeting) +
    body +
    button +
    `<p style="margin:0 0 14px;padding-top:10px;border-top:1px solid ${HAIR};font-size:13px;color:${MUTED}">${esc(w('linkYours'))}</p>` +
    `<p style="margin:0">${esc(w('thanks'))}<br>${esc(input.signer)}<br>${esc(input.gc)}</p>` +
    `</div></div></div></body></html>`
  return { subject, text, html }
}
