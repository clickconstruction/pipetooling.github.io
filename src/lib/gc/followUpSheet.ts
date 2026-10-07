/**
 * GC mode, the real build: how to reach a company, moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcFollowUpSheet.ts`) by the schedule's PR 1b, which reads it. The Building lane's lift (U2) adds the rest of `gcFollowUpSheet.ts` here.
 */
import type { Partner, TradePromise } from './types'
import type { PortalLang } from './portalI18n'

export interface PartnerReach {
  /** "Greg Paulk". */
  name: string
  first: string
  phone: string
  email: string
  /** True when the record has none and a made-up one stands in. */
  madeUp: boolean
}

/** The person to reach at a company. A 555-01xx number and an .example address stand in where the record has none. */
export function partnerReach(partner: Partner): PartnerReach {
  const name = partner.contact || partner.company
  const first = name.split(/\s+/)[0] ?? name
  let h = 2166136261
  for (const c of partner.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const phone = partner.phone ?? `(210) 555-01${String(h % 100).padStart(2, '0')}`
  const slug = partner.company.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const email = partner.email ?? `${first.toLowerCase().replace(/[^a-z]/g, '')}@${slug}.example`
  return { name, first, phone, email, madeUp: !partner.phone || !partner.email }
}

export type FollowItemKind =
  | 'quote'
  | 'promise'
  | 'insurance'
  | 'waiver'
  | 'w9'
  | 'sow'
  // One job's list from the board's Who to call card (Board, 2026-10-04): the newest set not
  // opened, questions waiting on the architect, our bid waiting on the customer.
  | 'plans'
  | 'answer'
  | 'decision'
  // A change order waiting on the customer's signature (Board, 2026-10-04).
  | 'signature'
  // A customer's bill past its due day (Board, 2026-10-04, on Owner Billing's reminder).
  | 'payment'
  // A reason from a job's schedule, from the Gantt's call list (G-115): late work, new dates, what holds a bar.
  | 'schedule'

/** One thing a person owes us, with the words a message uses for it in each language. */
export interface FollowItem {
  key: string
  kind: FollowItemKind
  /** "Sitework quote · Boerne Retail Shell". */
  label: string
  /** Why now, in the office's words. */
  why: string
  tone: 'red' | 'amber'
  /** The last thing logged about it. Null: nothing yet. */
  last: string | null
  /** Counted on Follow up's badge, so ticked at first. False: also owed, unticked. */
  due: boolean
  /** A quote's ask, to log the contact on. */
  ask?: { projectId: string; packageId: string; inviteId: string }
  /** The job and trade a paper is for. */
  projectId?: string
  packageId?: string
  /** A promise already made about it. */
  promise?: TradePromise
  /** A quote's bid day, for "Our bid is due …". */
  bidDue?: string
  words: Record<PortalLang, { about: string; detail: string; ask: string }>
  /** A `schedule` item's place on the schedule, for what the call's answer does (`callListCallActions`, G-115). */
  schedule?: FollowScheduleRef
}

/** Where a `schedule` item sits: what kind of reason, the bar, and the move, the wait or the trade it is about. */
export interface FollowScheduleRef {
  kind: string
  /** A held bar's hold, as the chart has it. */
  hold?: string
  lineId?: string
  packageId?: string
  moveId?: string
  waitId?: string
}

export interface FollowPerson {
  partner: Partner
  reach: PartnerReach
  /** What the badge counts first, then what else they owe. */
  items: FollowItem[]
}

export interface DraftChoice {
  /** Me: in my name, from my phone or mail. The company: from Click, email only for now. */
  from: 'me' | 'company'
  via: 'text' | 'email'
  /** A quick nudge, or a full note with every detail. */
  length: 'nudge' | 'note'
}

/** `sms:` for texting from my phone, the text filled in. */
export function smsHref(phone: string, body: string): string {
  return `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(body)}`
}

/** `mailto:` for emailing from my own mail, subject and body filled in. */
export function mailHref(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** How many people and things the sheet holds: the badge's count. */
export function followUpCount(people: FollowPerson[]): number {
  return people.reduce((n, p) => n + p.items.filter((i) => i.due).length, 0)
}
