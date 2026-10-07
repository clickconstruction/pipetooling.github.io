/**
 * GC mode, the real build, step 6: what the new-plans window's press sends (the prototype's
 * `issuePlanSet` action, branch spike/gc-mode, without the email, the schedule and the questions,
 * which land with their own steps), and the jsonb `gc_issue_plan_set(set_in)` takes.
 */
import type { NewTradeDraft } from './newProjectDraft'
import type { PlanSheet, SpecSection } from './types'

export interface IssuePlanSetDraft {
  projectId: string
  /** What the set is called: "Addendum 2", "Bulletin 1", "Permit set". */
  label: string
  kind: string
  note: string
  /** Who on our team checked the set's files before it went out. Required. */
  checkedByUserId: string
  /** The set's Google Drive link and its check. Access null: not checked. */
  drive?: { url: string; access: 'anyone' | 'restricted' | null; checkedOn: string | null }
  /** Every sheet the set names, changed, added, taken out or renamed. */
  sheets: string[]
  addedSheets: PlanSheet[]
  removedSheets: string[]
  retitledSheets: (PlanSheet & { wasTitle?: string })[]
  specs: string[]
  addedSpecs: SpecSection[]
  removedSpecs: string[]
  retitledSpecs: (SpecSection & { wasTitle?: string })[]
  /** Trades the job did not have that this set brings. Nobody is asked yet. */
  newTrades: NewTradeDraft[]
  /** Scope lines this set adds to trades already on the job, with the sheets each reads from. */
  newLines: { packageId: string; label: string; sheets: string[]; specs?: string[] }[]
  /** Scope lines whose sheets or sections all go, tied to new ones. An empty list: the trade as a whole. */
  retiedLines: { packageId: string; scopeId: string; sheets?: string[]; specs?: string[] }[]
}

/** The draft as `gc_issue_plan_set` reads it. */
export function issueDraftForRpc(d: IssuePlanSetDraft): Record<string, unknown> {
  return {
    projectId: d.projectId,
    label: d.label,
    kind: d.kind,
    note: d.note,
    checkedByUserId: d.checkedByUserId,
    drive: d.drive ? { url: d.drive.url, access: d.drive.access, checkedOn: d.drive.checkedOn } : null,
    sheets: d.sheets,
    addedSheets: d.addedSheets,
    removedSheets: d.removedSheets,
    retitledSheets: d.retitledSheets,
    specs: d.specs,
    addedSpecs: d.addedSpecs,
    removedSpecs: d.removedSpecs,
    retitledSpecs: d.retitledSpecs,
    newTrades: d.newTrades.map((t) => ({
      trade: t.trade,
      budget: t.budget,
      ours: t.ours,
      scope: t.scope,
      scopeSheets: t.scopeSheets ?? null,
      scopeSpecs: t.scopeSpecs ?? null,
      excludes: t.excludes ?? [],
    })),
    newLines: d.newLines,
    retiedLines: d.retiedLines,
  }
}
