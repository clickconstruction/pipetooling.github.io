/**
 * Punch list #205, row 2 (PR 5): the trade partner's thread on its portal's Messages tab, the customer's
 * (`src/lib/portal/portalThread.ts`) in the portal's own words. The lines are `gc-trade-portal`'s `thread`, already held
 * to what the company may read (`_shared/gcTradeThread.ts`), merged with the emails we sent it (`sentMessages`, each as
 * one of our email lines: the subject, then its lines), oldest first, a long one cut at a word with **More**. Pure.
 */
import type { PortalThreadLine } from '../../../supabase/functions/_shared/gcTradeThread'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { GC_COMPANY } from './company'
import { pt, pWeekday, type PortalLang } from './portalI18n'
import type { SentMessage } from './tradePortalPage'
import type { GcProject } from './types'

export type { PortalThreadLine }

const DIRS: ReadonlySet<string> = new Set(['in', 'out'])
const DOORS: ReadonlySet<string> = new Set(['portal', 'text', 'email'])

/** The answer's `thread`, a bad line dropped; null when the answer has none (an older function, or a read that failed). */
export function parseTradeThread(raw: unknown): PortalThreadLine[] | null {
  if (!Array.isArray(raw)) return null
  return raw.flatMap((x): PortalThreadLine[] => {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null
    if (!o || typeof o.id !== 'string' || typeof o.at !== 'string' || typeof o.body !== 'string') return []
    if (typeof o.dir !== 'string' || !DIRS.has(o.dir) || typeof o.door !== 'string' || !DOORS.has(o.door)) return []
    return [
      {
        id: o.id,
        at: o.at,
        dir: o.dir as PortalThreadLine['dir'],
        door: o.door as PortalThreadLine['door'],
        who: typeof o.who === 'string' && o.who.trim() ? o.who.trim() : null,
        subject: typeof o.subject === 'string' && o.subject.trim() ? o.subject.trim() : null,
        body: o.body,
      },
    ]
  })
}

/** The longest a line reads on the tab before it is cut at a word, with More to read the rest. */
export const TRADE_LINE_CUT = 240

/** A line as the tab draws it. */
export interface TradeThreadRow {
  id: string
  /** The company's own line. */
  mine: boolean
  /** The line whole. */
  text: string
  /** The line cut at a word when it runs past `TRADE_LINE_CUT`; else the line whole. */
  short: string
  /** "You · Thu Oct 8 · from the portal" / "Jordan · Thu Oct 8 · by text". */
  small: string
  /** The instant it went, for the order. */
  at: string
}

function cut(text: string): string {
  return text.length > TRADE_LINE_CUT ? `${text.slice(0, TRADE_LINE_CUT).replace(/\s+\S*$/, '')}…` : text
}

const DOOR = { portal: 'threadHere', text: 'threadText', email: 'threadEmail' } as const

/** A sent email's words as one line: the subject, then each paragraph, a titled list as its title and its items. */
export function sentMessageText(m: SentMessage): string {
  const lines = m.lines.flatMap((l) => (typeof l === 'string' ? [l] : [...(l.title ? [l.title] : []), ...l.items.map((i) => `• ${i}`)]))
  return [m.subject, ...lines].filter((s) => s.trim() !== '').join('\n')
}

/** A sent email as a line of the thread: ours, by email, at the instant it went (its day at noon when the instant is unknown). */
export function sentMessageLine(m: SentMessage): PortalThreadLine {
  return { id: `sent:${m.id}`, at: m.at ?? `${m.on}T12:00:00Z`, dir: 'out', door: 'email', who: null, subject: m.subject, body: m.lines.length > 0 ? sentMessageText({ ...m, subject: '' }).replace(/^\n/, '') : '' }
}

/**
 * The thread's lines and the emails we sent, as one list oldest first. An email already in the thread (ours, by email,
 * the same subject on the same day) is not added twice.
 */
export function mergedThread(lines: readonly PortalThreadLine[], sent: readonly SentMessage[]): PortalThreadLine[] {
  const dayOf = (at: string) => calendarYmdInAppTzFromIso(at) || at.slice(0, 10)
  const seen = new Set(lines.filter((l) => l.dir === 'out' && l.door === 'email' && l.subject).map((l) => `${l.subject}|${dayOf(l.at)}`))
  const extra = sent.map(sentMessageLine).filter((l) => !seen.has(`${l.subject}|${dayOf(l.at)}`))
  return [...lines, ...extra].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
}

/** Each line, oldest first, in the company's language. Ours names its writer, else our company. */
export function tradeThreadRows(lang: PortalLang, lines: readonly PortalThreadLine[]): TradeThreadRow[] {
  return lines.map((l) => {
    const day = calendarYmdInAppTzFromIso(l.at) || l.at.slice(0, 10)
    const who = l.dir === 'in' ? pt(lang, 'threadYou') : (l.who ?? GC_COMPANY.shortName)
    const text = l.subject ? (l.body ? `${l.subject}\n${l.body}` : l.subject) : l.body
    return { id: l.id, mine: l.dir === 'in', text, short: cut(text), small: `${who} · ${pWeekday(lang, day)} · ${pt(lang, DOOR[l.door])}`, at: l.at }
  })
}

/** Who to call for something urgent on site: the superintendent, else the project manager, else our company. */
export function urgentName(projects: readonly Pick<GcProject, 'team'>[]): string {
  const team = projects.flatMap((p) => p.team ?? [])
  return team.find((c) => c.role === 'superintendent')?.name ?? team.find((c) => c.role === 'projectManager')?.name ?? GC_COMPANY.shortName
}

/** The jobs the box can be about (punch list #205, PR 5): the company's projects not lost, each by name. */
export function threadJobs(projects: readonly Pick<GcProject, 'id' | 'name' | 'lostOn'>[]): { id: string; name: string }[] {
  return projects.filter((p) => !p.lostOn).map((p) => ({ id: p.id, name: p.name }))
}
