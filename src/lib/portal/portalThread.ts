/**
 * Messages, cut 8e: the customer's thread on their page's Messages tab (the prototype's `portalMessagesHtml`, v1.178).
 * The same conversation as their texts and emails with us: each line theirs or ours, with who, the day and how it came
 * (here, by text, by email), a long one cut at a word. The lines are `customer-portal`'s `thread`, already held to what
 * they may read (`_shared/gcPortalThread.ts`). Pure.
 */
import type { PortalThreadLine } from '../../../supabase/functions/_shared/gcPortalThread'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { CODE_WORDS, pWeekday, type PageWords, type PortalLang } from './pageWords'
import type { PortalGcPage } from './customerPage'

export type { PortalThreadLine }

const DIRS: ReadonlySet<string> = new Set(['in', 'out'])
const DOORS: ReadonlySet<string> = new Set(['portal', 'text', 'email'])

/** The answer's `thread`, a bad line dropped; null when the answer has none (an older function, or no page). */
export function parsePortalThread(raw: unknown): PortalThreadLine[] | null {
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

/** The longest a line reads on the page before it is cut at a word. */
export const LINE_CUT = 240

/** A line as the tab draws it. */
export interface ThreadRow {
  id: string
  mine: boolean
  text: string
  /** "You · Thu Oct 8 · here" / "Wendi · Thu Oct 8 · by text". */
  small: string
}

function cut(text: string): string {
  return text.length > LINE_CUT ? `${text.slice(0, LINE_CUT).replace(/\s+\S*$/, '')}…` : text
}

const DOOR = { portal: 'doorHere', text: 'doorText', email: 'doorEmail' } as const

/** Each line, oldest first, in their language. Ours names its writer, else our company. */
export function threadRows(lang: PortalLang, lines: readonly PortalThreadLine[], company: string, words: PageWords = CODE_WORDS): ThreadRow[] {
  return lines.map((l) => {
    const day = calendarYmdInAppTzFromIso(l.at) || l.at.slice(0, 10)
    const who = l.dir === 'in' ? words.say(lang, 'you') : (l.who ?? company)
    return {
      id: l.id,
      mine: l.dir === 'in',
      text: cut(l.subject ? `${l.subject}: ${l.body}` : l.body),
      small: `${who} · ${pWeekday(lang, day)} · ${words.say(lang, DOOR[l.door])}`,
    }
  })
}

/** Who to call for something urgent on site: the superintendent, else the project manager, else our company. */
export function urgentName(page: Pick<PortalGcPage, 'people'>, company: string): string {
  return page.people.find((p) => p.role === 'super')?.name ?? page.people.find((p) => p.role === 'pm')?.name ?? company
}
