/**
 * Fix the spelling (punch list #439, piece 2). **Same place** records that two addresses are one place and changes
 * no job's address. This kernel is the second, separate press: it says which jobs and bids are written the other
 * way, so a person can pick the spelling to keep and change the rest to it. Once they are written one way the two
 * addresses share a cleaned key, match silently, and the pair leaves the list.
 *
 * Pure: no React, no supabase. The write is `fixSpelling` in `hooks/useAddressLookAlikes.ts`.
 */
import { batchOutcomeWords, countedLabel, type BatchNoun, type BatchOutcome } from '../batchWords'
import { normalizeAddressKey } from '../developments/notInIt'
import { markedWords, type AddressOnFile, type AddressThing } from './addressesOnFile'
import type { LookAlikePair } from './lookAlikes'

/** Which of a pair's two addresses is kept. `a` is the one with more jobs and bids. */
export type KeepSide = 'a' | 'b'

/** One job or bid the fix would rewrite. */
export type SpellingFixRow = { kind: 'job' | 'bid'; id: string; label: string; from: string }

export type SpellingFixPlan = {
  /** The spelling every picked row is changed to. */
  to: string
  /** The jobs and bids written the other way, in the order read. */
  rows: SpellingFixRow[]
  /** Words with a number in them that the kept spelling does not have: a unit, a suite, a building. */
  drops: string[]
  /** Words with a number in them that only the kept spelling has, which the change would put on each row. */
  adds: string[]
}

const ADDRESSES: BatchNoun = ['address', 'addresses']
/** A zip code at an address's end: the cleaned key drops it, and it is no unit. */
const ZIP = /^\d{5}(-\d{4})?[,.]?$/

export const FIX_SPELLING_WORDS = {
  door: 'Fix the spelling…',
  title: 'Fix the spelling',
  lead: 'Pick the spelling to keep. The jobs written the other way change to it.',
  keep: 'Write it as',
  changes: 'These change',
  nothing: 'Nothing is written the other way.',
  foot: 'This changes the address on the jobs you pick. What is sent for them carries the new address from then on.',
  cancel: 'Cancel',
  openJob: 'Open the job',
} as const

/** A row's name in the list: its label, or what it is when it has none. */
export function thingName(thing: Pick<AddressThing, 'kind' | 'label'>): string {
  const label = thing.label?.trim()
  return label || (thing.kind === 'job' ? 'A job with no number' : 'A bid with no number')
}

/** What changes when one side's spelling is kept: every job and bid at the other side, rewritten to it. */
export function spellingFixPlan(pair: Pick<LookAlikePair, 'a' | 'b'>, keep: KeepSide): SpellingFixPlan {
  const kept: AddressOnFile = keep === 'a' ? pair.a : pair.b
  const other: AddressOnFile = keep === 'a' ? pair.b : pair.a
  const to = kept.address
  const rows: SpellingFixRow[] = other.things.filter((t) => t.address !== to).map((t) => ({ kind: t.kind, id: t.id, label: thingName(t), from: t.address }))
  // The same digits in the same order is a space moved or a letter changed (`FM1117`, `FM 1117`): no number changes.
  const digits = (address: string) => normalizeAddressKey(address).replace(/\D/g, '')
  const sameNumbers = digits(other.address) === digits(to)
  const numbered = (address: string, against: string): string[] =>
    sameNumbers
      ? []
      : markedWords(address, against)
          .filter((w, i, all) => w.differs && /\d/.test(w.text) && !(i === all.length - 1 && ZIP.test(w.text)))
          .map((w) => w.text.replace(/[,.;]+$/, ''))
  return { to, rows, drops: numbered(other.address, to), adds: numbered(to, other.address) }
}

/**
 * The caution when the change would take a number off an address or put one on: `This takes 201 off the
 * address. …`. A number is a unit, a suite or a building as often as a slip. Null when no number changes.
 */
export function numberCaution(plan: Pick<SpellingFixPlan, 'drops' | 'adds'>): string | null {
  const off = plan.drops.length > 0 ? `takes ${plan.drops.join(' and ')} off the address` : ''
  const on = plan.adds.length > 0 ? `puts ${plan.adds.join(' and ')} on ${off ? 'it' : 'the address'}` : ''
  if (!off && !on) return null
  return `This ${[off, on].filter(Boolean).join(' and ')}. If that is a unit of its own, press Cancel and answer Not the same.`
}

/** The button: `Change 2 addresses`, and `Change addresses` when none is picked, which the window draws dead. */
export function fixButtonWords(picked: number): string {
  return countedLabel('Change', picked, ADDRESSES)
}

/** After the press: what took, and what did not. */
export function fixOutcomeWords(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'Change', past: 'changed', done, failed, noun: ADDRESSES })
}

/** The door on a no-number row: `Open the job` for the only job there, `Open J1078` for one of several. */
export function openJobWords(thing: Pick<AddressThing, 'label'>, jobsHere: number): string {
  const label = thing.label?.trim()
  return jobsHere > 1 && label ? `Open ${label}` : FIX_SPELLING_WORDS.openJob
}
