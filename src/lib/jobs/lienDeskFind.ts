/**
 * Find on the Lien desk's list (v2.4721, Taunya's ask: *on the left menu, I want to be able to
 * search*). One box under Send the run narrows every pile as she types. It matches the words a
 * row shows — the job number, the name, the GC, the months, the state, the supply house — and
 * two things a row keeps quiet because a caller says them first: the job's street and the owner
 * of record. A hidden fact that matched is written into the row so the hit makes sense. The
 * piles keep their titles with *2 of 12*; one match selects itself. Pure: words in, verdicts out.
 */

export type LienFindFact = { label: string; text: string }

export type LienFindFacts = {
  /** What the row already shows, as plain strings. */
  shown: ReadonlyArray<string>
  /** What it does not: the address, the owner. Written into the row when they match. */
  hidden: ReadonlyArray<LienFindFact>
}

export const LIEN_FIND_PLACEHOLDER = 'Find a job, a GC, an address or an owner'

/** The typed words, lower-cased, split on spaces; empty when there is nothing to find. */
export function lienFindWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).map((w) => w.trim()).filter(Boolean)
}

/** Every word must land somewhere on the row; the hidden facts any word landed on come back for the row to show. */
export function lienFindMatch(f: LienFindFacts, words: ReadonlyArray<string>): { ok: boolean; hits: LienFindFact[] } {
  if (!words.length) return { ok: true, hits: [] }
  const shown = f.shown.join(' ').toLowerCase()
  const hidden = f.hidden.map((h) => ({ ...h, lower: h.text.toLowerCase() }))
  const ok = words.every((w) => shown.includes(w) || hidden.some((h) => h.lower.includes(w)))
  if (!ok) return { ok: false, hits: [] }
  return { ok: true, hits: hidden.filter((h) => words.some((w) => h.lower.includes(w))).map(({ label, text }) => ({ label, text })) }
}

/** The text split where a word lands, so the row can mark the hit. Case kept; the first word that lands wins at each spot. */
export function lienFindParts(text: string, words: ReadonlyArray<string>): { text: string; hit: boolean }[] {
  if (!words.length || !text) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  let at = 0
  while (at < text.length) {
    let best: { i: number; len: number } | null = null
    for (const w of words) {
      const i = lower.indexOf(w, at)
      if (i >= 0 && (best == null || i < best.i)) best = { i, len: w.length }
    }
    if (!best) break
    if (best.i > at) parts.push({ text: text.slice(at, best.i), hit: false })
    parts.push({ text: text.slice(best.i, best.i + best.len), hit: true })
    at = best.i + best.len
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false })
  return parts.length ? parts : [{ text, hit: false }]
}

/** "1 job" · "4 jobs" — beside the box while finding. */
export function lienFindCountWords(n: number): string {
  return `${n} ${n === 1 ? 'job' : 'jobs'}`
}

/** A pile's count while finding: "2 of 12"; the plain count otherwise. */
export function lienFindPileCount(matched: number, total: number, finding: boolean): string {
  return finding ? `${matched} of ${total}` : String(total)
}

/** The empty state: what to try, and where else the job may be. */
export function lienFindNothingWords(query: string): { head: string; tryWords: string; elsewhere: string } {
  return {
    head: `Nothing matches “${query.trim()}”.`,
    tryWords: 'Try the job number, the GC, the street or the owner’s name.',
    elsewhere: 'A notice already sent is under Sent · 30d, or ask ☎ Someone’s calling, which searches every job the desk ever sent.',
  }
}

/** The one job a find narrowed to, which selects itself; null for none or several. */
export function lienFindSingle<T extends { jobId: string }>(rows: ReadonlyArray<T>, finding: boolean): string | null {
  return finding && rows.length === 1 ? rows[0]!.jobId : null
}
