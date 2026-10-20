/**
 * Messages, residential R8 · 11: a candidate who texts the office line, handed to the hiring board (Prospects →
 * Hiring). The after state is card 11 of `to-dos/gc-mode/messages/customer-messages-integrations-mockups.html` (branch
 * spike/gc-mode, v0.2); the plan is `RESIDENTIAL_BUILD_PLAN.md` → R8.
 *
 * *Who is this?* gains one answer: a candidate. The press makes a `team_prospects` card with the fields the board's own
 * Add candidate fills (`saveNewCandidate` in `TeamProspectsTab.tsx`), then re-points the contact at it through the
 * spine's `nameContact`, so the thread stays whole. The board keeps no thread table of its own: its card finds the
 * lines by its row and opens the thread window on them, as any thread opens. Nothing is moved or copied. Messages
 * keeps the contact as a candidate, which Follow up never shows or counts (`OFF_FOLLOW_UP`).
 *
 * Pure: the caller mints the card's id, inserts the row, then calls `name_contact` with the plan's record.
 */
import { applyNamePlan, nameContact, type Contact, type ContactRecord, type NamePlan } from '../contacts/kernel'
import { onFollowUp } from '../followUp/queue'
import { dayLabel } from '../messages/owed'
import type { ThreadMessage } from '../messages/thread'
import { nextTeamProspectRank, type RankableTeamProspect } from '../teamProspectRanking'
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly, ymdDaysBetween } from '../../utils/dateUtils'

/** Where a card made from a text says it came from, in the board's Source field. */
export const CANDIDATE_SOURCE = 'text to the office'

/** A text from a number nobody has named, as *Who is this?* reads it. */
export type CandidateMessage = Pick<ThreadMessage, 'id' | 'contactId' | 'channel' | 'direction' | 'at' | 'body' | 'channelId'>

/** The `team_prospects` row the press inserts, as the board's Add candidate fills one. */
export interface CandidateInsert {
  id: string
  master_user_id: string
  created_by: string
  name: string
  phone_number: string | null
  email: null
  trade: null
  source: typeof CANDIDATE_SOURCE
  /** The text's first line. */
  notes: string | null
  links: []
  status: 'active'
  /** Unsorted: the office drags the card into its role's column. */
  role_id: null
  rank_order: number
}

/** What the press needs beyond the text: who is pressing, the card's new id, and the board's cards for the rank. */
export interface CandidateContext {
  contacts: readonly Contact[]
  /** The id the caller mints for the new card, so the re-point can name it before the insert returns. */
  prospectId: string
  /** The board's owner, as `saveNewCandidate` resolves it. */
  masterUserId: string
  userId: string
  /** The board's cards, for the next rank in Unsorted. */
  boardRows: readonly RankableTeamProspect[]
}

/** The press's two writes, in order: the card, then the contact's re-point to it. */
export interface CandidateFromText {
  insert: CandidateInsert
  plan: NamePlan
  /** Where the card's name came from: the words of the text, or the number when it names no one. */
  namedFrom: 'text' | 'number'
}

/** Words after "I'm" or "it's" that are not a name: "I'm Interested", "It's Still open". */
const NOT_A_NAME = new Set([
  'a', 'an', 'the', 'interested', 'looking', 'calling', 'texting', 'writing', 'reaching', 'available', 'still', 'here', 'sorry',
  'not', 'just', 'hoping', 'wondering', 'asking', 'applying', 'open', 'ok', 'okay', 'good', 'great', 'fine', 'new', 'currently',
  'indeed', 'hi', 'hello', 'hey', 'thanks', 'thank',
])

/**
 * The name a text gives: after "this is", "my name is", "I'm" or "it's", one to three words that start with a capital.
 * Null when it names no one.
 */
export function nameInText(text: string): string | null {
  const re = /\b(?:[Tt]his is|[Mm]y name is|[Mm]y name['’]s|I am|I['’]m|[Ii]t['’]s|[Ii]t is)\s+(\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,2})/gu
  for (const hit of text.matchAll(re)) {
    const words = hit[1]!.split(/\s+/)
    const kept: string[] = []
    for (const w of words) {
      if (NOT_A_NAME.has(w.toLowerCase())) break
      kept.push(w)
    }
    if (kept.length) return kept.join(' ')
  }
  return null
}

/** The text's first line, for the card's notes. */
function firstLine(text: string): string | null {
  return (
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? null
  )
}

/** The number the text came from: its own channel, else the contact's first number, else its name, which is the number. */
function numberOf(contact: Contact, channelId: string | null | undefined): string | null {
  const own = channelId ? contact.channels.find((ch) => ch.id === channelId && ch.kind === 'phone') : undefined
  return own?.value ?? contact.channels.find((ch) => ch.kind === 'phone')?.value ?? (contact.name.trim() || null)
}

/**
 * *Who is this?* → a candidate: the card the board's Add candidate would make from the text, and the contact's re-point
 * to it. Null when the text is not from a number nobody has named.
 */
export function candidateFromWhoIsThis(message: CandidateMessage, ctx: CandidateContext): CandidateFromText | null {
  const contact = ctx.contacts.find((c) => c.id === message.contactId)
  if (!contact || contact.kind !== 'unknown' || message.direction !== 'in') return null
  const phone = numberOf(contact, message.channelId)
  const named = nameInText(message.body)
  const name = named ?? phone ?? 'A candidate'
  const record: NonNullable<ContactRecord> = { table: 'team_prospects', id: ctx.prospectId }
  const plan = nameContact(ctx.contacts, contact.id, { record, kind: 'candidate', name, company: '' })
  if (!plan) return null
  return {
    insert: {
      id: ctx.prospectId,
      master_user_id: ctx.masterUserId,
      created_by: ctx.userId,
      name,
      phone_number: phone,
      email: null,
      trade: null,
      source: CANDIDATE_SOURCE,
      notes: firstLine(message.body),
      links: [],
      status: 'active',
      role_id: null,
      rank_order: nextTeamProspectRank([...ctx.boardRows], null),
    },
    plan,
    namedFrom: named ? 'text' : 'number',
  }
}

/** The contacts and the thread after the press: the same lines, now on the candidate. The spine's own fold. */
export function afterCandidatePress<M extends { contactId: string; jobId: string | null }>(
  contacts: readonly Contact[],
  messages: readonly M[],
  made: Pick<CandidateFromText, 'plan'>,
): { contacts: Contact[]; messages: M[] } {
  return applyNamePlan(contacts, messages, made.plan)
}

// ---------- the board's side ----------

/** What the hiring board shows for a candidate who texted, and what Messages keeps. */
export interface BoardHandoff<M> {
  /** The card the lines belong to. */
  prospectId: string
  contactId: string
  /** The lines the board's thread window shows: theirs and ours, oldest first, as any thread. */
  lines: M[]
  /** Messages keeps the contact as a candidate, and Follow up never shows or counts them. */
  keeps: { contactId: string; kind: 'candidate'; onFollowUp: boolean }
  /** The thread window the card opens: `?thread=<contact>&at=<newest line>`. */
  open: { thread: string; at: string | null }
  /** The card's line: "texted the office Tue 7:30 AM", from their newest line. Null when they never wrote. */
  cardLine: string | null
}

/**
 * The hiring board's side of a candidate's thread. Null when the contact is not a candidate on the board: the board
 * reads its own cards' threads and nobody else's.
 */
export function handoffToBoard<M extends Pick<ThreadMessage, 'id' | 'contactId' | 'direction' | 'at' | 'channel'>>(
  contact: Pick<Contact, 'id' | 'kind' | 'record'>,
  messages: readonly M[],
  now: Date,
): BoardHandoff<M> | null {
  if (contact.kind !== 'candidate' || contact.record?.table !== 'team_prospects') return null
  const lines = messages.filter((m) => m.contactId === contact.id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const shown = lines.filter((m) => m.channel !== 'event')
  const newest = shown[shown.length - 1]
  const lastIn = [...shown].reverse().find((m) => m.direction === 'in')
  return {
    prospectId: contact.record.id,
    contactId: contact.id,
    lines,
    keeps: { contactId: contact.id, kind: 'candidate', onFollowUp: onFollowUp('candidate') },
    open: { thread: contact.id, at: newest?.id ?? null },
    cardLine: lastIn ? `texted the office ${whenOnCard(lastIn.at, now)}` : null,
  }
}

// ---------- the words ----------

/** When on a card: "Tue 7:30 AM" within the week, "Tue Oct 6" before it. */
export function whenOnCard(atIso: string, now: Date): string {
  const ymd = calendarYmdInAppTzFromIso(atIso)
  const today = calendarYmdInAppTzFromIso(now.toISOString())
  if (!ymd) return ''
  const label = dayLabel(ymd)
  const days = today ? ymdDaysBetween(ymd, today) : null
  if (days !== null && days >= 0 && days <= 6) return `${label.slice(0, 3)} ${formatDenverTimeOnly(Date.parse(atIso)).replace(/\u202f/g, ' ')}`
  return label
}

/** The candidate answer in *Who is this?*: its label, with the name the text gave, and its small print. */
export function candidateOption(name: string | null): { label: string; small: string } {
  return {
    label: name ? `${name}, a candidate on the hiring board` : 'A candidate on the hiring board',
    small: 'Makes a card in Prospects, Hiring. The text goes with the card and stays off Follow up.',
  }
}

/** Every sentence the handoff shows a person, for the plain-words test and the screen. */
export function candidateWords(name: string | null, atIso: string, now: Date): { option: { label: string; small: string }; cardLine: string; toast: string } {
  return {
    option: candidateOption(name),
    cardLine: `texted the office ${whenOnCard(atIso, now)}`,
    toast: `${name ?? 'The candidate'} is on the hiring board now. The thread opens from their card.`,
  }
}
