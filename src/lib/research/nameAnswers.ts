/**
 * Bids and permits (punch list #307, PR 6 and 7): the answer on a name. A permit lists one
 * contact, and it is not always the builder. When a bid's site carries a permit, the app asks
 * once whether the name the city lists works for the bid's GC, and keeps the answer in
 * `builder_customer_answers` (append-only). This file folds those rows into what is known about
 * each name, decides whether the question is still open for the person looking, and writes the
 * words. An answer shows what it would tie before it ties it: one person can file for more than
 * one builder. A name that begins the GC's own, or is begun by it, is the likely grade: the
 * question reads *Same company?*, and the answer writes the same rows. No React, no Supabase.
 */
import { builderKeyOf, contactParts, nameKey } from '../../../supabase/functions/_shared/permitLookup'
import { shortDay } from './permitResearch'
import { nameLikeness, nameWords } from './nameLikeness'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { Chip } from './bidSitePanel'

export type NameAnswer = 'works_for' | 'someone_else' | 'not_sure' | 'taken_back'
export type AnswerScope = 'all' | 'this_permit'

/** One row of `builder_customer_answers`. */
export type NameAnswerRow = {
  id: string
  builder_key: string
  customer_id: string
  answer: NameAnswer
  scope: AnswerScope | null
  permit_id: string | null
  name: string
  answered_by: string
  answered_at: string
}

/** What is known about one name, for one GC. */
export type NameState = {
  key: string
  /** The name as the city lists it, off the newest answer that carries one. */
  name: string
  /** Every permit under the name shows under the GC. */
  all: boolean
  /** The permits tied one at a time. */
  permitIds: string[]
  /** The name is not the GC's. */
  someoneElse: boolean
  /** The people who said they do not know. */
  notSureBy: string[]
  /** Who gave the answer that stands, and when. Null when none stands. */
  by: string | null
  at: string | null
}

/**
 * The answers about one GC, folded per name, oldest first so the newest stands. A GC under
 * several customer rows is one GC: `customerIds` are all of its rows.
 */
export function foldNameAnswers(rows: readonly NameAnswerRow[], customerIds: readonly string[]): Map<string, NameState> {
  const ids = new Set(customerIds)
  const out = new Map<string, NameState>()
  const sorted = rows.filter((r) => ids.has(r.customer_id)).sort((a, b) => a.answered_at.localeCompare(b.answered_at))
  for (const r of sorted) {
    const s = out.get(r.builder_key) ?? { key: r.builder_key, name: '', all: false, permitIds: [], someoneElse: false, notSureBy: [], by: null, at: null }
    if (r.name.trim() !== '') s.name = r.name.trim()
    if (r.answer === 'not_sure') {
      if (!s.notSureBy.includes(r.answered_by)) s.notSureBy.push(r.answered_by)
    } else if (r.answer === 'works_for') {
      s.someoneElse = false
      if (r.scope === 'all') s.all = true
      else if (r.permit_id && !s.permitIds.includes(r.permit_id)) s.permitIds.push(r.permit_id)
      s.by = r.answered_by
      s.at = r.answered_at
    } else if (r.answer === 'someone_else') {
      s.all = false
      s.permitIds = []
      s.someoneElse = true
      s.by = r.answered_by
      s.at = r.answered_at
    } else {
      s.all = false
      s.permitIds = []
      s.someoneElse = false
      s.by = null
      s.at = null
    }
    out.set(r.builder_key, s)
  }
  return out
}

/** The name on a contact line as a person reads it: the company when the line names one, else the person. */
export function listedName(contact: string | null | undefined): string | null {
  const { person, company } = contactParts(contact)
  return company ?? person
}

/**
 * How strong the reason to ask is. Likely: one name begins the other, a branch or a longer legal
 * name, so the question is *Same company?*. Possible: the name is only on a site we bid to the GC.
 */
export type NameGrade = 'likely' | 'possible'

/**
 * The grade of a name on a permit against a GC's name. Word for word, as `nameLikeness` reads
 * "begins", so Brund does not begin Burdette; two names a legal word apart (LP, Limited) count too.
 * The exact same key is not graded here: it is joined without a person.
 */
export function nameGrade(name: string, customerName: string): NameGrade {
  if (nameLikeness(customerName, name)?.reason === 'begins') return 'likely'
  const ours = nameWords(customerName)
  const theirs = nameWords(name)
  return ours.telling.length > 0 && ours.all.join(' ') === theirs.all.join(' ') ? 'likely' : 'possible'
}

export type NameStanding =
  /** The question is open for this person. */
  | { kind: 'ask'; key: string; name: string; grade: NameGrade }
  /** The name is the GC's own. Nothing to ask. */
  | { kind: 'own_name'; key: string; name: string }
  | { kind: 'tied'; key: string; name: string; scope: AnswerScope; by: string | null; at: string | null }
  | { kind: 'someone_else'; key: string; name: string; by: string | null; at: string | null }
  /** Marked as a name that files for others on Builders: never tied to one GC. */
  | { kind: 'files_for_others'; key: string; name: string }
  /** This person said they do not know. It stays open for everyone else. */
  | { kind: 'not_sure'; key: string; name: string }
  /** The city lists nobody on the permit. */
  | { kind: 'nobody' }

/** Where a permit's name stands for a bid's GC, for the person looking. */
export function nameStanding(
  permit: { id: string; contact: string | null; builder_key?: string | null },
  customerName: string,
  states: ReadonlyMap<string, NameState>,
  me: string | null,
  kinds: ReadonlyMap<string, string | null>,
): NameStanding {
  const key = permit.builder_key ?? builderKeyOf(permit.contact)
  const name = listedName(permit.contact)
  if (!key || !name) return { kind: 'nobody' }
  if (key === nameKey(customerName)) return { kind: 'own_name', key, name }
  const s = states.get(key)
  if (s?.all) return { kind: 'tied', key, name, scope: 'all', by: s.by, at: s.at }
  if (s?.permitIds.includes(permit.id)) return { kind: 'tied', key, name, scope: 'this_permit', by: s.by, at: s.at }
  if (s?.someoneElse) return { kind: 'someone_else', key, name, by: s.by, at: s.at }
  if (kinds.get(key) === 'files_for_others') return { kind: 'files_for_others', key, name }
  if (me != null && s?.notSureBy.includes(me)) return { kind: 'not_sure', key, name }
  return { kind: 'ask', key, name, grade: nameGrade(name, customerName) }
}

/** "your word, Nov 10" or "Sam’s word, Nov 10". Empty when nobody is on record. */
export function wordOfWords(by: string | null, at: string | null, me: string | null, nameOf: (userId: string) => string | null): string {
  if (!by) return ''
  const who = by === me ? 'your word' : `${nameOf(by) ?? 'a teammate'}’s word`
  return at ? `${who}, ${shortDay(calendarYmdInAppTzFromIso(at))}` : who
}

/** The chip beside the name once the question is settled. Null while it is open. */
export function standingChip(standing: NameStanding, customerName: string): Chip | null {
  if (standing.kind === 'tied') return { words: `${nameGrade(standing.name, customerName) === 'likely' ? 'Same company as' : 'Works for'} ${customerName}`, tone: 'blue' }
  if (standing.kind === 'own_name') return { words: 'Their own name', tone: 'blue' }
  if (standing.kind === 'someone_else') return { words: 'Not theirs', tone: 'grey' }
  if (standing.kind === 'files_for_others') return { words: 'Files for others', tone: 'grey' }
  return null
}

/** The kinds a "someone else" answer can name, in the order offered. Null is no kind. */
export const SOMEONE_ELSE_KINDS: ReadonlyArray<{ kind: 'owner' | 'architect' | 'files_for_others' | 'gc' | null; words: string }> = [
  { kind: 'owner', words: 'The owner' },
  { kind: 'architect', words: 'Architect or engineer' },
  { kind: 'files_for_others', words: 'Files for others' },
  { kind: 'gc', words: 'Another GC' },
  { kind: null, words: 'Not sure who' },
]

/** A name that ends a sentence. "Brund & Assoc." brings its own full stop, so the sentence adds none. */
const ending = (name: string): string => (/\.$/.test(name.trim()) ? name.trim() : `${name.trim()}.`)

/**
 * The question as it is asked, with its three presses. The likely grade asks *Same company?*
 * beside the GC's own name; the possible grade asks who the name is.
 */
export function questionWords(name: string, customerName: string, grade: NameGrade = 'possible'): { lead: string; ask: string; worksFor: string; someoneElse: string; why: string } {
  if (grade === 'likely') {
    return {
      lead: `The city lists ${name} on this permit. Your customer is ${ending(customerName)}`,
      ask: 'Same company?',
      worksFor: 'Same company',
      someoneElse: 'Not them…',
      why: 'Asked because one name begins the other. Asked once.',
    }
  }
  return {
    lead: `The city lists ${name} on this permit.`,
    ask: 'Do you know who that is?',
    worksFor: `Works for ${customerName}`,
    someoneElse: 'Someone else…',
    why: `Asked because you are bidding this address to ${ending(customerName)} Asked once.`,
  }
}

/**
 * What "works for" would do, shown before it does it: how many other permits the name is on,
 * and the two presses. With none there is nothing to choose between.
 */
export function tiePreviewWords(name: string, customerName: string, otherPermits: number, grade: NameGrade = 'possible'): { lead: string; all: string; one: string | null; why: string } {
  const tie = grade === 'likely' ? `${name} is the same company as ${ending(customerName)}` : `${name} works for ${ending(customerName)}`
  if (otherPermits <= 0) {
    return { lead: `${tie} The city lists ${name} on no other permit we can see.`, all: `Tie ${name} to ${customerName}`, one: null, why: 'Later permits under this name will show under them too.' }
  }
  return {
    lead: `${tie} The city lists ${name} on ${otherPermits} other permit${otherPermits === 1 ? '' : 's'} we can see.`,
    all: `Show all ${otherPermits} under ${customerName}`,
    one: 'This permit only',
    why: grade === 'likely' ? 'Look at them first. Two companies can share the start of a name.' : 'Look at them first. One person can file for more than one builder.',
  }
}

/** The line after an answer, beside Undo. */
export function answeredWords(standing: NameStanding, customerName: string, otherPermits: number, word: string): string | null {
  const head = word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}.` : ''
  // A name that begins the GC's own was asked as the same company, so the answer reads that way.
  const same = standing.kind === 'tied' || standing.kind === 'someone_else' ? nameGrade(standing.name, customerName) === 'likely' : false
  if (standing.kind === 'tied') {
    const tail = standing.scope === 'all' ? (otherPermits > 0 ? ` ${otherPermits} other permit${otherPermits === 1 ? '' : 's'} now show${otherPermits === 1 ? 's' : ''} under ${ending(customerName)}` : '') : ' This permit only.'
    return `${word ? `Tied on ${word}. ` : 'Tied. '}${standing.name} ${same ? 'is the same company as' : 'works for'} ${ending(customerName)}${tail}`
  }
  if (standing.kind === 'someone_else') return `${head ? `${head} ` : ''}${standing.name} ${same ? 'is not' : 'does not work for'} ${ending(customerName)}`
  if (standing.kind === 'not_sure') return `You said you are not sure who ${standing.name} is. The question stays open for the rest of the team.`
  return null
}

/** One name tied to a GC, for the second half of the GC's panel. */
export type TiedName = { key: string; name: string; how: string; tie: 'own' | 'all' | 'permits'; permitIds: string[] }

/**
 * The names tied to a GC: its own name first, then the names someone tied, the newest first.
 * `ownKey` is the GC's own name keyed, shown whether or not the city lists a permit under it.
 */
export function tiedNames(states: ReadonlyMap<string, NameState>, customerName: string, me: string | null, nameOf: (userId: string) => string | null): TiedName[] {
  const out: TiedName[] = []
  const ownKey = nameKey(customerName)
  if (ownKey) out.push({ key: ownKey, name: customerName, how: 'Their own name', tie: 'own', permitIds: [] })
  const tied = [...states.values()].filter((s) => (s.all || s.permitIds.length > 0) && s.key !== ownKey).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
  for (const s of tied) {
    const word = wordOfWords(s.by, s.at, me, nameOf)
    // A company tied to a company is the same company under another name; a person works for them.
    const base = s.all ? (contactParts(s.name).company ? 'Same company' : 'Works for them') : `Tied on ${s.permitIds.length} permit${s.permitIds.length === 1 ? '' : 's'}`
    out.push({ key: s.key, name: s.name || s.key, how: word ? `${base} · ${word}` : base, tie: s.all ? 'all' : 'permits', permitIds: s.all ? [] : [...s.permitIds] })
  }
  return out
}

/** "Listed on 7 permits since Aug 26" under a tied name. `reach` is `reachWords`, null when the start is not known. */
export function listedOnWords(count: number, reach: string | null): string {
  if (count === 0) return reach ? `Listed on no permit ${reach}` : 'Listed on no permit we can see'
  return `Listed on ${count} permit${count === 1 ? '' : 's'} ${reach ?? 'we can see'}`
}
