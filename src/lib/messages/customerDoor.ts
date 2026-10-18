/**
 * The customer's door on the Pipeline row (v2.5626, punch list #123): the sheet behind the speech bubble beside a
 * customer's name. What it offers comes from the facts the row already holds (the customer's mobile and email on the
 * job), and whose word came last comes from the job's own lines, so the board reads nothing new to draw the row.
 */
import type { JobActivityMessage } from '../jobs/jobActivityMessages'
import { whenWords } from './thread'

export type CustomerDoorKind = 'call' | 'text' | 'email' | 'thread' | 'record'

export interface CustomerDoorRow {
  kind: CustomerDoorKind
  label: string
  enabled: boolean
  /** Why a row is grey, under it. Null when it is live. */
  why: string | null
}

export const NO_MOBILE_WORDS = 'No mobile on file. Email instead.'
export const NO_MOBILE_AT_ALL_WORDS = 'No mobile on file.'
export const NO_EMAIL_WORDS = 'No email on file. Text instead.'
export const NO_EMAIL_AT_ALL_WORDS = 'No email on file.'
export const NO_NUMBER_WORDS = 'No number on file.'

/** The sheet's rows, in order: Call, Text, Email, Open their thread, and Their record where the page has the window. */
export function customerDoorRows(facts: { phone: string | null | undefined; email: string | null | undefined; canOpenRecord: boolean }): CustomerDoorRow[] {
  const phone = (facts.phone ?? '').trim()
  const email = (facts.email ?? '').trim()
  const rows: CustomerDoorRow[] = [
    { kind: 'call', label: 'Call', enabled: phone !== '', why: phone ? null : NO_NUMBER_WORDS },
    { kind: 'text', label: 'Text', enabled: phone !== '', why: phone ? null : email ? NO_MOBILE_WORDS : NO_MOBILE_AT_ALL_WORDS },
    { kind: 'email', label: 'Email', enabled: email !== '', why: email ? null : phone ? NO_EMAIL_WORDS : NO_EMAIL_AT_ALL_WORDS },
    { kind: 'thread', label: 'Open their thread', enabled: true, why: null },
  ]
  if (facts.canOpenRecord) rows.push({ kind: 'record', label: 'Their record', enabled: true, why: null })
  return rows
}

export interface LastWord {
  who: 'them' | 'us'
  at: string
  /** The customer's name as the line carries it: the name they go by, else their name. */
  name: string
}

/** The lines that are a word between us and them: a note, an event and a team line are ours alone. */
const WORD_CHANNELS: ReadonlySet<JobActivityMessage['channel']> = new Set(['call', 'voicemail', 'missed', 'text', 'email', 'portal'])

/** Whose word came last on the job: the newest call, text, email or portal line, theirs or ours. Null with none. */
export function lastWordOnJob(lines: readonly JobActivityMessage[]): LastWord | null {
  let best: JobActivityMessage | null = null
  for (const m of lines) {
    if (!WORD_CHANNELS.has(m.channel)) continue
    if (m.direction !== 'in' && m.direction !== 'out') continue
    if (!best || m.at > best.at) best = m
  }
  if (!best) return null
  return { who: best.direction === 'in' ? 'them' : 'us', at: best.at, name: (best.contact.goesBy ?? '').trim() || best.contact.name.trim() || 'They' }
}

/** The sheet's line under the job: "Waiting on us: Dana wrote last, yesterday." or "You wrote last, today at 8:44 AM." */
export function lastWordWords(last: LastWord | null, nowIso: string): string | null {
  if (!last) return null
  const when = whenWords(last.at, nowIso)
  return last.who === 'them' ? `Waiting on us: ${last.name} wrote last, ${when}.` : `You wrote last, ${when}.`
}
