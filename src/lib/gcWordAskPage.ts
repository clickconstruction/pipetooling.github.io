/**
 * The ask-by-link page's own logic (punch list #49, step 7): read what the
 * `gc-word-ask` function answered, start each row from what he already said,
 * and turn the rows he filled into what gets sent — checked by the same rule
 * the server runs, so the page and the server never disagree. Pure.
 */
import { validateWordAskAnswers, type WordAskAnswer, type WordAskGc, type WordAskTemperature } from './gcWordAsk'

export type GcWordAskPage = {
  ownerName: string
  askedByName: string
  weekStart: string
  expiresAt: string
  answeredAt: string | null
  gcs: WordAskGc[]
}

export type GcWordAskDraft = { temperature: WordAskTemperature | null; note: string; payBy: string; noChange: boolean }

const TEMPS = ['hot', 'warm', 'cool', 'cold']
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function parseGcWordAskPage(v: unknown): GcWordAskPage | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Record<string, unknown>
  if (!Array.isArray(p.gcs) || typeof p.expiresAt !== 'string') return null
  const gcs: WordAskGc[] = []
  for (const raw of p.gcs as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== 'object' || typeof raw.gcId !== 'string' || !raw.gcId) return null
    const lw = raw.lastWord as Record<string, unknown> | null | undefined
    const pr = raw.promise as Record<string, unknown> | null | undefined
    const an = raw.answer as Record<string, unknown> | null | undefined
    gcs.push({
      gcId: raw.gcId,
      gcName: str(raw.gcName) || '—',
      amount: Number(raw.amount ?? 0) || 0,
      oldestAgeDays: raw.oldestAgeDays == null ? null : Number(raw.oldestAgeDays),
      over90: Number(raw.over90 ?? 0) || 0,
      lastWord: lw && typeof lw === 'object' && str(lw.note) ? { temperature: str(lw.temperature) || null, note: str(lw.note), by: str(lw.by), at: str(lw.at) } : null,
      promise: pr && typeof pr === 'object' && str(pr.payBy) ? { payBy: str(pr.payBy), late: pr.late === true, daysLate: Number(pr.daysLate ?? 0) || 0 } : null,
      noChangeAllowed: raw.noChangeAllowed === true,
      answer: an && typeof an === 'object' ? { temperature: str(an.temperature) || null, note: str(an.note), payBy: str(an.payBy) || null, noChange: an.noChange === true, status: str(an.status) || 'pending' } : null,
    })
  }
  return { ownerName: str(p.ownerName), askedByName: str(p.askedByName), weekStart: str(p.weekStart), expiresAt: p.expiresAt, answeredAt: str(p.answeredAt) || null, gcs }
}

/** Each row starts from what he already answered, so coming back to the link is picking up where he left off. */
export function gcWordAskDraftsFromPage(page: Pick<GcWordAskPage, 'gcs'>): Record<string, GcWordAskDraft> {
  const out: Record<string, GcWordAskDraft> = {}
  for (const g of page.gcs) {
    const a = g.answer
    if (!a || a.status === 'accepted') continue
    out[g.gcId] = { temperature: TEMPS.includes(String(a.temperature)) ? (a.temperature as WordAskTemperature) : null, note: a.noChange ? '' : a.note, payBy: a.payBy ?? '', noChange: a.noChange }
  }
  return out
}

/**
 * What would be sent right now. `answers` are the rows that are complete;
 * `problem` names the first row he started and did not finish — sending waits
 * on it, so a half-typed sentence is never silently dropped.
 */
export function gcWordAskSubmission(page: Pick<GcWordAskPage, 'gcs'>, drafts: Readonly<Record<string, GcWordAskDraft>>): { answers: WordAskAnswer[]; problem: string | null } {
  const open = page.gcs.filter((g) => g.answer?.status !== 'accepted')
  const input = open.flatMap((g) => {
    const d = drafts[g.gcId]
    return d ? [{ gcId: g.gcId, temperature: d.temperature, note: d.note, payBy: d.payBy, noChange: d.noChange }] : []
  })
  const all = validateWordAskAnswers(input, open)
  if (all.ok) return { answers: all.answers, problem: null }
  // Row by row: keep the ones that stand on their own, and name the one that does not.
  const answers: WordAskAnswer[] = []
  let problem: string | null = null
  for (const one of input) {
    const r = validateWordAskAnswers([one], open)
    if (r.ok) answers.push(...r.answers)
    else if (r.error !== 'Nothing to save — answer at least one GC.' && !problem) problem = r.error
  }
  return { answers, problem }
}
