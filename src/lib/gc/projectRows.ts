/**
 * GC mode, the real build, step 4: the mapper (to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on branch
 * spike/gc-mode, "The kernels read the prototype's shapes… A mapper, gcProjectFromRows, turns the
 * database rows into those shapes, so no kernel changes when the data becomes real"). The rows of
 * the six tables a GC project is kept in, read back as one project the kernels read: its sheets and
 * sections at any set, its trades with their scope lines and exclusions, and the scope book's view
 * of it (`ScopeBookProject`). Nothing here reads the database: the screen passes the rows in.
 */
import type { CustomerRole, PlanSheet, ScopeExclusion, SpecSection } from './types'
import type { PlanQuestionView } from './questions'
import { indexDiff, sheetIndexInText, type IndexDiff } from './plans'
import type { ScopeBookProject } from './scopeBook'

/** The rows as the tables hold them (the generated types, trimmed to what the mapper reads). */
export interface GcProjectRows {
  project: { id: string; name: string; address: string | null; customer_id: string; plans_link: string | null }
  gc: {
    stage: string
    bid_due: string | null
    sq_ft: number | string | null
    size_note: string
    customer_role: string
    property_owner_customer_id: string | null
    architect_customer_id: string | null
    project_manager_user_id: string | null
    /**
     * Our number's three inputs moved to `gc_project_money` (B5, v2.4923), which only the money team reads.
     * Nothing reads these columns since B5-c (v2.4930); B6-a drops them.
     */
    general_conditions?: number | string
    contingency_pct?: number | string
    fee_pct?: number | string
    drive_folder_url: string
    lost_on: string | null
  }
  packages: { id: string; trade: string; position: number; budget: number | string; ours: boolean; own_bid_id: string | null; carried_invite_id?: string | null; carry_budget?: boolean }[]
  scopeItems: { id: string; package_id: string; position: number; label: string; sheets: string[] | null; specs: string[] | null; added_in_set_id: string | null }[]
  exclusions: { id: string; package_id: string; position: number; label: string; by: string }[]
  sets: { id: string; rev: number; label: string; kind: string; issued_on: string; note: string; checked_by_user_id: string | null; drive_url: string; drive_access: string | null; drive_checked_on: string | null }[]
  setItems: { id: string; set_id: string; position: number; kind: string; number: string; title: string; change: string; was_title: string | null; discipline: string | null; page: number | null }[]
  /** The questions about the plans (step 8). Missing on a row set read before they existed. */
  questions?: { id: string; package_id: string | null; asked_by_name: string; text: string; sheets: string[]; asked_on: string; sent_to_architect_on: string | null; answered_on: string | null; answer: string; in_set_id: string | null; company_id?: string | null; answer_sent_to?: string[] }[]
}

/** One set of plans as the kernels read it: the sheets and sections as they stood after it. */
export interface GcPlanSetView {
  id: string
  rev: number
  label: string
  kind: string
  issuedOn: string
  note: string
  checkedByUserId: string | null
  drive: { url: string; access: 'anyone' | 'restricted' | null; checkedOn: string | null }
  /** What this set itself did, as its rows say. */
  changedSheets: string[]
  addedSheets: PlanSheet[]
  removedSheets: string[]
  retitledSheets: PlanSheet[]
  changedSpecs: string[]
  addedSpecs: SpecSection[]
  removedSpecs: string[]
  retitledSpecs: SpecSection[]
  /** The scope lines this set brought in. */
  addedLines: { packageId: string; scopeId: string }[]
}

export interface GcTradeView {
  id: string
  trade: string
  position: number
  budget: number
  ours: boolean
  ownBidId: string | null
  /** The quote we carry as this trade's number (the Board's B5), or our budget. Unset or null and false: nothing carried yet. */
  carriedInviteId?: string | null
  carryBudget?: boolean
  scope: { id: string; label: string; sheets: string[] | null; specs: string[] | null; addedInSetId: string | null }[]
  excludes: ScopeExclusion[]
}

/** A GC project as the kernels read it. It is a `ScopeBookProject` too, so the scope book reads it as it is. */
export interface GcProjectView extends ScopeBookProject {
  id: string
  name: string
  address: string
  customerId: string
  stage: string
  bidDue: string | null
  sqFt: number | null
  sizeNote: string
  customerRole: CustomerRole
  propertyOwnerId: string | null
  architectId: string | null
  projectManagerUserId: string | null
  driveFolderUrl: string
  lostOn: string | null
  /** The sheets and sections as they stand after the newest set. */
  sheets: PlanSheet[]
  specs: SpecSection[]
  trades: GcTradeView[]
  planSets: (GcPlanSetView & { addedLines: { packageId: string; scopeId: string }[] })[]
  /** The scope book's view of the trades: the same rows under the names it reads. */
  packages: ScopeBookProject['packages']
  /** The rows themselves, for the reads that fold the sets (src/lib/gc/planSetReads.ts). */
  rows: GcProjectRows
  /** The questions about the plans, oldest first. */
  questions: PlanQuestionView[]
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v) : v
  return n === null || n === undefined || Number.isNaN(n) ? 0 : n
}

/** The table's spelling of a role to the kernels'. */
export function customerRoleOf(role: string): CustomerRole {
  return role === 'gc' ? 'gc' : role === 'owners_rep' || role === 'ownersRep' ? 'ownersRep' : 'owner'
}

/** The kernels' spelling of a role to the table's. */
export function customerRoleColumn(role: CustomerRole | undefined): string {
  return role === 'gc' ? 'gc' : role === 'ownersRep' ? 'owners_rep' : 'owner'
}

type Item = GcProjectRows['setItems'][number]

/** The sheets (or sections) as they stand after a set: a fold over every set's rows up to it, in rev order. */
function foldItems(sets: GcProjectRows['sets'], items: Item[], kind: 'sheet' | 'section', upToRev: number): { id: string; title: string; discipline?: string; page?: number }[] {
  const byId = new Map<string, { id: string; title: string; discipline?: string; page?: number }>()
  const order: string[] = []
  for (const set of [...sets].sort((a, b) => a.rev - b.rev)) {
    if (set.rev > upToRev) break
    for (const it of items.filter((x) => x.set_id === set.id && x.kind === kind).sort((a, b) => a.position - b.position)) {
      const key = it.number.toUpperCase().replace(/[-.\s]/g, '')
      if (it.change === 'removed') {
        byId.delete(key)
        continue
      }
      const was = byId.get(key)
      const next = { id: it.number, title: it.change === 'revised' && was ? was.title : it.title, ...(it.discipline ? { discipline: it.discipline } : was?.discipline ? { discipline: was.discipline } : {}), ...(it.page ? { page: it.page } : was?.page ? { page: was.page } : {}) }
      if (!was) order.push(key)
      byId.set(key, next)
    }
  }
  return order.flatMap((key) => {
    const v = byId.get(key)
    return v ? [v] : []
  })
}

/** What one set did, from its own rows. */
function setView(rows: GcProjectRows, set: GcProjectRows['sets'][number]): GcPlanSetView {
  const mine = rows.setItems.filter((x) => x.set_id === set.id).sort((a, b) => a.position - b.position)
  const of = (kind: 'sheet' | 'section', change: string) => mine.filter((x) => x.kind === kind && x.change === change)
  const asSheet = (x: Item): PlanSheet => ({ id: x.number, title: x.title, ...(x.discipline ? { discipline: x.discipline } : {}), ...(x.page ? { page: x.page } : {}) })
  const asSpec = (x: Item): SpecSection => ({ id: x.number, title: x.title })
  const changed = (kind: 'sheet' | 'section') => mine.filter((x) => x.kind === kind && x.change !== 'issued').map((x) => x.number)
  return {
    id: set.id,
    rev: set.rev,
    label: set.label,
    kind: set.kind,
    issuedOn: set.issued_on,
    note: set.note,
    checkedByUserId: set.checked_by_user_id,
    drive: { url: set.drive_url, access: set.drive_access === 'anyone' || set.drive_access === 'restricted' ? set.drive_access : null, checkedOn: set.drive_checked_on },
    changedSheets: changed('sheet'),
    addedSheets: of('sheet', 'added').map(asSheet),
    removedSheets: of('sheet', 'removed').map((x) => x.number),
    retitledSheets: of('sheet', 'renamed').map(asSheet),
    changedSpecs: changed('section'),
    addedSpecs: of('section', 'added').map(asSpec),
    removedSpecs: of('section', 'removed').map((x) => x.number),
    retitledSpecs: of('section', 'renamed').map(asSpec),
    addedLines: rows.scopeItems.filter((x) => x.added_in_set_id === set.id).map((x) => ({ packageId: x.package_id, scopeId: x.id })),
  }
}

/** The rows of one GC project read back as the project the kernels read. */
export function gcProjectFromRows(rows: GcProjectRows): GcProjectView {
  const sets = [...rows.sets].sort((a, b) => a.rev - b.rev)
  const newest = sets[sets.length - 1]?.rev ?? 0
  const trades: GcTradeView[] = [...rows.packages]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      id: p.id,
      trade: p.trade,
      position: p.position,
      budget: num(p.budget),
      ours: p.ours,
      ownBidId: p.own_bid_id,
      carriedInviteId: p.carried_invite_id ?? null,
      carryBudget: p.carry_budget ?? false,
      scope: rows.scopeItems
        .filter((x) => x.package_id === p.id)
        .sort((a, b) => a.position - b.position)
        .map((x) => ({ id: x.id, label: x.label, sheets: x.sheets, specs: x.specs, addedInSetId: x.added_in_set_id })),
      excludes: rows.exclusions
        .filter((x) => x.package_id === p.id)
        .sort((a, b) => a.position - b.position)
        .map((x) => ({ label: x.label, by: x.by })),
    }))
  const planSets = sets.map((s) => setView(rows, s))
  return {
    id: rows.project.id,
    name: rows.project.name,
    address: rows.project.address ?? '',
    customerId: rows.project.customer_id,
    stage: rows.gc.stage,
    bidDue: rows.gc.bid_due,
    sqFt: rows.gc.sq_ft === null ? null : num(rows.gc.sq_ft),
    sizeNote: rows.gc.size_note,
    customerRole: customerRoleOf(rows.gc.customer_role),
    propertyOwnerId: rows.gc.property_owner_customer_id,
    architectId: rows.gc.architect_customer_id,
    projectManagerUserId: rows.gc.project_manager_user_id,
    driveFolderUrl: rows.gc.drive_folder_url,
    lostOn: rows.gc.lost_on,
    sheets: foldItems(sets, rows.setItems, 'sheet', newest),
    specs: foldItems(sets, rows.setItems, 'section', newest).map((x) => ({ id: x.id, title: x.title })),
    trades,
    planSets: planSets.map((s) => ({ ...s, issuedOn: s.issuedOn })),
    rows,
    questions: [...(rows.questions ?? [])]
      .sort((a, b) => a.asked_on.localeCompare(b.asked_on))
      .map((x) => ({
        id: x.id,
        packageId: x.package_id,
        askedByName: x.asked_by_name,
        text: x.text,
        sheets: x.sheets ?? [],
        askedOn: x.asked_on,
        sentToArchitectOn: x.sent_to_architect_on,
        answeredOn: x.answered_on,
        answer: x.answer,
        inSetId: x.in_set_id,
        companyId: x.company_id ?? null,
        answerSentTo: x.answer_sent_to ?? [],
      })),
    // The scope book's names for the same rows.
    packages: trades.map((t) => ({
      id: t.id,
      trade: t.trade,
      scope: t.scope.map((l) => ({ id: l.id, label: l.label, ...(l.specs ? { specs: l.specs } : {}) })),
      invites: [],
      excludes: t.excludes,
    })),
  }
}

/** The sheets as they stood after a given set, for the plans window's "at this set" view. */
export function sheetsAtSet(rows: GcProjectRows, rev: number): PlanSheet[] {
  return foldItems([...rows.sets], rows.setItems, 'sheet', rev)
}

/** The sections as they stood after a given set. */
export function specsAtSet(rows: GcProjectRows, rev: number): SpecSection[] {
  return foldItems([...rows.sets], rows.setItems, 'section', rev).map((x) => ({ id: x.id, title: x.title }))
}

/** What a reissued index changes against the sheets as they stand, read the way the plans window reads a paste. */
export function reissuedIndexDiff(rows: GcProjectRows, pastedIndex: string): IndexDiff<PlanSheet> {
  const now = foldItems([...rows.sets], rows.setItems, 'sheet', rows.sets.reduce((m, s) => Math.max(m, s.rev), 0))
  return indexDiff(now, sheetIndexInText(pastedIndex).sheets)
}
