/**
 * The audit card in the envelope's shape (punch list #63, PR 5, v2.4261). The card used to
 * open with a 150-word confession, then every bucket's rows — 17 missed · 30 added · 17
 * gaps with ~75 verdict buttons — and four of the eight "missed" rows were the same item as
 * an "added" row under another name (RENTALS/TRAVEL −$20,000 ↔ Travel & Rentals +$19,920),
 * so the estimator judged one difference twice and the waterfall counted it both ways.
 *
 * Now: the six biggest differences first (the envelope's rule, `pickEnvelopeRows`), with a
 * missed ↔ added pair that looks like one item shown as ONE row that offers "Same item —
 * teach the name"; the rest, the pairs and the system table under folds; the confession
 * cut to its first two sentences. Pure: no React.
 */
import type { DiffBucketKey, DiffEntry, TakeoffDiff } from './takeoffDiff'

export type AliasPair = {
  /** Ours, which the robot lacks by that name. */
  missed: DiffEntry
  /** The robot's, which we lack by that name. */
  added: DiffEntry
  reason: 'words' | 'initials' | 'count'
}

const words = (label: string): string[] =>
  label
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9/& ]/g, ' ')
    .split(/[\s/&]+/)
    .filter((w) => w && !['of', 'the', 'per', 'and', 'ft', 'ea'].includes(w))

/**
 * 'EEW' reads as Emergency EyeWash, 'OM-1' as Oxygen Manifold, 'S-3' as Service/Mop Basin:
 * the tag's letters, in order, are letters of the long name with the first at its start and
 * at least half of them at word starts.
 */
function initialsMatch(short: string, long: string): boolean {
  const letters = short.toLowerCase().replace(/[^a-z]/g, '')
  if (letters.length < 1 || letters.length > 4) return false
  const ws = words(long)
  if (ws.length < 2) return false
  const joined = ws.join('')
  const starts = new Set<number>()
  let at = 0
  for (const w of ws) {
    starts.add(at)
    at += w.length
  }
  if (joined[0] !== letters[0]) return false
  let pos = 0
  let onStarts = 0
  for (const ch of letters) {
    // A word start with this letter first (EEW → Emergency EyeWash takes the E of Eyewash), else the next such letter.
    const atStart = [...starts].filter((i) => i >= pos && joined[i] === ch).sort((a, b) => a - b)[0]
    const idx = atStart ?? joined.indexOf(ch, pos)
    if (idx < 0) return false
    if (starts.has(idx)) onStarts++
    pos = idx + 1
  }
  return onStarts >= Math.ceil(letters.length / 2)
}

/** 'RENTALS/TRAVEL' and 'Travel & Rentals (per mile)' share the words travel and rentals. */
function shareWord(a: string, b: string): boolean {
  const wa = new Set(words(a).filter((w) => w.length >= 3))
  return words(b).some((w) => w.length >= 3 && wa.has(w))
}

const closeDollars = (a: number, b: number, tol: number) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= tol

/**
 * Missed ↔ added pairs that look like one item under two names: a shared word with the
 * dollars within 25% (or the same count), the short name's letters the long name's
 * initials, or the same count with the dollars within 15%. A dollar coincidence alone
 * never pairs (RENTALS/TRAVEL $20,000 is not Med Gas Outlet $19,950). Greedy: the surer
 * reason first, then dollar closeness; each entry pairs at most once.
 */
export function pairAliases(diff: Pick<TakeoffDiff, 'missed' | 'added'>): AliasPair[] {
  const tier: Record<AliasPair['reason'], number> = { words: 0, initials: 1, count: 2 }
  const candidates: Array<AliasPair & { gap: number }> = []
  for (const m of diff.missed) {
    for (const a of diff.added) {
      const gap = Math.abs(m.ourExt - a.robotExt) / Math.max(m.ourExt, a.robotExt, 1)
      const reason: AliasPair['reason'] | null = shareWord(m.label, a.label) && (closeDollars(m.ourExt, a.robotExt, 0.25) || m.ourCount === a.robotCount)
        ? 'words'
        : initialsMatch(m.label, a.label) || initialsMatch(a.label, m.label)
          ? 'initials'
          : m.ourCount === a.robotCount && closeDollars(m.ourExt, a.robotExt, 0.15)
            ? 'count'
            : null
      if (reason) candidates.push({ missed: m, added: a, reason, gap })
    }
  }
  candidates.sort((x, y) => tier[x.reason] - tier[y.reason] || x.gap - y.gap)
  const used = new Set<string>()
  const out: AliasPair[] = []
  for (const c of candidates) {
    if (used.has(`m:${c.missed.key}`) || used.has(`a:${c.added.key}`)) continue
    used.add(`m:${c.missed.key}`)
    used.add(`a:${c.added.key}`)
    out.push({ missed: c.missed, added: c.added, reason: c.reason })
  }
  return out.sort((x, y) => Math.max(Math.abs(y.missed.impact), Math.abs(y.added.impact)) - Math.max(Math.abs(x.missed.impact), Math.abs(x.added.impact)))
}

export type TopDifference =
  | { kind: 'entry'; bucket: DiffBucketKey; entry: DiffEntry; impact: number }
  | { kind: 'pair'; pair: AliasPair; impact: number }

export const TOP_DIFFERENCES_CAP = 6

/**
 * The few rows worth the estimator's minute: every bucket pooled, a pair standing for its
 * two rows, biggest dollar distance first, a missed row ahead on a tie (the dangerous
 * kind), capped at six. `hidden` is what the fold holds — the other rows and pairs.
 */
export function topDifferences(diff: TakeoffDiff, pairs: readonly AliasPair[], cap = TOP_DIFFERENCES_CAP): { rows: TopDifference[]; hidden: number } {
  const pairedMissed = new Set(pairs.map((p) => p.missed.key))
  const pairedAdded = new Set(pairs.map((p) => p.added.key))
  const pool: TopDifference[] = []
  const buckets: DiffBucketKey[] = ['missed', 'added', 'gaps', 'rates']
  for (const bucket of buckets) {
    for (const entry of diff[bucket]) {
      if ((bucket === 'missed' && pairedMissed.has(entry.key)) || (bucket === 'added' && pairedAdded.has(entry.key))) continue
      pool.push({ kind: 'entry', bucket, entry, impact: entry.robotExt - entry.ourExt })
    }
  }
  for (const pair of pairs) pool.push({ kind: 'pair', pair, impact: Math.max(Math.abs(pair.missed.impact), Math.abs(pair.added.impact)) })
  const rank = (r: TopDifference) => (r.kind === 'entry' && r.bucket === 'missed' ? 1 : 0)
  pool.sort((a, b) => {
    const d = Math.abs(b.impact) - Math.abs(a.impact)
    if (Math.abs(d) > 0.5) return d
    return rank(b) - rank(a)
  })
  return { rows: pool.slice(0, cap), hidden: Math.max(0, pool.length - cap) }
}

/** The tag the digest reads (FEEDBACK_LOOP → Verdict tags): one item under two names — teach the robot the name. */
export const AUDIT_ALIAS_TAG = '[verdict:alias]'

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const fmtUsd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`

/** The note "Same item — teach the name" posts: ours = the robot's, with both sides' counts and dollars. */
export function buildAliasNote(pair: AliasPair): string {
  return `${AUDIT_ALIAS_TAG} ${pair.missed.label} = ${pair.added.label} — one item, two names; teach the name (ours ×${fmtQty(pair.missed.ourCount)} ${fmtUsd(pair.missed.ourExt)}, robot ×${fmtQty(pair.added.robotCount)} ${fmtUsd(pair.added.robotExt)}).`
}

/** 'RENTALS/TRAVEL ↔ Travel & Rentals (per mile)' — the fold's list of pairs. */
export function pairLabel(pair: AliasPair): string {
  return `${pair.missed.label} ↔ ${pair.added.label}`
}

/**
 * The confession's lead: its first two sentences, and how many words the rest holds
 * (null when two sentences is all of it).
 */
export function selfAssessmentLead(text: string): { lead: string; restWords: number } {
  const t = text.replace(/\s+/g, ' ').trim()
  const sentences = t.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [t]
  if (sentences.length <= 2) return { lead: t, restWords: 0 }
  const lead = sentences.slice(0, 2).join(' ')
  const rest = sentences.slice(2).join(' ')
  return { lead, restWords: rest.split(/\s+/).filter(Boolean).length }
}
