import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'

/**
 * The call script for a company new to us (v2.5556, the owner's words of 2026-10-15): what the
 * office says when it phones a subcontractor cold, in four parts, with the caller's own first
 * name where the owner left a blank. Pure: the screen (`GcCallScriptWindow.tsx`, from Trade
 * partners) only draws it. The paragraphs are the owner's, quoted as he wrote them; the company
 * name is the letterhead's (`PORTAL_COMPANY`), so it changes in one place.
 */

/** One piece of a line: the caller's name is marked so the screen can set it in bold. */
export interface CallScriptSegment {
  text: string
  name?: true
}

export interface CallScriptPart {
  id: 'intro' | 'contact' | 'info' | 'closing'
  title: string
  /** Each paragraph, in pieces. */
  lines: CallScriptSegment[][]
  /** The questions to ask, one after the paragraph; only Collecting info has them. */
  asks: string[]
}

export const CALL_SCRIPT_TITLE = 'Calling a company new to us'
export const CALL_SCRIPT_SUB = 'Say it in your own words. Your name is already in it.'
export const CALL_SCRIPT_THEN = "Then press Add a company on the trade's card and type what they gave you."
export const CALL_SCRIPT_BUTTON = 'Call script'
export const CALL_SCRIPT_COPY = 'Copy the script'
export const CALL_SCRIPT_COPIED = 'The script is copied.'
export const CALL_SCRIPT_NEW_TAB = 'Open in a new tab'
/** Trade partners with the script open, for the new tab. */
export const CALL_SCRIPT_HREF = '/gc?view=partners&script=1'
/** What stands where the name goes when the app has none for the caller. */
export const CALL_SCRIPT_BLANK = '________'

/** The caller's first name from their display name (`users.name`); null when the app has none. */
export function callerFirstName(profileName: string | null | undefined): string | null {
  const first = (profileName ?? '').trim().split(/\s+/)[0] ?? ''
  return first ? first : null
}

const name = (caller: string | null): CallScriptSegment => ({ text: caller ?? CALL_SCRIPT_BLANK, name: true })

/** A set of plans in hand (v2.5808, a run from the Subs board): the trade and the project the call is about, so the script says it. */
export interface CallScriptJob {
  trade: string | null
  project: string | null
}

/** The line a run adds to the intro: what we have and what we want. */
export function callScriptJobLine(job: CallScriptJob): string | null {
  if (!job.trade && !job.project) return null
  const scope = job.trade ? `a ${job.trade} scope` : 'a scope in your trade'
  return `We have a set of plans in hand with ${scope}${job.project ? ` on ${job.project}` : ''}, and we would like your quote on it.`
}

/** The four parts with the caller's name set in. */
export function callScript(caller: string | null, company: string = PORTAL_COMPANY.name, job: CallScriptJob | null = null): CallScriptPart[] {
  const jobLine = job ? callScriptJobLine(job) : null
  return [
    {
      id: 'intro',
      title: 'Intro',
      lines: [
        [
          { text: 'Hi, my name is ' },
          name(caller),
          {
            text: `, and I’m calling from ${company}. We’re looking to connect with local subcontractors in the area to discuss bidding jobs with us. I was hoping you could point me in the right direction. Who would be the best person to speak with regarding estimating, bidding or new project opportunities?`,
          },
        ],
        ...(jobLine ? [[{ text: jobLine }]] : []),
      ],
      asks: [],
    },
    {
      id: 'contact',
      title: 'Point of contact',
      lines: [
        [
          { text: 'Hi, my name is ' },
          name(caller),
          {
            text: `, and I’m with ${company}. We bid a lot of jobs and are looking for local trade partners for upcoming projects. If you’re willing to bid some of our work we can send over opportunities that are outside ours but inside your scope of services. With your help we could complete more projects. Would you be the right person to contact regarding bids and estimating for your company?`,
          },
        ],
      ],
      asks: [],
    },
    {
      id: 'info',
      title: 'Collecting info',
      lines: [[{ text: 'I’d like to get your contact information so our team can reach out to you directly when we have projects available for bidding.' }]],
      asks: [
        'Could I get your name and the title your company knows you by?',
        'What’s the best phone number to reach you?',
        'What’s the best email address to send bid invitations, plans and project information?',
        'What is your office address and how far are you willing to travel?',
      ],
    },
    {
      id: 'closing',
      title: 'Closing',
      lines: [
        [
          {
            text: 'Thank you! It’s good to connect with other companies in the area. I’ll add your information to our subcontractor contact list so we can reach out when we have work that matches your scope. We look forward to the possibility of working together.',
          },
        ],
      ],
      asks: [],
    },
  ]
}

/** The script as plain text, for Copy: a heading a part, the asks as a list. */
export function callScriptText(parts: readonly CallScriptPart[]): string {
  return parts
    .map((p) => {
      const lines = p.lines.map((segs) => segs.map((s) => s.text).join(''))
      const asks = p.asks.map((a) => `- ${a}`)
      return [p.title, ...lines, ...asks].join('\n')
    })
    .join('\n\n')
}
