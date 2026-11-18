import type { LienDeskEntry, LienNoticePolicy } from './lienDesk'

/**
 * The picker behind the Lien desk's ⚠ Put a GC on notice… (v2.3470; rows rebuilt v2.3817; a phone's alone since
 * v2.7806, when a computer's door left the title bar for the job's own notice, `lienGcNoticePress`).
 * One row per GC with an unsent desk entry: the money the desk has due, how soon the
 * earliest open window closes, and what is stuck — owners missing, notices awaiting
 * approval, months already missed. A GC whose every entry has no open window is "nothing
 * left to claim": a run would send no notice, so it sorts under the rest.
 *
 * Order: GCs with a window closing within URGENT_DAYS first (soonest first), then the rest
 * by money; the nothing-left GCs last, by money. Pure, no React.
 */

export const LIEN_GC_PICKER_URGENT_DAYS = 7
/**
 * The head over the GCs whose windows have all closed, at the foot of the picker (v2.3817). It opens on *Nothing*
 * and is a section's title, not an empty list, so it is named here: `check:empty-words` reads a sentence written
 * straight into markup as an empty state.
 */
export const LIEN_GC_PICKER_NOTHING_LEFT = 'Nothing left to claim'

/** What a run on a GC does, the hover hint on a door to it. */
export const LIEN_GC_NOTICE_HINT = 'Every owner on every job with this GC gets the § 53.056 notice for every unnoticed month, in one approved run'

/** The press beside the GC's name on a job's own notice: the GC it opens the run for, its words, its accessible name and its hint. */
export type LienGcNoticePress = { gcId: string; words: string; name: string; hint: string }

/**
 * The press on a job's own notice (v2.7806, the owner's pick of 2026-11-18, *"Build 2"*, after *"I don't think I wanna
 * see it in the header"*): on a computer *⚠ Put a GC on notice…* left the Lien desk's title bar, and a job with a GC
 * draws *⚠ Put on notice…* beside the GC's name on its notice. It opens the run for that GC with no picker, since the
 * GC is the one on the job. Null for a reader who is not the office, a desk handed no run window, a job with no GC,
 * and a phone, which keeps the picker as a row of More. The words leave the GC out because its name is beside them;
 * the accessible name says it.
 */
export function lienGcNoticePress(o: { office: boolean; handed: boolean; isMobile: boolean; gcId: string | null | undefined; gcName: string | null | undefined }): LienGcNoticePress | null {
  if (!o.office || !o.handed || o.isMobile || !o.gcId) return null
  const who = (o.gcName ?? '').trim() || 'this GC'
  return { gcId: o.gcId, words: 'Put on notice…', name: `Put ${who} on notice…`, hint: LIEN_GC_NOTICE_HINT }
}

export type LienGcPickerOption = {
  id: string
  name: string
  policy: LienNoticePolicy
  /** Desk entries (unsent) with this GC. */
  jobs: number
  /** Their open balance. */
  open: number
  /** Earliest open § 53.056 deadline among them, '' when none is open. */
  earliestDeadline: string
  daysLeft: number | null
  needOwner: number
  awaiting: number
  missed: number
  /** Every entry's windows have closed — a run would claim nothing. */
  nothingToClaim: boolean
  /** The months whose windows closed on a nothing-to-claim GC, oldest first (`2026-06`). */
  closedMonths: string[]
}

type GcRef = { name?: string | null } | undefined

export function buildLienGcPickerOptions(
  entries: ReadonlyArray<LienDeskEntry>,
  gcsById: Readonly<Record<string, GcRef>>,
): LienGcPickerOption[] {
  const by = new Map<string, LienGcPickerOption>()
  for (const e of entries) {
    if (!e.gcCustomerId || e.pile === 'sent') continue
    const cur = by.get(e.gcCustomerId) ?? {
      id: e.gcCustomerId,
      name: (gcsById[e.gcCustomerId]?.name ?? '').trim() || 'GC',
      policy: e.policy,
      jobs: 0,
      open: 0,
      earliestDeadline: '',
      daysLeft: null,
      needOwner: 0,
      awaiting: 0,
      missed: 0,
      nothingToClaim: true,
      closedMonths: [],
    }
    cur.jobs += 1
    cur.open += e.openBalance
    if (e.pile === 'needs_owner' || !e.hasOwner) cur.needOwner += 1
    if (e.pile === 'awaiting') cur.awaiting += 1
    if (e.pile === 'missed') cur.missed += 1
    const hasOpen = e.dueMonths.length > 0 && !!e.earliestDeadline && (e.daysLeft ?? -1) >= 0
    if (hasOpen) {
      cur.nothingToClaim = false
      if (!cur.earliestDeadline || e.earliestDeadline! < cur.earliestDeadline) {
        cur.earliestDeadline = e.earliestDeadline!
        cur.daysLeft = e.daysLeft
      }
    }
    // The closed months: the desk's missed list, else the job's own months past their date, else — a saved draft holding the job there — the draft's months.
    const pastOnJob = e.months.filter((m) => !m.noticed && m.daysLeft < 0).map((m) => m.key)
    const closed = e.missedMonths.length ? e.missedMonths : pastOnJob.length ? pastOnJob : hasOpen ? [] : (e.item?.months ?? [])
    for (const m of closed) if (!cur.closedMonths.includes(m)) cur.closedMonths.push(m)
    by.set(e.gcCustomerId, cur)
  }
  const rows = [...by.values()]
  for (const r of rows) {
    r.closedMonths.sort()
    if (!r.nothingToClaim) r.closedMonths = []
  }
  const urgent = (r: LienGcPickerOption) => !r.nothingToClaim && r.daysLeft != null && r.daysLeft <= LIEN_GC_PICKER_URGENT_DAYS
  return rows.sort((a, b) => {
    if (a.nothingToClaim !== b.nothingToClaim) return a.nothingToClaim ? 1 : -1
    const ua = urgent(a)
    const ub = urgent(b)
    if (ua !== ub) return ua ? -1 : 1
    if (ua && ub && a.earliestDeadline !== b.earliestDeadline) return a.earliestDeadline < b.earliestDeadline ? -1 : 1
    return b.open - a.open || a.name.localeCompare(b.name)
  })
}

/** `closes Oct 15 · 20 days` — the row's urgency words; '' when nothing is open. */
export function lienGcPickerCloseWords(o: LienGcPickerOption, dateWords: (ymd: string) => string): string {
  if (o.nothingToClaim || !o.earliestDeadline || o.daysLeft == null) return ''
  const d = o.daysLeft === 0 ? 'today' : o.daysLeft === 1 ? 'tomorrow' : `${o.daysLeft} days`
  return `closes ${dateWords(o.earliestDeadline)} · ${d}`
}
