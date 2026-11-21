/**
 * Settings on the job (punch list #389, step 3). A job carries the picks of a paper built from settings on its
 * required paper's row (`job_required_papers.settings`, the typed blanks in `fields`). This file holds the rules that
 * row keeps, as the database keeps them (`20261120163000_settings_on_the_job.sql`):
 *
 *   - a paper built from settings is required with its picks, and a plain paper takes none;
 *   - the row is locked at its first signature: until then a change is made in place, and after it a change may only
 *     tighten, and makes a new row that everyone signs again;
 *   - the read-revision rule: a job that is not a ZZ Test job takes such a paper only at the revision an attorney read;
 *   - the seal: a SHA-256 over a paper's settings, blanks and clauses with their versions, which a signed copy keeps.
 *
 * The database decides. These are its twins, for a screen to say what a press will do before it is pressed and to
 * check a signed copy's seal. One list of cases in `supabase/tests/job_paper_settings/20_scenario.sql` runs through
 * both (`jobPaperSettings.cases.test.ts`). Pure: no React, no supabase, no clock. Only `paperSeal` waits, on the
 * browser's own SHA-256.
 */
import { isZzTestJob } from '../../../supabase/functions/_shared/zzTestJob'
import { sha256Hex } from '../jobShare'
import { choiceRank, picksProblem, type PaperPicks, type SettingsDef } from './paperSettings'
import type { SummaryLine } from './paperSummary'

/** Which way a change of picks goes. A choice's place in its list is its strictness, the loosest first. */
export type PicksChange = 'same' | 'stricter' | 'looser' | 'mixed'

/** The words the database says, so a screen can say them before the press. */
export const JOB_SETTINGS_WORDS = {
  needsSettings: (name: string) => `${name} is built from settings. Require it with its settings.`,
  takesNone: (name: string) => `${name} is not built from settings. It takes none.`,
  nothingChanged: 'Nothing changed.',
  stricterOnly: 'People have signed this paper. A change now can only make it stricter. To loosen it, take the paper off the job and require it again.',
  unread: (name: string) => `${name} has not been read by an attorney as it reads today. Until it is, only a ZZ Test job takes it.`,
  noClause: (name: string) => `${name} has no clause yet. Write it in Contracts and clauses first.`,
} as const

function isBag(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Which way a change of picks goes, setting by setting. A setting the old picks never had counts from the loosest.
 * An old pick the list no longer has, or a new pick that is no choice, cannot be placed, so the change reads as mixed.
 */
export function picksChange(def: SettingsDef, from: PaperPicks | null, to: PaperPicks | null): PicksChange {
  let tighter = false
  let looser = false
  for (const s of def.settings) {
    const had = from != null && Object.prototype.hasOwnProperty.call(from, s.key)
    const was = had ? choiceRank(def, s.key, from[s.key] ?? '') : 0
    const goes = choiceRank(def, s.key, to?.[s.key] ?? '')
    if (was < 0 || goes < 0) return 'mixed'
    if (goes > was) tighter = true
    if (goes < was) looser = true
  }
  if (tighter && looser) return 'mixed'
  return tighter ? 'stricter' : looser ? 'looser' : 'same'
}

/** A job's picks as the row keeps them: a pick for each setting on the list and nothing else. */
export function cleanPicks(def: SettingsDef, picks: unknown): PaperPicks {
  const out: PaperPicks = {}
  if (!isBag(picks)) return out
  for (const s of def.settings) {
    const v = picks[s.key]
    if (typeof v === 'string') out[s.key] = v
  }
  return out
}

/** The typed blanks as the row keeps them: blanks on the list, trimmed, an empty one left out. Null when none is left. */
export function cleanTyped(def: SettingsDef, typed: unknown): Record<string, string> | null {
  const out: Record<string, string> = {}
  if (isBag(typed)) {
    for (const f of def.fields) {
      const v = typed[f.key]
      if (typeof v === 'string' && v.trim() !== '') out[f.key] = v.trim()
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Why a Book entry cannot be required this way, or null. A paper built from settings is required with a pick for
 * every setting. A plain paper takes none.
 */
export function requireProblem(paper: { name: string; def: SettingsDef | null }, given: { settings?: unknown } | null | undefined): string | null {
  if (!paper.def) return given != null ? JOB_SETTINGS_WORDS.takesNone(paper.name) : null
  if (!given || !isBag(given.settings)) return JOB_SETTINGS_WORDS.needsSettings(paper.name)
  return picksProblem(paper.def, cleanPicks(paper.def, given.settings))
}

/**
 * The read-revision rule: why this job cannot take the paper as it reads today, or null. A ZZ Test job takes any
 * revision. Any other job takes only the revision an attorney read.
 */
export function readRuleProblem(
  paper: { name: string; revision: number; readRevision: number | null },
  job: { job_name?: string | null; customer_name?: string | null },
): string | null {
  if (paper.revision < 1) return JOB_SETTINGS_WORDS.noClause(paper.name)
  if (paper.readRevision === paper.revision || isZzTestJob(job)) return null
  return JOB_SETTINGS_WORDS.unread(paper.name)
}

const sameBag = (a: Record<string, string> | null, b: Record<string, string> | null): boolean => {
  const ka = Object.keys(a ?? {}).sort()
  const kb = Object.keys(b ?? {}).sort()
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a?.[k] === b?.[k])
}

export interface SettingsChange {
  def: SettingsDef
  /** The row as it stands: its picks, its typed blanks and the Book revision they were set against. */
  from: { picks: PaperPicks; typed: Record<string, string> | null; bookRevision: number }
  /** What the office asks for, against the Book's revision of today. */
  to: { picks: unknown; typed: unknown; bookRevision: number }
  /** How many signed copies the row holds. One or more locks it. */
  signed: number
}

export type SettingsChangePlan =
  | { kind: 'nothing'; change: PicksChange; words: string }
  | { kind: 'refused'; change: PicksChange; words: string }
  | { kind: 'saved'; change: PicksChange }
  | { kind: 'revised'; change: PicksChange; signAgain: number }

/**
 * What `job_paper_set_settings` will do with a change. Until someone signs, the row changes in place. After the first
 * signature the row is locked: a change may only tighten, and it makes a new row that everyone signs again. The same
 * picks with new typed words, or at a newer Book revision, are a change too.
 */
export function settingsChangePlan(c: SettingsChange): SettingsChangePlan {
  const picks = cleanPicks(c.def, c.to.picks)
  const problem = picksProblem(c.def, picks)
  const change = picksChange(c.def, c.from.picks, picks)
  if (problem) return { kind: 'refused', change, words: problem }
  if (change === 'same' && sameBag(c.from.typed, cleanTyped(c.def, c.to.typed)) && c.from.bookRevision === c.to.bookRevision) {
    return { kind: 'nothing', change, words: JOB_SETTINGS_WORDS.nothingChanged }
  }
  if (c.signed <= 0) return { kind: 'saved', change }
  if (change === 'looser' || change === 'mixed') return { kind: 'refused', change, words: JOB_SETTINGS_WORDS.stricterOnly }
  return { kind: 'revised', change, signAgain: c.signed }
}

/** A paper as the seal reads it: the database's JSON, or a signed copy's. Anything else on it is left out. */
export interface SealedPaper {
  paperId?: unknown
  lang?: unknown
  settings?: unknown
  fields?: unknown
  clauses?: unknown
  exhibit?: unknown
  exhibitFor?: unknown
}

const word = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v : String(v))
const utf8 = new TextEncoder()
/** One piece of the seal's text: its length in bytes, a colon, the piece and a comma, so no two papers share a text. */
const piece = (v: unknown): string => {
  const s = word(v)
  return `${utf8.encode(s).length}:${s},`
}

/**
 * The text a paper's seal is the SHA-256 of (`contract_paper_seal`): the paper's id, its language, the picks and the
 * blanks by key, then each clause and each exhibit clause with its id, version, number and words, then the trades
 * the exhibit is for. The revision and the heading are not in it: the same settings and the same clause versions
 * seal the same. Keys are plain ASCII (`PAPER_KEY_RE`), so their order here is the database's.
 */
export function sealText(paper: SealedPaper): string {
  let text = piece('paper-seal-v1') + piece(paper.paperId) + piece(paper.lang)
  for (const part of ['settings', 'fields'] as const) {
    const bag = isBag(paper[part]) ? (paper[part] as Record<string, unknown>) : {}
    const keys = Object.keys(bag).sort()
    text += piece(`${part} ${keys.length}`)
    for (const k of keys) text += piece(k) + piece(bag[k])
  }
  for (const part of ['clauses', 'exhibit'] as const) {
    const lines = Array.isArray(paper[part]) ? (paper[part] as unknown[]) : []
    text += piece(`${part} ${lines.length}`)
    for (const l of lines) {
      const line = isBag(l) ? l : {}
      text += piece(line.id) + piece(line.v) + piece(line.n) + piece(line.text)
    }
  }
  const names = Array.isArray(paper.exhibitFor) ? paper.exhibitFor : []
  text += piece(`exhibitFor ${names.length}`)
  for (const n of names) text += piece(n)
  return text
}

/** A paper's seal, as the database makes it. */
export function paperSeal(paper: SealedPaper, subtle?: SubtleCrypto): Promise<string> {
  return subtle ? sha256Hex(sealText(paper), subtle) : sha256Hex(sealText(paper))
}

/** What a signed copy of a job's paper keeps beside its clauses. */
export interface KeptJobSettings {
  picks: PaperPicks
  typed: Record<string, string>
  /** The picks in the list's own plain words, as they read on the day, in the language signed. */
  said: SummaryLine[]
  sha256: string
  jobPaperId: string
  settingsRevision: number
}

/** A signed copy's settings from its `clause_versions`, or null when the copy is not a job's paper built from settings. */
export function readKeptJobSettings(clauseVersions: unknown): KeptJobSettings | null {
  if (!isBag(clauseVersions)) return null
  const o = clauseVersions
  if (!isBag(o.settings) || typeof o.sha256 !== 'string' || typeof o.jobPaperId !== 'string' || typeof o.settingsRevision !== 'number') return null
  const strings = (bag: unknown): Record<string, string> => Object.fromEntries(Object.entries(isBag(bag) ? bag : {}).filter((e): e is [string, string] => typeof e[1] === 'string'))
  const said: SummaryLine[] = (Array.isArray(o.said) ? o.said : []).filter(isBag).map((s) => ({ key: word(s.key), label: word(s.label), choice: word(s.choice), says: word(s.says), out: s.out === true }))
  return { picks: strings(o.settings), typed: strings(o.fields), said, sha256: o.sha256, jobPaperId: o.jobPaperId, settingsRevision: o.settingsRevision }
}

/** Whether a signed copy's words still match its seal. Null when the copy carries none. */
export async function sealHolds(clauseVersions: unknown, subtle?: SubtleCrypto): Promise<boolean | null> {
  const kept = readKeptJobSettings(clauseVersions)
  if (!kept) return null
  return (await paperSeal(clauseVersions as SealedPaper, subtle)) === kept.sha256
}

/** The line under a signed copy's settings: that its words are the ones sealed when it was signed, or that they are not. */
export const SEAL_WORDS = {
  holds: 'These are the words that were signed. Their seal matches.',
  broken: 'The seal does not match these words. Tell the developer.',
} as const
