/**
 * Index this job's files (punch list #240, PR 1, v2.6319): the press on the job window's Documents tab that reads the
 * words inside the job's Drive files into our own index, so Documents → Search finds them from the index instead of
 * waiting on Drive's. The words and the loop's rules, pure; the io is `jobIndexFolderIo.ts`. The function indexes up
 * to forty files a call inside its budget and answers how many remain, so the press calls again until none do.
 */
import { heldWhyWords, indexPassWords, type HeldFile, type IndexPassAnswer } from '../../../supabase/functions/_shared/fileIndexKernel'

export type { HeldFile }

/** The function's answer to `index_job`, as the press reads it. */
export type IndexJobAnswer = IndexPassAnswer & { total: number }

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const WHYS: readonly HeldFile['why'][] = ['scan', 'kind', 'big', 'slow', 'error']

/** The answer's shape read defensively; one the press does not know reads as nothing done and nothing left. */
export function indexJobFromAnswer(d: unknown): IndexJobAnswer {
  const o = (d ?? {}) as Record<string, unknown>
  const held: HeldFile[] = []
  for (const raw of Array.isArray(o.held) ? o.held : []) {
    const h = (raw ?? {}) as Record<string, unknown>
    const why = WHYS.find((w) => w === h.why)
    if (typeof h.id === 'string' && why) held.push({ id: h.id, name: str(h.name) ?? h.id, why })
  }
  return { indexed: num(o.indexed), held, remaining: num(o.remaining), total: num(o.total) }
}

/** How many calls one press makes at most: forty files a call, so two thousand files. */
export const INDEX_JOB_MAX_ROUNDS = 50

/** The tally across the rounds of one press. */
export type IndexJobTally = { indexed: number; held: HeldFile[]; remaining: number; total: number; rounds: number }

export const emptyTally = (): IndexJobTally => ({ indexed: 0, held: [], remaining: 0, total: 0, rounds: 0 })

/** The tally after one more round: the counts add up, the held list is the newest answer's when the job is done. */
export function addRound(t: IndexJobTally, a: IndexJobAnswer): IndexJobTally {
  const done = a.remaining === 0
  return { indexed: t.indexed + a.indexed, held: done ? a.held : [...t.held, ...a.held], remaining: a.remaining, total: a.total || t.total, rounds: t.rounds + 1 }
}

/** Whether the press calls again. */
export function wantsAnotherRound(t: IndexJobTally): boolean {
  return t.remaining > 0 && t.rounds < INDEX_JOB_MAX_ROUNDS
}

/** The press's words. Each sentence is one idea, as a first-timer reads it. */
export const INDEX_FOLDER_WORDS = {
  button: 'Index this job’s files',
  busy: 'Indexing…',
  hint: 'reads the words inside the job’s files, so Documents → Search finds them in our index.',
  failed: 'The index did not run.',
  tryAgain: 'Try again',
  retryHeld: 'Try the held files again',
} as const

/** The line while the rounds run. */
export function indexingWords(t: IndexJobTally): string {
  if (t.rounds === 0) return 'Reading the job’s folders…'
  const files = t.indexed === 1 ? '1 file' : `${t.indexed} files`
  return t.remaining > 0 ? `Indexed ${files}, ${t.remaining} to go…` : `Indexed ${files}…`
}

/** The line once the rounds are done: what was indexed, what was held, nothing left. */
export function indexedWords(t: IndexJobTally): string {
  if (t.total === 0 && t.indexed === 0) return 'The job’s folders hold no files to index.'
  return indexPassWords({ indexed: t.indexed, held: t.held, remaining: t.remaining })
}

/** A held file's line: its name and why, in the office's words. */
export function heldLineWords(h: HeldFile): string {
  return `${h.name}: ${heldWhyWords(h.why)}.`
}

/** How many held files the press lists before folding the rest into a count. */
export const HELD_SHOWN = 5

export function moreHeldWords(held: readonly HeldFile[]): string | null {
  const more = held.length - HELD_SHOWN
  return more > 0 ? `and ${more} more.` : null
}

/** Whether the held list has rows worth a second try: a slow or failed read, never a scan or a kind we do not read. */
export function hasRetryableHeld(held: readonly HeldFile[]): boolean {
  return held.some((h) => h.why === 'slow' || h.why === 'error' || h.why === 'big')
}
