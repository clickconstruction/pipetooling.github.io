/**
 * GC difficulty rating (punch list #357, PR 1): the criteria a GC is rated on, and the rules that hold them.
 *
 * A GC is rated once, on its record, in sentences a person picks from. The sentences are the dev's and are
 * versioned (`difficulty_criteria_versions`): a published version is immutable, the dev edits a draft and publishes
 * the next version, and a rating or a priced bid pins to the version it was made under. This file is the shape of one
 * version's `body`, the rules a body must keep before it can be published, the points a set of picks adds up to, and
 * the carry-over rule that moves a GC's picks from one version to the next.
 *
 * The carry-over rule (the owner's call of 2026-11-14): a pick carries to a newer version only when its scale key and
 * its points value still exist there. A removed scale or rung leaves that scale unrated and the card says so. A new
 * scale starts unrated. Nothing is recomputed from old words onto new words. A bid already priced keeps its version,
 * its words and its lines (that part lives with the bid, PR 4).
 *
 * Pure: no React, no supabase. The database holds only the floor (an object with a `scales` array); everything here is
 * the client's and runs before a publish.
 */

export type DifficultyScope = 'gc' | 'bid'
export type DifficultySource = 'picked' | 'bills'

export type DifficultyRung = { points: number; sentence: string }

export type DifficultyScale = {
  /** Stable across versions; what carries a pick from one version to the next. `^[a-z][a-z0-9_]{0,31}$`. */
  key: string
  name: string
  /** On the GC's record (every bid to them reads it), or on the bid alone (the site). */
  scope: DifficultyScope
  /** Picked by a person from the rungs, or read from the GC's bills by the price list's rule. */
  source: DifficultySource
  /** The most points the scale gives; the last rung's points. */
  max: number
  /** In order of points, starting at 0. A bills scale may carry none. */
  rungs: DifficultyRung[]
}

export type DifficultyCriteriaBody = { scales: DifficultyScale[] }

/** A GC's picks under one version: scale key → points. A scale with no entry is unrated. */
export type DifficultyPicks = Record<string, number>

export const DIFFICULTY_SCALE_KEY_RE = /^[a-z][a-z0-9_]{0,31}$/
export const DIFFICULTY_SCALE_NAME_MAX = 60
export const DIFFICULTY_SENTENCE_MAX = 200
export const DIFFICULTY_SCALE_MAX_POINTS = 10

export const DIFFICULTY_SCOPES: ReadonlyArray<DifficultyScope> = ['gc', 'bid']
export const DIFFICULTY_SOURCES: ReadonlyArray<DifficultySource> = ['picked', 'bills']

/** Version 1, seeded by `20261114090000_difficulty_criteria_versions.sql`; the test holds the two equal. */
export const DIFFICULTY_CRITERIA_V1: DifficultyCriteriaBody = {
  scales: [
    {
      key: 'paying',
      name: 'Paying',
      scope: 'gc',
      source: 'bills',
      max: 1,
      rungs: [
        { points: 0, sentence: 'They pay at the GC pace, or faster.' },
        { points: 1, sentence: "They pay slow. Read from their bills against the price list's rule." },
      ],
    },
    {
      key: 'field',
      name: 'Field and superintendent',
      scope: 'gc',
      source: 'picked',
      max: 3,
      rungs: [
        { points: 0, sentence: 'The super sets a schedule and keeps it. Our crew walks on and works.' },
        { points: 1, sentence: 'Small surprises. A locked gate, a late inspection, a trade in our way for a day.' },
        { points: 2, sentence: 'The order of work changes after we mobilize, or the site is not ready when they call us out.' },
        { points: 3, sentence: 'We remobilize more than once, the super fights every change order, or our crew waits on them every week.' },
      ],
    },
    {
      key: 'office',
      name: 'Their office',
      scope: 'gc',
      source: 'picked',
      max: 2,
      rungs: [
        { points: 0, sentence: 'Pay apps go through the first time. One call settles a question.' },
        { points: 1, sentence: 'Pay apps come back for paperwork, lien waivers are asked for twice, a question waits a week.' },
        { points: 2, sentence: 'Every bill is a fight, or nobody at their office can be reached.' },
      ],
    },
  ],
}

const isRecord = (v: unknown): v is Record<string, unknown> => v != null && typeof v === 'object' && !Array.isArray(v)

const asInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function parseRung(raw: unknown): DifficultyRung | null {
  if (!isRecord(raw)) return null
  const points = asInt(raw.points)
  if (points == null) return null
  return { points, sentence: typeof raw.sentence === 'string' ? raw.sentence : '' }
}

function parseScale(raw: unknown): DifficultyScale | null {
  if (!isRecord(raw)) return null
  const key = typeof raw.key === 'string' ? raw.key : ''
  const name = typeof raw.name === 'string' ? raw.name : ''
  const scope: DifficultyScope = raw.scope === 'bid' ? 'bid' : 'gc'
  const source: DifficultySource = raw.source === 'bills' ? 'bills' : 'picked'
  const rungsRaw = Array.isArray(raw.rungs) ? raw.rungs : []
  const rungs = rungsRaw.map(parseRung).filter((r): r is DifficultyRung => r != null)
  const max = asInt(raw.max) ?? (rungs.length > 0 ? rungs[rungs.length - 1]!.points : 0)
  return { key, name, scope, source, max, rungs }
}

/**
 * The body as the row holds it. Lenient on shape (a draft can be half typed); strict rules are
 * `difficultyCriteriaProblems`. Null when the value is not an object with a `scales` array at all.
 */
export function parseDifficultyCriteriaBody(raw: unknown): DifficultyCriteriaBody | null {
  const obj = typeof raw === 'string' ? safeJson(raw) : raw
  if (!isRecord(obj) || !Array.isArray(obj.scales)) return null
  return { scales: obj.scales.map(parseScale).filter((s): s is DifficultyScale => s != null) }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** The rules a body must keep before it is published. Each line is one a person can act on; an empty list is a pass. */
export function difficultyCriteriaProblems(body: DifficultyCriteriaBody): string[] {
  const problems: string[] = []
  if (body.scales.length === 0) problems.push('A version needs at least one scale.')
  const seen = new Set<string>()
  body.scales.forEach((s, i) => {
    const who = s.name.trim() !== '' ? s.name.trim() : `scale ${i + 1}`
    if (!DIFFICULTY_SCALE_KEY_RE.test(s.key)) problems.push(`${who}: the key is lower-case letters, digits and underscores, starting with a letter.`)
    else if (seen.has(s.key)) problems.push(`${who}: the key ${s.key} is already on another scale.`)
    seen.add(s.key)
    if (s.name.trim() === '') problems.push(`Scale ${i + 1} (${s.key || 'no key'}): give it a name.`)
    else if (s.name.trim().length > DIFFICULTY_SCALE_NAME_MAX) problems.push(`${who}: the name is over ${DIFFICULTY_SCALE_NAME_MAX} characters.`)
    if (!DIFFICULTY_SCOPES.includes(s.scope)) problems.push(`${who}: the scope is gc or bid.`)
    if (!DIFFICULTY_SOURCES.includes(s.source)) problems.push(`${who}: the source is picked or bills.`)
    if (!Number.isInteger(s.max) || s.max < 1 || s.max > DIFFICULTY_SCALE_MAX_POINTS) problems.push(`${who}: the maximum is a whole number from 1 to ${DIFFICULTY_SCALE_MAX_POINTS}.`)
    if (s.source === 'picked' && s.rungs.length < 2) problems.push(`${who}: a picked scale needs at least two rungs.`)
    if (s.rungs.length > 0) {
      const first = s.rungs[0]!
      if (first.points !== 0) problems.push(`${who}: the first rung is 0 points.`)
      const last = s.rungs[s.rungs.length - 1]!
      if (last.points !== s.max) problems.push(`${who}: the last rung is the maximum, ${s.max}.`)
      s.rungs.forEach((r, j) => {
        if (!Number.isInteger(r.points) || r.points < 0) problems.push(`${who}: rung ${j + 1} has points that are not a whole number.`)
        if (j > 0 && r.points <= s.rungs[j - 1]!.points) problems.push(`${who}: rung ${j + 1} must have more points than the rung before it.`)
        if (r.sentence.trim() === '') problems.push(`${who}: rung ${j + 1} (${r.points} point${r.points === 1 ? '' : 's'}) has no sentence.`)
        else if (r.sentence.trim().length > DIFFICULTY_SENTENCE_MAX) problems.push(`${who}: rung ${j + 1} is over ${DIFFICULTY_SENTENCE_MAX} characters.`)
      })
    }
  })
  return problems
}

/** The most points a GC can carry under this version: the scales' maximums added up. */
export function difficultyMaxPoints(body: DifficultyCriteriaBody, scope?: DifficultyScope): number {
  return body.scales.filter((s) => scope == null || s.scope === scope).reduce((n, s) => n + s.max, 0)
}

export function difficultyScale(body: DifficultyCriteriaBody, key: string): DifficultyScale | null {
  return body.scales.find((s) => s.key === key) ?? null
}

/** Whether a scale can carry this many points: a rung with that value, or for a bills scale with no rungs, 0 to max. */
export function difficultyScaleHasPoints(scale: DifficultyScale, points: number): boolean {
  if (!Number.isInteger(points) || points < 0) return false
  if (scale.rungs.length === 0) return scale.source === 'bills' && points <= scale.max
  return scale.rungs.some((r) => r.points === points)
}

/** The sentence a pick means under this version; null when the scale or the rung is not there. */
export function difficultyRungSentence(body: DifficultyCriteriaBody, key: string, points: number): string | null {
  const scale = difficultyScale(body, key)
  if (!scale) return null
  return scale.rungs.find((r) => r.points === points)?.sentence ?? null
}

export type DifficultyTotal = {
  points: number
  /** The keys that carry a pick this version knows. */
  rated: string[]
  /** This version's scales with no pick. */
  unrated: string[]
  /** Picks on a key or a rung this version does not have; they count for nothing. */
  stale: string[]
}

/** The points a GC's picks add up to under one version, and which scales are unrated. Only picks this version knows count. */
export function difficultyTotalPoints(picks: DifficultyPicks, body: DifficultyCriteriaBody, scope?: DifficultyScope): DifficultyTotal {
  const scales = body.scales.filter((s) => scope == null || s.scope === scope)
  let points = 0
  const rated: string[] = []
  const unrated: string[] = []
  for (const s of scales) {
    const p = picks[s.key]
    if (p != null && difficultyScaleHasPoints(s, p)) {
      points += p
      rated.push(s.key)
    } else unrated.push(s.key)
  }
  const stale = Object.keys(picks).filter((k) => {
    const s = difficultyScale(body, k)
    return !s || !difficultyScaleHasPoints(s, picks[k]!)
  })
  return { points, rated, unrated, stale }
}

export type DifficultyCarry = {
  picks: DifficultyPicks
  kept: string[]
  /** A pick that could not come along, and why. */
  dropped: { key: string; points: number; reason: 'scale gone' | 'rung gone' }[]
  /** The new version's scales with no pick after the carry: a dropped one, or a scale new in this version. */
  unrated: string[]
}

/**
 * The carry-over rule: a pick moves to a newer version only when its scale key and its points value still exist
 * there. Nothing is recomputed from old words onto new words. `from` is not read: the rule is about what `to` holds.
 */
export function carryDifficultyPicks(picks: DifficultyPicks, to: DifficultyCriteriaBody): DifficultyCarry {
  const out: DifficultyPicks = {}
  const kept: string[] = []
  const dropped: DifficultyCarry['dropped'] = []
  for (const [key, points] of Object.entries(picks)) {
    const scale = difficultyScale(to, key)
    if (!scale) dropped.push({ key, points, reason: 'scale gone' })
    else if (!difficultyScaleHasPoints(scale, points)) dropped.push({ key, points, reason: 'rung gone' })
    else {
      out[key] = points
      kept.push(key)
    }
  }
  const unrated = to.scales.filter((s) => out[s.key] == null).map((s) => s.key)
  return { picks: out, kept, dropped, unrated }
}

export function difficultyPointsWords(n: number): string {
  return `${n} point${n === 1 ? '' : 's'}`
}

/** "0 to 3". */
export function difficultyRangeWords(scale: DifficultyScale): string {
  return `0 to ${scale.max}`
}

export const DIFFICULTY_SOURCE_WORDS: Readonly<Record<DifficultySource, string>> = {
  picked: 'Picked by a person',
  bills: 'Read from their bills',
}

export const DIFFICULTY_SCOPE_WORDS: Readonly<Record<DifficultyScope, string>> = {
  gc: 'On the GC',
  bid: 'On the bid, not the GC',
}

/** "Version 2 · 2026-11-20 by Micah" — the published line's head. */
export function difficultyVersionWords(v: { version: number; publishedAt: string | null; publishedByName: string }): string {
  const day = v.publishedAt ? v.publishedAt.slice(0, 10) : ''
  const by = v.publishedByName.trim()
  const when = [day, by ? `by ${by}` : ''].filter(Boolean).join(' ')
  return when ? `Version ${v.version} · ${when}` : `Version ${v.version}`
}

/** The line under a card when a GC's picks do not all carry: which scales are unrated and why. */
export function difficultyUnratedWords(carry: DifficultyCarry, body: DifficultyCriteriaBody): string | null {
  if (carry.unrated.length === 0) return null
  const names = carry.unrated.map((k) => difficultyScale(body, k)?.name ?? k)
  const gone = carry.dropped.filter((d) => carry.unrated.includes(d.key)).length
  const head = names.length === 1 ? `${names[0]} is unrated under this version.` : `${names.join(', ')} are unrated under this version.`
  if (gone === 0) return head
  return `${head} ${gone === 1 ? 'A pick from an older version did not carry: its rung is gone.' : `${gone} picks from an older version did not carry: their rungs are gone.`}`
}
