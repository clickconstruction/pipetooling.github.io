/**
 * Punch list #205, row 2 (PR 6): a word to every trade on a job. JobTread's GC wrote one thread to every trade at once;
 * ours sent one company at a time by hand. The press on the project's card sends one email per awarded company through
 * `gc-trade-email` (kind `nudge`, the job's mail group), and each lands in `gc_trade_messages`, so every company's
 * thread in its portal shows it (PR 5). Pure: who gets it, the email's key, the lines from the text and the default subject.
 */
import { GC_COMPANY } from './company'
import type { TradeEmailLine } from './tradeEmail'
import type { GcProject, GcState, Partner } from './types'

/** One company awarded a trade on the job, with the trades it holds. */
export interface WordRecipient {
  partner: Partner
  trades: string[]
}

/**
 * Every company awarded a trade on the job through one of its own invites, each once, in the order of the trades. Our own
 * crew and a trade not awarded yet are not companies.
 */
export function wordRecipients(state: GcState, project: GcProject): WordRecipient[] {
  const out = new Map<string, WordRecipient>()
  for (const pkg of project.packages) {
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    if (!invite) continue
    const partner = state.partners.find((p) => p.id === invite.partnerId)
    if (!partner) continue
    const entry = out.get(partner.id) ?? { partner, trades: [] }
    if (!entry.trades.includes(pkg.trade)) entry.trades.push(pkg.trade)
    out.set(partner.id, entry)
  }
  return [...out.values()]
}

/** The subject the window starts with: *A word from Click on Fair Oaks Shops*. */
export function wordSubject(projectName: string): string {
  return `A word from ${GC_COMPANY.shortName} on ${projectName}`
}

/** The email's lines from the text typed: its paragraphs, trimmed, the empty ones dropped. */
export function wordLines(text: string): TradeEmailLine[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p) => p !== '')
}

/**
 * The email's key (the shape of `datesEmailKey`): `word:<projectId>:` and a SHA-256 of the subject and the text. The same
 * words give the same key, so a second press sends nothing and answers `already`; a changed word gives a new one. Under
 * the sender's 200 letters.
 */
export async function wordEmailKey(projectId: string, subject: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${subject.trim()}\n${text.trim()}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `word:${projectId}:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

/** "a, b and c" */
export function andList(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}
