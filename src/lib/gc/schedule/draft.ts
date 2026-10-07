/**
 * GC mode, the real build, the schedule's PR 1a: the first draft from the stages of the job, moved word
 * for word from the GC mode prototype (branch spike/gc-mode, `gcNewProject.ts`, which the New project
 * lane wrote): the rough-ins side by side after framing, close-in after the inspection, the trims
 * after the finishes, or a template's lines (G-44).
 */
import type { ProjectSchedule, ScheduleActivity, ScheduleMilestone, TemplateLine } from './types'
import type { GcProject, TradePackage } from '../types'

// ---------------------------------------------------------------------------------------------
// The schedule's first draft: what waits on what, from the stages of the job
// ---------------------------------------------------------------------------------------------

/**
 * The stages a job goes through, in the order they are drawn. Each waits on the stage named in
 * `after` (or the nearest earlier one the job has). Site finish waits only on dry-in, so paving
 * and site lighting run beside the work inside (G-143: inside a trade too, see `stageChain`).
 * `days` is a first-draft length; `lag` is days between the stage before and this one. The
 * rough-in and final inspections are activities of their own (the owner, 2026-10-03), drawn by
 * `scheduleDraft`, not waits on a link.
 */
export const SCHEDULE_STAGES: { key: string; label: string; after: string | null; days: number; lag?: number }[] = [
  { key: 'sitePrep', label: 'Site prep', after: null, days: 10 },
  { key: 'foundations', label: 'Foundations', after: 'sitePrep', days: 10 },
  { key: 'underground', label: 'Underground', after: 'foundations', days: 5 },
  { key: 'slab', label: 'Slab', after: 'underground', days: 5 },
  { key: 'structure', label: 'Structure', after: 'slab', days: 15 },
  { key: 'dryIn', label: 'Dry-in', after: 'structure', days: 10 },
  { key: 'framing', label: 'Framing', after: 'dryIn', days: 10 },
  { key: 'roughIn', label: 'Rough-in', after: 'framing', days: 15 },
  { key: 'closeIn', label: 'Close-in', after: 'roughIn', days: 10 },
  { key: 'finishes', label: 'Finishes', after: 'closeIn', days: 10 },
  { key: 'trim', label: 'Trim', after: 'finishes', days: 7 },
  { key: 'siteFinish', label: 'Site finish', after: 'dryIn', days: 10 },
  { key: 'closeout', label: 'Closeout', after: 'trim', days: 5 },
]

/**
 * A stage and every stage it comes after, along `after` (G-143). Inside a trade, a line waits on
 * the trade's line before it among these stages only, so a crew does its lines one after another
 * on each stage's own path. Every stage but two comes right after the one listed before it, so its
 * chain is every stage listed before it. Site finish comes after dry-in: a site line waits on the
 * trade's earlier site line, or its last line before dry-in, never its framing, rough-ins,
 * close-in, finishes or trims. Closeout comes after trim, so a closeout line never waits on a site
 * line.
 */
export function stageChain(key: string): Set<string> {
  const chain = new Set<string>()
  let at: string | null = key
  while (at && !chain.has(at)) {
    chain.add(at)
    at = SCHEDULE_STAGES.find((st) => st.key === at)?.after ?? null
  }
  return chain
}

/** How long an inspection runs in the first draft, in days. The office changes it. */
export const INSPECTION_DAYS = 2

/** Words in a line's name that put it in a stage, the most telling first ("rooftop units" is rough-in, not roofing). */
const STAGE_WORDS: [string, string[]][] = [
  ['closeout', ['test and balance', 'commissioning', 'start-up']],
  ['siteFinish', ['site lighting', 'sidewalk', 'striping', 'paving', 'drive-through', 'parking', 'planting', 'irrigation', 'sod', 'seed', 'landscap']],
  ['trim', ['heads and trim', 'trim', 'lighting', 'devices', 'fire alarm', 'fixtures', 'controls']],
  ['roughIn', ['rooftop unit', 'split system', 'rough', 'top out', 'duct', 'mains', 'branch line', 'service and gear', 'panels', 'feeders', 'equipment', 'low voltage']],
  ['underground', ['underground', 'utilities']],
  ['sitePrep', ['clearing', 'grading', 'demolition', 'excavation', 'design and permit']],
  ['foundations', ['foundation', 'footing', 'rebar']],
  ['slab', ['slab']],
  ['structure', ['structural steel', 'joist', 'deck', 'erection', 'block wall', 'brick', 'grout', 'masonry']],
  ['dryIn', ['membrane', 'roof', 'sheet metal', 'flashing', 'storefront', 'glass', 'sealant', 'window', 'insulation']],
  ['framing', ['framing', 'frames']],
  ['closeIn', ['hang and tape', 'drywall', 'gypsum', 'ceiling']],
  ['finishes', ['paint', 'tile', 'carpet', 'vinyl', 'base', 'cabinet', 'countertop', 'casework', 'millwork', 'desk', 'doors', 'hardware', 'install', 'flooring']],
]

/** The stage a trade's work falls in when a line's name does not say. */
const TRADE_STAGE: Record<string, string> = {
  Sitework: 'sitePrep',
  Landscaping: 'siteFinish',
  Concrete: 'foundations',
  Masonry: 'structure',
  'Structural steel': 'structure',
  'Framing and drywall': 'framing',
  Roofing: 'dryIn',
  'Doors and hardware': 'finishes',
  'Glass and storefront': 'dryIn',
  Painting: 'finishes',
  Flooring: 'finishes',
  Millwork: 'finishes',
  'Fire sprinkler': 'roughIn',
  Plumbing: 'roughIn',
  HVAC: 'roughIn',
  Electrical: 'roughIn',
}

/** The stage of the job one line belongs to: from its name, or from its trade when the name does not say. */
export function lineStage(trade: string, label: string): string {
  const name = label.toLowerCase()
  for (const [stage, words] of STAGE_WORDS) if (words.some((w) => name.includes(w))) return stage
  return TRADE_STAGE[trade] ?? 'finishes'
}

function plusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}

/** A line's key in a template (G-44): its trade and its name, the name matched whatever the case and spacing. An inspection's trade is empty. */
export function templateKey(trade: string, label: string): string {
  return `${trade}|${label.trim().replace(/\s+/g, ' ').toLowerCase()}`
}

/** The lines a trade's activities are drawn from: its schedule of values, or its scope (our own crew, or before one). */
function draftLines(pkg: TradePackage): { lineId: string; label: string }[] {
  if (pkg.sow && !pkg.selfPerform) return pkg.sow.sov.map((l) => ({ lineId: l.id, label: l.label }))
  return pkg.scope.map((l) => ({ lineId: l.id, label: l.label }))
}

/**
 * The schedule's first draft, from the stages of the job: every line of every trade, each in its
 * stage. A stage starts when the stage before it is done, so the trades' rough-ins run side by
 * side after framing, close-in waits on all of them and the inspection, and the trims come after
 * the finishes. Inside a trade, its lines run one after another along each stage's own path
 * (`stageChain`), so its site lines run beside its inside work, and its lines in
 * one stage share that stage's days (at least two each). Two inspections are activities of their
 * own, with no trade (packageId ''): the rough-in inspection after every rough-in, which close-in
 * and anything else after the rough-ins wait on, and the final inspection after all the work.
 * Milestones: dry-in (the last dry-in line), the rough-in inspection (on its finish) and
 * substantial completion (three days after the final inspection). The office changes every date.
 *
 * `like`, a template's lines (G-44): a line of the same trade and name runs as it ran on the template's
 * job. It takes its days, the template's waits this job has (with their gaps), and its offset: as many
 * days after the last of them as it started there. A line with nothing to wait on starts its offset after
 * the first day. The two inspections follow the template's the same way, and the rough-in inspection
 * still waits on every rough-in the template does not cover. A covered line also keeps the place the
 * office kept there (G-83) and its parts (G-39), with no percent done. Every other line is drawn as
 * above. With no `like`, nothing here runs differently.
 */
export function scheduleDraft(project: GcProject, start: string, stageDays?: Partial<Record<string, number>>, like?: TemplateLine[]): ProjectSchedule {
  const order = new Map(SCHEDULE_STAGES.map((st, i) => [st.key, i]))
  type Line = { lineId: string; packageId: string; trade: string; label: string; stage: string; index: number }
  const lines: Line[] = project.packages.flatMap((pkg) =>
    draftLines(pkg).map((l, index) => ({ lineId: l.lineId, packageId: pkg.id, trade: pkg.trade, label: l.label, stage: lineStage(pkg.trade, l.label), index })),
  )
  // A template's lines by trade and name (G-44), and what this job has drawn by the same keys.
  const likeOf = new Map((like ?? []).map((t) => [templateKey(t.trade, t.label), t]))
  const keyOfLine = (l: Line) => templateKey(l.trade, l.label)
  const drawnByKey = new Map<string, ScheduleActivity>()
  /**
   * Where a covered line goes: after the last of the template's waits this job has drawn, by its
   * offset, and never before a gap set on one of them. With nothing to wait on, its offset after the
   * first day. Null: it waited on lines this job has none of, so the stage rules place it.
   */
  const placeLike = (t: TemplateLine): { from: string; after: string[]; lag?: Record<string, number> } | null => {
    const waits = t.after.flatMap((w) => {
      const a = drawnByKey.get(templateKey(w.trade, w.label))
      return a ? [{ a, gap: w.gap ?? 0 }] : []
    })
    if (t.after.length > 0 && waits.length === 0) return null
    if (waits.length === 0) return { from: plusDays(start, Math.max(0, t.offset)), after: [] }
    const last = waits.reduce((m, w) => (w.a.finish > m ? w.a.finish : m), '')
    const from = [start, plusDays(last, 1 + t.offset), ...waits.map((w) => plusDays(w.a.finish, 1 + w.gap))].reduce((m, d) => (d > m ? d : m))
    const gaps = waits.filter((w) => w.gap !== 0)
    return { from, after: [...new Set(waits.map((w) => w.a.lineId))], ...(gaps.length > 0 ? { lag: Object.fromEntries(gaps.map((w) => [w.a.lineId, w.gap])) } : {}) }
  }
  /** What a covered line keeps besides its dates (G-44): the place kept there (G-83) and its parts (G-39), none of them done. */
  const keepsOf = (lineId: string, t: TemplateLine): Pick<ScheduleActivity, 'place' | 'parts'> => ({
    ...(t.place ? { place: t.place } : {}),
    ...(t.parts && t.parts.length > 0 ? { parts: t.parts.map((x, i) => ({ id: `${lineId}-p${i + 1}`, name: x.name, from: x.from, days: x.days, share: x.share, pct: 0 })) } : {}),
  })
  /** A stage's lines as drawn: as listed, except a covered line comes after the lines of its stage it waits on. */
  const inWaitOrder = (stageLines: Line[]): Line[] => {
    if (likeOf.size === 0) return stageLines
    const left = [...stageLines]
    const out: Line[] = []
    while (left.length > 0) {
      const ready = left.findIndex((l) => !(likeOf.get(keyOfLine(l))?.after ?? []).some((w) => left.some((o) => o !== l && keyOfLine(o) === templateKey(w.trade, w.label))))
      // Waits that loop: the first as listed goes, and the rest follow.
      out.push(...left.splice(ready < 0 ? 0 : ready, 1))
    }
    return out
  }
  const byStage = (key: string) => lines.filter((l) => l.stage === key)
  /** The nearest stage before this one, along `after`, that the job has lines in. */
  const gateOf = (key: string): string | null => {
    let at = SCHEDULE_STAGES.find((st) => st.key === key)?.after ?? null
    while (at && byStage(at).length === 0) at = SCHEDULE_STAGES.find((st) => st.key === at)?.after ?? null
    return at
  }
  const done = new Map<string, ScheduleActivity>()
  const activities: ScheduleActivity[] = []
  /** The rough-in inspection, once the rough-ins are drawn. Whatever waits on the rough-ins waits on it. */
  let roughInspection: ScheduleActivity | null = null
  for (const stage of SCHEDULE_STAGES) {
    const gate = gateOf(stage.key)
    const gateActs =
      gate === 'roughIn' && roughInspection
        ? [roughInspection]
        : gate
          ? byStage(gate).map((l) => done.get(l.lineId)).filter((a): a is ScheduleActivity => !!a)
          : []
    const gateDay = gateActs.reduce<string | null>((m, a) => (m === null || a.finish > m ? a.finish : m), null)
    for (const line of inWaitOrder(byStage(stage.key))) {
      // A line the template covers (G-44) runs as it ran there.
      const t = likeOf.get(keyOfLine(line))
      const at = t ? placeLike(t) : null
      if (t && at) {
        // Its place is written as kept, not as a guess: the office kept it once on purpose (the lead, 2026-10-06).
        const a: ScheduleActivity = { lineId: line.lineId, packageId: line.packageId, start: at.from, finish: plusDays(at.from, t.days - 1), after: at.after, ...(at.lag ? { lag: at.lag } : {}), ...keepsOf(line.lineId, t) }
        done.set(line.lineId, a)
        drawnByKey.set(keyOfLine(line), a)
        activities.push(a)
        continue
      }
      // The line before it in its own trade, along its stage's own path (G-143): a crew does its lines
      // one after another, and a site line never waits on the trade's inside work.
      const chain = stageChain(line.stage)
      const own = lines
        .filter((l) => l.packageId === line.packageId && chain.has(l.stage))
        .sort((a, b) => (order.get(a.stage) ?? 0) - (order.get(b.stage) ?? 0) || a.index - b.index)
      const before = own[own.indexOf(line) - 1]
      const prev = before ? done.get(before.lineId) : undefined
      const from = [
        start,
        gateDay ? plusDays(gateDay, 1 + (stage.lag ?? 0)) : start,
        prev ? plusDays(prev.finish, 1) : start,
      ].reduce((m, d) => (d > m ? d : m))
      const after = [...new Set([...gateActs.map((a) => a.lineId), ...(prev ? [prev.lineId] : [])])]
      // A trade's lines in one stage share the stage's days: roofing's four lines take about ten days, not forty.
      const shares = own.filter((l) => l.stage === stage.key).length
      // A rough schedule may set this job's own stage lengths (G-45); every other caller draws the usual ones.
      // A covered line whose waits this job has none of keeps the template's days (G-44).
      const days = t ? t.days : Math.max(2, Math.ceil((stageDays?.[stage.key] ?? stage.days) / Math.max(1, shares)))
      const a: ScheduleActivity = { lineId: line.lineId, packageId: line.packageId, start: from, finish: plusDays(from, days - 1), after, ...(t ? keepsOf(line.lineId, t) : {}) }
      done.set(line.lineId, a)
      drawnByKey.set(keyOfLine(line), a)
      activities.push(a)
    }
    if (stage.key === 'roughIn' && byStage('roughIn').length > 0) {
      const roughs = byStage('roughIn').map((l) => done.get(l.lineId)).filter((a): a is ScheduleActivity => !!a)
      // The template's rough-in inspection (G-44): as it ran there, and still after every rough-in here it does not cover.
      const t = likeOf.get(templateKey('', 'Rough-in inspection'))
      const at = t ? placeLike(t) : null
      const others = at ? byStage('roughIn').filter((l) => !likeOf.has(keyOfLine(l))).map((l) => done.get(l.lineId)).filter((a): a is ScheduleActivity => !!a) : []
      const from = at ? others.reduce((m, a) => (plusDays(a.finish, 1) > m ? plusDays(a.finish, 1) : m), at.from) : plusDays(roughs.reduce((m, a) => (a.finish > m ? a.finish : m), start), 1)
      roughInspection = {
        lineId: `${project.id}-insp-roughin`,
        packageId: '',
        start: from,
        finish: plusDays(from, (t && at ? t.days : INSPECTION_DAYS) - 1),
        after: at ? [...new Set([...at.after, ...others.map((a) => a.lineId)])] : roughs.map((a) => a.lineId),
        ...(at?.lag ? { lag: at.lag } : {}),
        inspection: { label: 'Rough-in inspection' },
      }
      drawnByKey.set(templateKey('', 'Rough-in inspection'), roughInspection)
      activities.push(roughInspection)
    }
  }
  // The final inspection waits on all the work; substantial completion follows it.
  const workEnd = activities.reduce((m, a) => (a.finish > m ? a.finish : m), start)
  // The template's final inspection (G-44): its offset after the last of the work, and its days.
  const lastLike = likeOf.get(templateKey('', 'Final inspection'))
  const finalFrom = plusDays(workEnd, 1 + (lastLike ? Math.max(0, lastLike.offset) : 0))
  const finalInspection: ScheduleActivity = {
    lineId: `${project.id}-insp-final`,
    packageId: '',
    start: finalFrom,
    finish: plusDays(finalFrom, (lastLike ? lastLike.days : INSPECTION_DAYS) - 1),
    after: activities.map((a) => a.lineId).filter((id) => !activities.some((b) => b.after.includes(id))),
    inspection: { label: 'Final inspection' },
  }
  activities.push(finalInspection)
  const lastOf = (key: string) => byStage(key).reduce((m, l) => {
    const f = done.get(l.lineId)?.finish ?? ''
    return f > m ? f : m
  }, '')
  const dryIn = lastOf('dryIn')
  const roof = project.packages.find((k) => k.trade === 'Roofing') ?? null
  const milestones: ScheduleMilestone[] = [
    ...(dryIn ? [{ id: `${project.id}-dryin`, label: 'Dry-in', planned: dryIn, packageId: roof?.id ?? null, metOn: null }] : []),
    ...(roughInspection ? [{ id: `${project.id}-roughin`, label: 'Rough-in inspection', planned: roughInspection.finish, packageId: null, metOn: null }] : []),
    { id: `${project.id}-substantial`, label: 'Substantial completion', planned: plusDays(finalInspection.finish, 3), packageId: null, metOn: null },
  ]
  return { activities, milestones, baseline: null, lookAhead: [] }
}
