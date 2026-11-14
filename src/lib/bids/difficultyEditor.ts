/**
 * GC difficulty rating (punch list #357, PR 1): the dev's edits to a draft of the criteria, as pure operations.
 *
 * Settings → Difficulty criteria holds one draft at a time. Every press on the card is one function here that takes a
 * body and gives a new one back, so the card holds no logic and the rules are tested without it. `diffDifficultyCriteria`
 * says what a draft changes against the published version, line by line, for the chip and the publish window.
 *
 * A scale's key is what carries a GC's pick from one version to the next (`difficultyCriteria.ts`), so the card lets a
 * key be changed only on a scale the published version does not have (`keyIsLocked`).
 */
import {
  DIFFICULTY_SCALE_KEY_RE,
  type DifficultyCriteriaBody,
  type DifficultyRung,
  type DifficultyScale,
  type DifficultyScope,
  type DifficultySource,
} from './difficultyCriteria'

const clone = (body: DifficultyCriteriaBody): DifficultyCriteriaBody => ({
  scales: body.scales.map((s) => ({ ...s, rungs: s.rungs.map((r) => ({ ...r })) })),
})

/** A draft starts as a copy of the published version. */
export function startDifficultyDraft(published: DifficultyCriteriaBody | null): DifficultyCriteriaBody {
  return published ? clone(published) : { scales: [] }
}

/** A key no scale in the body has: `scale_2`, `scale_3`, … */
export function freeDifficultyKey(body: DifficultyCriteriaBody, base = 'scale'): string {
  const taken = new Set(body.scales.map((s) => s.key))
  for (let n = 1; ; n++) {
    const key = `${base}_${n}`
    if (!taken.has(key)) return key
  }
}

/** A new picked scale on the GC with two empty rungs, 0 and 1. */
export function addDifficultyScale(body: DifficultyCriteriaBody): DifficultyCriteriaBody {
  const next = clone(body)
  next.scales.push({
    key: freeDifficultyKey(next),
    name: '',
    scope: 'gc',
    source: 'picked',
    max: 1,
    rungs: [
      { points: 0, sentence: '' },
      { points: 1, sentence: '' },
    ],
  })
  return next
}

export function removeDifficultyScale(body: DifficultyCriteriaBody, key: string): DifficultyCriteriaBody {
  return { scales: clone(body).scales.filter((s) => s.key !== key) }
}

export function moveDifficultyScale(body: DifficultyCriteriaBody, key: string, dir: -1 | 1): DifficultyCriteriaBody {
  const next = clone(body)
  const i = next.scales.findIndex((s) => s.key === key)
  const j = i + dir
  if (i < 0 || j < 0 || j >= next.scales.length) return next
  const [s] = next.scales.splice(i, 1)
  next.scales.splice(j, 0, s!)
  return next
}

function patchScale(body: DifficultyCriteriaBody, key: string, patch: (s: DifficultyScale) => void): DifficultyCriteriaBody {
  const next = clone(body)
  const s = next.scales.find((x) => x.key === key)
  if (s) patch(s)
  return next
}

export function setDifficultyScaleName(body: DifficultyCriteriaBody, key: string, name: string): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    s.name = name
  })
}

/** Lower-cases and trims what is typed; the rule itself is checked at publish. */
export function setDifficultyScaleKey(body: DifficultyCriteriaBody, key: string, newKey: string): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    s.key = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32)
  })
}

export function setDifficultyScaleScope(body: DifficultyCriteriaBody, key: string, scope: DifficultyScope): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    s.scope = scope
  })
}

export function setDifficultyScaleSource(body: DifficultyCriteriaBody, key: string, source: DifficultySource): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    s.source = source
  })
}

/** A bills scale with no rungs keeps its own maximum; a scale with rungs takes the last rung's. */
export function setDifficultyScaleMax(body: DifficultyCriteriaBody, key: string, max: number): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    if (s.rungs.length === 0) s.max = Math.max(1, Math.trunc(max))
  })
}

const syncMax = (s: DifficultyScale) => {
  if (s.rungs.length > 0) s.max = s.rungs[s.rungs.length - 1]!.points
}

/** One more rung after the last, one point higher, no sentence yet. */
export function addDifficultyRung(body: DifficultyCriteriaBody, key: string): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    const last = s.rungs[s.rungs.length - 1]
    s.rungs.push({ points: last ? last.points + 1 : 0, sentence: '' })
    syncMax(s)
  })
}

export function removeDifficultyRung(body: DifficultyCriteriaBody, key: string, index: number): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    s.rungs.splice(index, 1)
    syncMax(s)
  })
}

export function setDifficultyRungPoints(body: DifficultyCriteriaBody, key: string, index: number, points: number): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    const r = s.rungs[index]
    if (r) r.points = Number.isFinite(points) ? Math.trunc(points) : r.points
    syncMax(s)
  })
}

export function setDifficultyRungSentence(body: DifficultyCriteriaBody, key: string, index: number, sentence: string): DifficultyCriteriaBody {
  return patchScale(body, key, (s) => {
    const r = s.rungs[index]
    if (r) r.sentence = sentence
  })
}

/** A key the published version has carries ratings, so the card does not let it change. */
export function difficultyKeyIsLocked(published: DifficultyCriteriaBody | null, key: string): boolean {
  return published != null && published.scales.some((s) => s.key === key)
}

export type DifficultyChange = { key: string; line: string }

const rungWords = (r: DifficultyRung) => `${r.points} point${r.points === 1 ? '' : 's'}`

/** What a draft changes against the published version, one line each, in the draft's order. */
export function diffDifficultyCriteria(published: DifficultyCriteriaBody | null, draft: DifficultyCriteriaBody): DifficultyChange[] {
  const out: DifficultyChange[] = []
  const was = new Map((published?.scales ?? []).map((s) => [s.key, s] as const))
  for (const s of draft.scales) {
    const name = s.name.trim() || s.key || 'a new scale'
    const old = was.get(s.key)
    if (!old) {
      out.push({ key: s.key, line: `${name} added${s.scope === 'bid' ? ', on the bid' : ''}${s.source === 'bills' ? ', read from bills' : ''}.` })
      continue
    }
    if (old.name !== s.name) out.push({ key: s.key, line: `${old.name} renamed to ${name}.` })
    if (old.scope !== s.scope) out.push({ key: s.key, line: `${name} moves to ${s.scope === 'bid' ? 'the bid' : 'the GC'}.` })
    if (old.source !== s.source) out.push({ key: s.key, line: `${name} is now ${s.source === 'bills' ? 'read from bills' : 'picked by a person'}.` })
    if (old.max !== s.max) out.push({ key: s.key, line: `${name}: the maximum is ${s.max}, was ${old.max}.` })
    const oldRungs = new Map(old.rungs.map((r) => [r.points, r.sentence] as const))
    for (const r of s.rungs) {
      const oldSentence = oldRungs.get(r.points)
      if (oldSentence == null) out.push({ key: s.key, line: `${name}: a rung at ${rungWords(r)} added.` })
      else if (oldSentence !== r.sentence) out.push({ key: s.key, line: `${name}: the ${rungWords(r)} rung reworded.` })
    }
    for (const r of old.rungs) {
      if (!s.rungs.some((x) => x.points === r.points)) out.push({ key: s.key, line: `${name}: the ${rungWords(r)} rung removed. A GC on it becomes unrated here.` })
    }
  }
  for (const s of was.values()) {
    if (!draft.scales.some((x) => x.key === s.key)) out.push({ key: s.key, line: `${s.name} removed. Every GC becomes unrated on it.` })
  }
  return out
}

export function difficultyChangeCountWords(n: number): string {
  if (n === 0) return 'no changes yet'
  return `${n} change${n === 1 ? '' : 's'}`
}

/** The key as the rule wants it, or null while it is still being typed badly. */
export function difficultyKeyOk(key: string): boolean {
  return DIFFICULTY_SCALE_KEY_RE.test(key)
}

/** The sample picks the preview draws: every scale at its first rung. */
export function difficultyPreviewPicks(body: DifficultyCriteriaBody): Record<string, number> {
  const picks: Record<string, number> = {}
  for (const s of body.scales) {
    const r = s.rungs[Math.min(1, s.rungs.length - 1)]
    if (r) picks[s.key] = r.points
  }
  return picks
}
