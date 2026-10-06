/**
 * The top of the procurement log (the procurement log redraw, PR 1; its card was PR #4527): where every part stands, as four steps
 * that count each line once, the one sentence that says what to do next, and what the lines
 * share. Pure: the panel draws these, `procurementLog.ts` keeps the rows.
 */
import { daysBetween, shortDate, type OrderBlockers, type ProcurementRow, type ProcurementStatus } from './procurementLog'

export type ProcurementStepKey = 'gc' | 'to_order' | 'on_order' | 'on_site'
export const PROCUREMENT_STEP_KEYS: ReadonlyArray<ProcurementStepKey> = ['gc', 'to_order', 'on_order', 'on_site']
export const PROCUREMENT_STEP_LABELS: Record<ProcurementStepKey, string> = { gc: 'Waiting on the GC', to_order: 'To order', on_order: 'On order', on_site: 'On site' }
/** v2.4663 · the first step's name while the revision is a draft nobody has shared: the GC is not waiting, we are. */
export const NOT_SENT_LABEL = 'Not sent yet'

/** "Share Rev 4 first". */
const shareFirst = (draftRev: number) => `Share Rev ${draftRev} first`
/** A line of a draft nobody has shared: the GC has not seen it. A hand line is never sent, so it is not one. */
const isUnsent = (r: ProcurementRow, draftRev: number | null) => draftRev != null && r.status === 'not_submitted' && !r.isHand

const STEP_OF_STATUS: Record<ProcurementStatus, ProcurementStepKey> = { awaiting: 'gc', sent_back: 'gc', not_submitted: 'gc', released: 'to_order', ordered: 'on_order', delivered: 'on_site' }

/** The one step a line stands on: by its status, so the four add up to the log. */
export function stepOfRow(r: Pick<ProcurementRow, 'status'>): ProcurementStepKey {
  return STEP_OF_STATUS[r.status]
}

export type ProcurementStepTone = 'back' | 'go' | 'late' | 'quiet'
export type ProcurementStep = { key: ProcurementStepKey; label: string; count: number; /** The small line under the number; '' for none. */ note: string; tone: ProcurementStepTone }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const first = (dates: ReadonlyArray<string | null>): string | null => dates.filter((d): d is string => !!d).sort()[0] ?? null
const last = (dates: ReadonlyArray<string | null>): string | null => dates.filter((d): d is string => !!d).sort().pop() ?? null

/**
 * The four steps: *Waiting on the GC* (5 sent back) · *To order* (first by 10/27) · *On order*
 * (1 late, else next arrives 11/03) · *On site* (last 09/29). A delivered part is on site only:
 * it is not counted as ordered too. While no line waits on the GC and some were never sent
 * (a draft nobody has shared, v2.4663), the first step reads *Not sent yet · Share Rev 4 first*;
 * when lines the GC holds from an earlier revision stand beside new unsent ones, it keeps its
 * name and says *3 not sent yet* under it. `draftRev` is that revision's number, null once it
 * is shared (then nothing is unsent).
 */
export function procurementSteps(rows: ReadonlyArray<ProcurementRow>, draftRev: number | null = null): ProcurementStep[] {
  const of = (k: ProcurementStepKey) => rows.filter((r) => stepOfRow(r) === k)
  const gc = of('gc')
  const ready = of('to_order')
  const ordered = of('on_order')
  const site = of('on_site')
  const back = gc.filter((r) => r.status === 'sent_back').length
  const notSent = gc.filter((r) => isUnsent(r, draftRev)).length
  const unsent = notSent > 0 && !gc.some((r) => r.status === 'awaiting')
  const firstBy = first(ready.map((r) => r.orderBy))
  const late = ordered.filter((r) => r.late).length
  const nextIn = first(ordered.map((r) => r.expectedOn))
  const lastIn = last(site.map((r) => r.deliveredOn))
  const step = (key: ProcurementStepKey, count: number, note: string, tone: ProcurementStepTone, label = PROCUREMENT_STEP_LABELS[key]): ProcurementStep => ({ key, label, count, note, tone })
  return [
    step('gc', gc.length, back > 0 ? `${back} sent back` : unsent ? shareFirst(draftRev!) : notSent > 0 ? `${notSent} not sent yet` : '', back > 0 ? 'back' : 'quiet', unsent ? NOT_SENT_LABEL : PROCUREMENT_STEP_LABELS.gc),
    step('to_order', ready.length, ready.length === 0 ? 'nothing approved yet' : firstBy ? `first by ${shortDate(firstBy)}` : '', ready.length > 0 && firstBy ? 'go' : 'quiet'),
    step('on_order', ordered.length, late > 0 ? `${late} late` : nextIn ? `next arrives ${shortDate(nextIn)}` : '', late > 0 ? 'late' : 'quiet'),
    step('on_site', site.length, lastIn ? `last ${shortDate(lastIn)}` : '', 'quiet'),
  ]
}

/** The lines one step holds; no step is the whole log. */
export function rowsForStep(rows: ReadonlyArray<ProcurementRow>, key: ProcurementStepKey | null): ProcurementRow[] {
  return key ? rows.filter((r) => stepOfRow(r) === key) : [...rows]
}

/** "Waiting on the GC: 44 parts. The other lines are hidden." — `label` is the step's own name when it differs (*Not sent yet*). */
export function stepOnlyWords(key: ProcurementStepKey, count: number, label: string = PROCUREMENT_STEP_LABELS[key]): { lead: string; rest: string } {
  return { lead: `${label}: ${plural(count, 'part')}.`, rest: 'The other lines are hidden.' }
}

/** Each step's share of the log, for the thin bar under the strip; a step at zero has no piece. */
export function stepShares(steps: ReadonlyArray<ProcurementStep>): Array<{ key: ProcurementStepKey; percent: number }> {
  const total = steps.reduce((n, s) => n + s.count, 0)
  return total === 0 ? [] : steps.filter((s) => s.count > 0).map((s) => ({ key: s.key, percent: (s.count / total) * 100 }))
}

/** ", today" · ", tomorrow" · ", 3 days ago" · '' — how near an order-by date is, said only when it presses. */
function howSoon(iso: string, asOf: string): string {
  const n = daysBetween(asOf, iso)
  if (n == null) return ''
  if (n === 0) return ', today'
  if (n === 1) return ', tomorrow'
  if (n < 0) return `, ${plural(-n, 'day')} ago`
  return ''
}

/**
 * The sentences after **Next:**. Something to order: *Order 6 parts by 10/27, tomorrow.* then the
 * late and the sent back. Nothing to order: *Nothing can be ordered until the GC answers. They sent
 * 5 parts back. 39 more wait on their answer.* On a draft nobody has shared (v2.4663): *Nothing
 * can be ordered until the GC answers. Share Rev 4 first. 11 parts have not been sent.* An empty
 * log says nothing.
 */
export function procurementNextLine(rows: ReadonlyArray<ProcurementRow>, asOf: string, draftRev: number | null = null): string[] {
  if (rows.length === 0) return []
  const ready = rows.filter((r) => r.status === 'released')
  const back = rows.filter((r) => r.status === 'sent_back').length
  const notSent = rows.filter((r) => isUnsent(r, draftRev)).length
  const awaiting = rows.filter((r) => (r.status === 'awaiting' || r.status === 'not_submitted') && !isUnsent(r, draftRev)).length
  const waiting = awaiting + notSent
  const ordered = rows.filter((r) => r.status === 'ordered')
  const late = ordered.filter((r) => r.late).length
  const out: string[] = []
  if (ready.length > 0) {
    const firstBy = first(ready.map((r) => r.orderBy))
    if (firstBy) out.push(`Order ${plural(ready.filter((r) => r.orderBy === firstBy).length, 'part')} by ${shortDate(firstBy)}${howSoon(firstBy, asOf)}.`)
    else out.push(`${plural(ready.length, 'part is', 'parts are')} approved and not ordered.`)
    if (late > 0) out.push(`${plural(late, 'part')} on order ${late === 1 ? 'arrives' : 'arrive'} late.`)
    if (back > 0) out.push(`The GC sent ${plural(back, 'part')} back.`)
    return out
  }
  if (back + waiting > 0) {
    out.push('Nothing can be ordered until the GC answers.')
    if (back > 0) out.push(`They sent ${plural(back, 'part')} back.`)
    if (awaiting > 0) out.push(back > 0 ? `${awaiting} more ${awaiting === 1 ? 'waits' : 'wait'} on their answer.` : `${plural(awaiting, 'part waits', 'parts wait')} on their answer.`)
    if (notSent > 0) out.push(`${shareFirst(draftRev!)}. ${plural(notSent, 'part has', 'parts have')} not been sent.`)
  } else if (ordered.length > 0) out.push(`Nothing is left to order. ${plural(ordered.length, 'part is', 'parts are')} on order.`)
  else out.push('Every part is on site.')
  if (late > 0) out.push(`${plural(late, 'part')} on order ${late === 1 ? 'arrives' : 'arrive'} late.`)
  return out
}

/**
 * The missing facts press only when a part that can be ordered now lacks a lead time or a stage:
 * then the line turns amber. While everything still waits on the GC it stays grey.
 */
export function blockersPress(rows: ReadonlyArray<ProcurementRow>, b: OrderBlockers): boolean {
  const missing = new Set([...b.noLead, ...b.noStage])
  return rows.some((r) => r.status === 'released' && missing.has(r.key))
}

/** The one house every line with a row behind it comes from; null when they differ or one has none. */
export function sharedHouse(rows: ReadonlyArray<ProcurementRow>): string | null {
  const houses = new Set(rows.filter((r) => !r.isHand).map((r) => r.supplyHouse ?? ''))
  if (houses.size !== 1) return null
  return [...houses][0] || null
}

/** "Send update…" until an update has gone and lines have changed since: then "Send update · 14 changes". */
export function sendUpdateLabel(updateSent: boolean, changes: number): string {
  return updateSent && changes > 0 ? `Send update · ${plural(changes, 'change')}` : 'Send update…'
}
