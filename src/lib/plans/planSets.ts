/**
 * Plan sets by part (punch list #239): the pure pieces behind the Plans section of the job window's
 * Documents tab (PR 2) and, later, the Development page's Plans look by part (PR 3).
 *
 * A set belongs to a PART of a site — a building or area of a development, the whole site, or the
 * one part a job outside any development owns — and each part has one set it builds from
 * (`plan_parts.current_set_id`). A job names its part (`jobs_ledger.plan_part_id`) and follows it,
 * so a job can never be "on an older set". An as-built is ours, on the job that made it, marking up
 * the set it built from. The tables are migration `20261101210000` (v2.6297).
 */
import { planSetDateWords } from '../bids/bidPlanSets'

export type PlanSetKind = 'issued' | 'addendum' | 'bulletin' | 'revised' | 'permit' | 'construction' | 'assembled' | 'as_built'
export type PlanSetSource = 'gc' | 'architect' | 'ours'

export type PlanPartRow = {
  id: string
  development_id: string | null
  job_id: string | null
  name: string
  position: number
  current_set_id: string | null
  current_set_by: string | null
  current_set_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PlanSetRow = {
  id: string
  part_id: string
  name: string
  kind: string
  source: string
  /** The date printed on the sheets, `YYYY-MM-DD`, or null. */
  dated: string | null
  /** The day it reached us, an ISO stamp. */
  came_at: string
  memo: string
  /** A Drive folder or file link, or '' while the files are on their way. */
  link: string
  replaces_set_id: string | null
  marks_up_set_id: string | null
  /** The job that made it: set on an as-built. */
  job_id: string | null
  file_name: string | null
  file_size: number | null
  file_count: number | null
  checked_at: string | null
  check_note: string | null
  /** The papers train (migration 20261102010000): a paper we are waiting on, the lane and id of the question it raised. */
  owed: boolean
  ask_lane: string | null
  ask_request_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Every kind a set can be, in the order the picker offers them; `ours` marks the kinds we make. */
export const PLAN_SET_KINDS: ReadonlyArray<{ kind: PlanSetKind; label: string; ours: boolean; numbered: boolean }> = [
  { kind: 'issued', label: 'Issued set', ours: false, numbered: false },
  { kind: 'addendum', label: 'Addendum', ours: false, numbered: true },
  { kind: 'bulletin', label: 'Bulletin', ours: false, numbered: true },
  { kind: 'revised', label: 'Revised set', ours: false, numbered: false },
  { kind: 'permit', label: 'Permit set', ours: false, numbered: false },
  { kind: 'construction', label: 'Construction set', ours: false, numbered: false },
  { kind: 'assembled', label: 'Assembled set', ours: true, numbered: false },
  { kind: 'as_built', label: 'As-built', ours: true, numbered: false },
]

export const PLAN_SET_SOURCES: ReadonlyArray<{ source: PlanSetSource; label: string }> = [
  { source: 'gc', label: 'The GC' },
  { source: 'architect', label: 'The architect' },
  { source: 'ours', label: 'Us' },
]

export function kindLabel(kind: string): string {
  return PLAN_SET_KINDS.find((k) => k.kind === kind)?.label ?? kind
}

/** The source as a set's line reads it: *the GC*, *the architect*, *ours*. */
export function sourceWords(source: string): string {
  return source === 'ours' ? 'ours' : source === 'architect' ? 'the architect' : 'the GC'
}

export function isAsBuilt(s: Pick<PlanSetRow, 'kind'>): boolean {
  return s.kind === 'as_built'
}

/**
 * A set of drawings: the only kind a part builds from or a set list shows. Papers (a spec, a schedule, a task list;
 * migration 20261102010000) live in the same table and read in their own block, never as a set.
 */
export function isDrawingSet(s: Pick<PlanSetRow, 'kind'>): boolean {
  return PLAN_SET_KINDS.some((k) => k.kind === s.kind)
}

/** Newest date first; undated after the dated; among equals the one that came last first. */
export function compareSets(a: Pick<PlanSetRow, 'dated' | 'came_at'>, b: Pick<PlanSetRow, 'dated' | 'came_at'>): number {
  if (a.dated && b.dated && a.dated !== b.dated) return a.dated < b.dated ? 1 : -1
  if (a.dated && !b.dated) return -1
  if (!a.dated && b.dated) return 1
  return a.came_at < b.came_at ? 1 : a.came_at > b.came_at ? -1 : 0
}

export type JobPlansView = {
  part: PlanPartRow | null
  /** The set the part builds from today, or null while none is current. */
  current: PlanSetRow | null
  /** The set the current one replaces, when that row is still on the part. */
  replaced: PlanSetRow | null
  /** Every other set that is not an as-built, newest first. */
  older: PlanSetRow[]
  /** Our as-builts on the part, newest first. */
  asBuilts: PlanSetRow[]
}

export function buildJobPlansView(part: PlanPartRow | null, sets: ReadonlyArray<PlanSetRow>): JobPlansView {
  if (!part) return { part: null, current: null, replaced: null, older: [], asBuilts: [] }
  const mine = sets.filter((s) => s.part_id === part.id && isDrawingSet(s))
  const asBuilts = mine.filter(isAsBuilt).sort(compareSets)
  const plain = mine.filter((s) => !isAsBuilt(s)).sort(compareSets)
  const current = plain.find((s) => s.id === part.current_set_id) ?? null
  const replaced = current?.replaces_set_id ? (mine.find((s) => s.id === current.replaces_set_id) ?? null) : null
  return { part, current, replaced, older: plain.filter((s) => s !== current), asBuilts }
}

/** A stamp or a civil date as a short day: *Oct 20*. */
export function shortDayWords(iso: string | null | undefined): string {
  if (!iso) return ''
  const civil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = civil ? new Date(Number(civil[1]), Number(civil[2]) - 1, Number(civil[3])) : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The set's own line: *Permit set · the GC · dated Oct 14, 2026*, or *· came Oct 20* when no date is on the sheets. */
export function setLineWords(s: Pick<PlanSetRow, 'kind' | 'source' | 'dated' | 'came_at'>): string {
  const when = s.dated ? `dated ${planSetDateWords(s.dated) ?? s.dated}` : `came ${shortDayWords(s.came_at)}`
  return `${kindLabel(s.kind)} · ${sourceWords(s.source)} · ${when}`
}

/**
 * The day an older-sets row leads with (the Development page's fold, v2.6355): the date on the sheets with its
 * year, *Aug 11, 2026*, else the day it came as *came Oct 30, 2026* — undated sets sort last, so the word marks
 * them. Empty only when neither reads as a day.
 */
export function setRowDayWords(s: Pick<PlanSetRow, 'dated' | 'came_at'>): string {
  const onSheets = s.dated ? planSetDateWords(s.dated) : null
  if (onSheets) return onSheets
  const came = dayWithYearWords(s.came_at)
  return came ? `came ${came}` : ''
}

/** The rest of that row's line, with no date in it: *Revised set · the architect*. */
export function setRowLineWords(s: Pick<PlanSetRow, 'kind' | 'source'>): string {
  return `${kindLabel(s.kind)} · ${sourceWords(s.source)}`
}

/** *Oct 30, 2026* from a stamp or a civil date, read as `shortDayWords` reads it; empty when it is not a day. */
function dayWithYearWords(iso: string | null | undefined): string {
  if (!iso) return ''
  const civil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = civil ? new Date(Number(civil[1]), Number(civil[2]) - 1, Number(civil[3])) : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * The line under *Building from*: *replaced Issued set on Oct 20 · set by Taunya*. `setByName` is the
 * name of whoever made it current; null when nothing recorded one.
 */
export function buildingFromLine(view: Pick<JobPlansView, 'part' | 'current' | 'replaced'>, setByName: string | null): string | null {
  if (!view.part || !view.current) return null
  const parts: string[] = []
  if (view.replaced) parts.push(`replaced ${view.replaced.name}${view.part.current_set_at ? ` on ${shortDayWords(view.part.current_set_at)}` : ''}`)
  if (setByName) parts.push(`set by ${setByName}`)
  return parts.length ? parts.join(' · ') : null
}

/** An as-built's line: *Nov 1 · Malachi · marks up Permit set*. */
export function asBuiltLineWords(s: Pick<PlanSetRow, 'came_at' | 'marks_up_set_id'>, byName: string | null, sets: ReadonlyArray<Pick<PlanSetRow, 'id' | 'name'>>): string {
  const parts = [shortDayWords(s.came_at)]
  if (byName) parts.push(byName)
  const marks = s.marks_up_set_id ? sets.find((x) => x.id === s.marks_up_set_id) : null
  if (marks) parts.push(`marks up ${marks.name}`)
  return parts.filter(Boolean).join(' · ')
}

export type OtherPart = { id: string; name: string; hasSet: boolean }

/**
 * The notice on a job inside a development (the owner, 2026-11-01: *a notice that says there are other
 * plans in the development, so a user knows that there might be other plans that could affect this*).
 * Null when no other part of the site carries a set.
 */
export function otherPlansNotice(args: { developmentName: string | null; myPartId: string | null; parts: ReadonlyArray<OtherPart> }): string | null {
  const others = args.parts.filter((p) => p.id !== args.myPartId && p.hasSet)
  if (others.length === 0) return null
  const site = args.developmentName?.trim() || 'This site'
  const names = others.map((p) => p.name)
  const list = names.length === 1 ? names[0]! : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${site} has plans on ${others.length === 1 ? 'another part' : `${others.length} other parts`} of the site: ${list}. A set on another part may touch this job.`
}

export type NewSetDraft = { name: string; kind: PlanSetKind; source: PlanSetSource; dated: string; memo: string; link: string }

export function emptyNewSetDraft(kind: PlanSetKind = 'issued'): NewSetDraft {
  return { name: '', kind, source: kind === 'as_built' || kind === 'assembled' ? 'ours' : 'gc', dated: '', memo: '', link: '' }
}

/** What a new set still needs before it saves; null when it can. */
export function newSetDraftProblem(d: NewSetDraft): string | null {
  if (!d.name.trim()) return 'Give the set a name.'
  if (d.link.trim() && !/^https?:\/\//i.test(d.link.trim())) return 'Paste the set’s link, starting with https://, or leave it empty for now.'
  if (d.dated && !/^\d{4}-\d{2}-\d{2}$/.test(d.dated)) return 'The date on the sheets reads as a day, like 2026-10-14.'
  return null
}

/** The name a new set starts with: *Addendum 2* for a numbered kind, else the kind, with a 2 when the name is taken. */
export function defaultSetName(kind: PlanSetKind, existing: ReadonlyArray<Pick<PlanSetRow, 'name'>>): string {
  const k = PLAN_SET_KINDS.find((x) => x.kind === kind)
  const label = k?.label ?? kind
  const names = existing.map((s) => s.name.trim())
  if (k?.numbered) {
    const n = names.filter((x) => new RegExp(`^${label} \\d+$`).test(x)).length
    return `${label} ${n + 1}`
  }
  if (!names.includes(label)) return label
  let n = 2
  while (names.includes(`${label} ${n}`)) n += 1
  return `${label} ${n}`
}

/** The name an as-built starts with: *As-built · JP972 · 2026-11-01*. */
export function defaultAsBuiltName(jobLabel: string, ymd: string): string {
  return `As-built · ${jobLabel} · ${ymd}`
}

/** The job as a short label: its number, else its name. */
export function jobShortLabel(job: { click_number?: string | null; hcp_number?: string | null; job_name?: string | null }): string {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  if (n) return /^\d+$/.test(n) ? `JP${n}` : n
  return (job.job_name ?? '').trim() || 'this job'
}

/** The part a job outside any development owns, named after the job. */
export function partNameForJob(job: { job_name?: string | null; click_number?: string | null; hcp_number?: string | null }): string {
  const name = (job.job_name ?? '').trim()
  return (name || jobShortLabel(job)).slice(0, 120)
}

/** Today as a civil date in the browser's zone, `YYYY-MM-DD`. */
export function todayYmd(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** The press's words: *Add the set and build from it* / *Add it, keep Issued set current*. */
export function addSetPressWords(current: Pick<PlanSetRow, 'name'> | null): { makeCurrent: string; keep: string | null } {
  return { makeCurrent: current ? 'Add the set and build from it' : 'Add the set', keep: current ? `Add it, keep ${current.name} current` : null }
}
