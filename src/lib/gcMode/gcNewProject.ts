/**
 * GC mode — design spike. New Project, and splitting the plans into trades: the sheet index is
 * read out of what the office pastes, the trades are guessed from the sheets, and each trade
 * starts from its usual scope. A later set of plans uses the same guess, and can bring a trade
 * the job did not have. Every guess here is a starting point the office changes.
 */
import type { GcAction, GcCustomer, GcProject, GcState, NewProjectDraft, NewTradeDraft, PlanSheet, ProjectSchedule, ScheduleActivity, ScheduleMilestone, ScopeItem, SpecSection, TemplateLine, TradePackage } from './gcTypes'
import { sheetsAtRev } from './gcPlans'
import {
  BUDGET_PER_SQ_FT,
  TRADE_TEMPLATES,
  sheetIndexInText,
  guessLineSheets,
  guessLineSpecs,
  scopeGaps,
  sheetDiscipline,
  specDivision,
  sqFtInText,
  tradeForSpec,
  tradeOrder,
  tradesForSheets,
  type ScopeGap,
} from '../gc/plans'

// The pure plan kernels live in the real build's library now (to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md,
// PR 1); they are re-exported here so the barrel and every lane keep reading them as before.
export {
  TRADE_TEMPLATES,
  BUDGET_PER_SQ_FT,
  sqFtInText,
  budgetFromSize,
  sheetIndexInText,
  tradesForSheets,
  guessLineSheets,
  inSentence,
  BY_NOT_A_TRADE,
  usualExcludes,
  scopeGaps,
  usualScope,
  tradeOrder,
  SPEC_DIVISIONS,
  specDivision,
  tradeForSpec,
  specIndexInText,
  tradesForPlans,
  guessLineSpecs,
  specsInText,
} from '../gc/plans'
export type { TradeTemplate, SheetIndexReading, TradeGuess, ScopeGap, SpecIndexReading, PlansTradeGuess } from '../gc/plans'
import { currentRev } from './gcLookups'
import { townFromAddress, tradeLineup } from './gcMap'
import { BENCH_WANTED } from './gcBench'
import { carriedAmount, isGuess } from './gcBids'


/** What a trade really cost on one of our jobs, per square foot of that job. */
export interface PastTradeCost {
  projectId: string
  name: string
  perSqFt: number
}

/**
 * What a trade really cost on our other jobs, per square foot: a signed contract, the quote we
 * carried or awarded, or our own priced bid, over the job's size. Our own budget guesses (plugs)
 * and jobs with no size in square feet do not count.
 */
export function tradeCostHistory(state: GcState, trade: string, except: string | null = null): PastTradeCost[] {
  const out: PastTradeCost[] = []
  for (const project of state.projects) {
    if (project.id === except) continue
    const sqFt = sqFtInText(project.sizeNote)
    if (!sqFt) continue
    for (const pkg of project.packages) {
      if (pkg.trade !== trade || isGuess(pkg)) continue
      const amount = carriedAmount(pkg)
      if (amount !== null && amount > 0) out.push({ projectId: project.id, name: project.name, perSqFt: amount / sqFt })
    }
  }
  return out
}

/** A trade's budget from its size, and where the rate came from: our past jobs (their middle rate) or a rough rate. */
export interface SizedBudget {
  amount: number
  perSqFt: number
  /** How many past jobs the rate came from. 0: the rough rate. */
  jobs: number
}

/**
 * A trade's budget for a job of this size, to the nearest $500: the middle of what the trade cost
 * on our past jobs per square foot, or the rough rate when we have no past job for it. Null for a
 * trade with neither.
 */
export function budgetForSize(state: GcState, trade: string, sqFt: number): SizedBudget | null {
  const rates = tradeCostHistory(state, trade).map((x) => x.perSqFt).sort((a, b) => a - b)
  const middle = rates.length === 0 ? null : rates.length % 2 === 1 ? (rates[(rates.length - 1) / 2] ?? null) : ((rates[rates.length / 2 - 1] ?? 0) + (rates[rates.length / 2] ?? 0)) / 2
  const perSqFt = middle ?? BUDGET_PER_SQ_FT[trade] ?? null
  if (perSqFt === null) return null
  return { amount: Math.round((perSqFt * sqFt) / 500) * 500, perSqFt, jobs: rates.length }
}

/** A company new to us, added on Who to ask (the owner, 2026-10-04, question 3): anyone can quote. */
export interface StrangerAsk {
  trade: string
  company: string
  /** How to reach them: an email or a phone, as the office has it. */
  contact: string
}

/**
 * The actions that add each company new to us and ask it to quote, in order: the Board's
 * addPartner with known false (so it comes in not vetted, and award waits for the office's
 * approval), then the board's invite. Each id is the one addPartner gives the next company,
 * `new-` and the count of companies after it. A trade that is ours, or not on the project, is skipped.
 */
export function strangerActions(state: GcState, project: GcProject, strangers: StrangerAsk[]): GcAction[] {
  const out: GcAction[] = []
  let count = state.partners.length
  for (const s of strangers) {
    const company = s.company.trim()
    const pkg = project.packages.find((p) => p.trade === s.trade && !p.selfPerform)
    if (company === '' || !pkg) continue
    count += 1
    out.push({ type: 'addPartner', company, contact: s.contact.trim(), trade: s.trade, base: null, maxMiles: null, known: false })
    out.push({ type: 'invite', projectId: project.id, packageId: pkg.id, partnerId: `new-${count}` })
  }
  return out
}

/** The trades the company does with its own crews. Their number comes from our own bid in Trades mode. */
export const OUR_TRADES = ['Plumbing']

/** What a new project starts with on Our number. The office changes them there. */
export const NEW_PROJECT_CONTINGENCY_PCT = 3
export const NEW_PROJECT_FEE_PCT = 8


/**
 * The trades on a project that a later set's sheets most likely change. The sheets' titles come
 * from the project's index, or from the set itself for a sheet it adds.
 */
export function packagesForSheets(project: GcProject, sheets: string[], added: PlanSheet[] = []): string[] {
  const index = sheetsAtRev(project, currentRev(project))
  const named: PlanSheet[] = sheets.map((id) => added.find((s) => s.id === id) ?? index.find((s) => s.id === id) ?? { id, title: '' })
  const trades = new Set(tradesForSheets(named).map((g) => g.trade))
  return project.packages.filter((p) => trades.has(p.trade)).map((p) => p.id)
}


/** The sheets of the newest set that suggest a trade, with their titles, and any a set is adding. */
export function tradeSheets(project: GcProject, trade: string, added: PlanSheet[] = []): PlanSheet[] {
  const live = sheetsAtRev(project, currentRev(project))
  const index = [...live, ...added.filter((a) => !live.some((x) => x.id === a.id))]
  const from = tradesForSheets(index).find((g) => g.trade === trade)?.from ?? []
  return index.filter((s) => from.includes(s.id))
}

/** The sheets one scope line reads from: what the office said, or the guess when it said nothing. */
export function lineSheets(project: GcProject, pkg: TradePackage, item: ScopeItem, added: PlanSheet[] = []): { sheets: string[]; guessed: boolean } {
  if (item.sheets) return { sheets: item.sheets, guessed: false }
  return { sheets: guessLineSheets(item.label, tradeSheets(project, pkg.trade, added)), guessed: true }
}

/**
 * Every sheet one scope line reads from. A line that names no sheet stands for the whole trade,
 * so it reads every sheet of its trade (`wholeTrade`). The owner, 2026-10-02: count those lines
 * as touched when any of the trade's sheets changes.
 */
export function lineReads(
  project: GcProject,
  pkg: TradePackage,
  item: ScopeItem,
  added: PlanSheet[] = [],
): { sheets: string[]; guessed: boolean; wholeTrade: boolean } {
  const said = lineSheets(project, pkg, item, added)
  if (said.sheets.length > 0) return { ...said, wholeTrade: false }
  return { sheets: tradeSheets(project, pkg.trade, added).map((s) => s.id), guessed: said.guessed, wholeTrade: true }
}

/**
 * The scope lines of a trade that read from any of these sheets, a line that names no sheet
 * included. `added`: sheets a set is adding, so a line's guess and its whole trade can read them.
 */
export function linesOnSheets(project: GcProject, pkg: TradePackage, sheetIds: string[], added: PlanSheet[] = []): ScopeItem[] {
  return pkg.scope.filter((item) => lineReads(project, pkg, item, added).sheets.some((id) => sheetIds.includes(id)))
}


/** The gaps between a project's trades, read from its packages. */
export function projectScopeGaps(project: GcProject): ScopeGap[] {
  return scopeGaps(project.packages.map((p) => ({ trade: p.trade, scope: p.scope.map((l) => l.label), excludes: p.excludes })))
}


function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function freeId(base: string, taken: string[]): string {
  const root = base || 'new'
  if (!taken.includes(root)) return root
  let n = 2
  while (taken.includes(`${root}-${n}`)) n += 1
  return `${root}-${n}`
}

/** A company the office named for the first time: a customer record with nothing known yet. */
function newCustomer(id: string, name: string, kind: string): GcCustomer {
  return {
    id,
    name,
    kind,
    contact: '',
    contactRole: '',
    phone: '',
    email: '',
    address: '',
    howTheyBuy: null,
    payDays: null,
    retainagePct: null,
    portalOn: false,
    portalLastOpened: null,
    answerDays: null,
    contacts: [],
    past: [],
    tradesNote: null,
  }
}

/** Trade packages made from the office's drafts, ids kept clear of the ones already taken. */
export function packagesFromDrafts(projectId: string, drafts: NewTradeDraft[], taken: string[] = []): TradePackage[] {
  const used = [...taken]
  return [...drafts]
    .sort((a, b) => tradeOrder(a.trade) - tradeOrder(b.trade))
    .map((t) => {
      const pkgId = freeId(`${projectId}-${slug(t.trade)}`, used)
      used.push(pkgId)
      const lines = t.scope
        .map((label, i) => ({ label: label.trim(), sheets: t.scopeSheets?.[i], specs: t.scopeSpecs?.[i] }))
        .filter((l) => l.label !== '')
      return {
        id: pkgId,
        trade: t.trade,
        bidTab: null,
        scope: lines.map((l, i) => ({
          id: `${pkgId}-${i + 1}`,
          label: l.label,
          ...(t.scopeSheets ? { sheets: l.sheets ?? [] } : {}),
          ...(t.scopeSpecs ? { specs: l.specs ?? [] } : {}),
        })),
        budget: t.budget,
        selfPerform: t.ours ? { ref: 'New bid', value: t.budget, note: 'Ours. Price it as our own bid in Trades mode.', priced: false } : null,
        invites: [],
        carried: t.ours ? 'self' : null,
        awardedInviteId: null,
        sow: null,
        ...(t.excludes && t.excludes.some((x) => x.label.trim() !== '')
          ? { excludes: t.excludes.filter((x) => x.label.trim() !== '').map((x) => ({ label: x.label.trim(), by: x.by })) }
          : {}),
      }
    })
}

/**
 * Scope lines a new set adds to trades already on the job, put at the end of each trade's scope.
 * A quote that came in before never answered them, so Compare quotes reads them as not clear until
 * a cost is set to cover them or the company answers.
 */
export function withNewLines(
  project: GcProject,
  rev: number,
  lines: { packageId: string; label: string; sheets: string[]; specs?: string[] }[],
): { project: GcProject; added: { packageId: string; scopeId: string }[] } {
  const added: { packageId: string; scopeId: string }[] = []
  const packages = project.packages.map((pkg) => {
    const mine = lines.filter((l) => l.packageId === pkg.id && l.label.trim() !== '')
    if (mine.length === 0) return pkg
    const items: ScopeItem[] = mine.map((l, i) => ({
      id: `${pkg.id}-r${rev}-${i + 1}`,
      label: l.label.trim(),
      sheets: l.sheets,
      ...(l.specs && l.specs.length > 0 ? { specs: l.specs } : {}),
    }))
    for (const item of items) added.push({ packageId: pkg.id, scopeId: item.id })
    return { ...pkg, scope: [...pkg.scope, ...items] }
  })
  return { project: { ...project, packages }, added }
}

/** The set that added a scope line to the job, when a later set added it. */
export function setThatAddedLine(project: GcProject, scopeId: string): string | null {
  return project.planSets.find((s) => s.addedLines?.some((l) => l.scopeId === scopeId))?.label ?? null
}

/** The project's trades with new ones put in the list's order. The trades already there keep their order. */
export function withTradesInOrder(existing: TradePackage[], added: TradePackage[]): TradePackage[] {
  const out = [...existing]
  for (const pkg of added) {
    const at = out.findIndex((p) => tradeOrder(p.trade) > tradeOrder(pkg.trade))
    if (at === -1) out.push(pkg)
    else out.splice(at, 0, pkg)
  }
  return out
}

/**
 * Who to ask first on a new project's trade: the companies in range in the map's own order
 * (`tradeLineup`: the most reliable first, then the shorter drive), up to a deep bench
 * (BENCH_WANTED), so at least two quotes come back. The owner, 2026-10-02: keep the map's order;
 * his answer to question 7, most reliable first, moved both. A company with no coverage set is in range, after
 * the ones whose drive is known. Our own trade asks nobody.
 */
export function defaultAsks(state: GcState, project: GcProject, pkg: TradePackage): string[] {
  if (pkg.selfPerform) return []
  return tradeLineup(state, project, pkg)
    .filter((r) => r.travel.inZone)
    .slice(0, BENCH_WANTED)
    .map((r) => r.partner.id)
}

/** The id the project will get. The window reads it to open the project once it is made. */
export function newProjectId(state: GcState, draft: NewProjectDraft): string {
  return freeId(slug(draft.name), state.projects.map((p) => p.id))
}

/**
 * The project the draft makes, and any customer records it names for the first time. It starts
 * in Bidding to the owner with its first set of plans and its trades. Nobody is asked yet.
 */
export function buildNewProject(state: GcState, draft: NewProjectDraft): { project: GcProject; customers: GcCustomer[] } {
  const id = newProjectId(state, draft)
  const customers: GcCustomer[] = []
  const taken = state.customers.map((c) => c.id)
  const record = (existing: string | null, name: string, kind: string): { id: string; name: string } => {
    const known = existing ? state.customers.find((c) => c.id === existing) : undefined
    if (known) return { id: known.id, name: known.name }
    const same = [...state.customers, ...customers].find((c) => c.name.toLowerCase() === name.trim().toLowerCase())
    if (same) return { id: same.id, name: same.name }
    const cid = freeId(slug(name), [...taken, ...customers.map((c) => c.id)])
    customers.push(newCustomer(cid, name.trim(), kind))
    return { id: cid, name: name.trim() }
  }
  // A customer named for the first time is filed by who they are to the job.
  const role = draft.customerRole ?? 'owner'
  const owner = record(draft.customerId, draft.ownerName, role === 'gc' ? 'General contractor' : role === 'ownersRep' ? "Owner's rep" : 'Owner')
  const architect = record(draft.architectId, draft.architectName, 'Architect')
  // The owner of the property, kept only when it is not the customer.
  const named = draft.propertyOwnerName?.trim() ?? ''
  const landlord = named !== '' || draft.propertyOwnerId ? record(draft.propertyOwnerId ?? null, named, 'Owner') : null
  const propertyOwner = landlord && landlord.id !== owner.id ? landlord : null

  const packages = packagesFromDrafts(id, draft.trades)

  const n = draft.sheets.length
  const project: GcProject = {
    id,
    name: draft.name.trim(),
    address: draft.address.trim(),
    // The town comes from the address when it names one we know (the owner, 2026-10-04); else the draft's pick.
    town: townFromAddress(draft.address) ?? draft.town,
    ourBidSentOn: null,
    ownerContractSignedOn: null,
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: owner.id,
    owner: owner.name,
    ...(propertyOwner ? { propertyOwnerId: propertyOwner.id, propertyOwner: propertyOwner.name } : {}),
    ...(role !== 'owner' ? { customerRole: role } : {}),
    ownerBilling: null,
    architectId: architect.id,
    architect: architect.name,
    questions: [],
    stage: 'pursuing',
    bidDue: draft.bidDue,
    sizeNote: draft.sizeNote.trim(),
    sheets: draft.sheets,
    ...(draft.specs && draft.specs.length > 0 ? { specs: draft.specs } : {}),
    planSets: [
      {
        rev: 0,
        label: draft.setLabel.trim() || 'Bid set',
        issuedOn: draft.issuedOn,
        note: draft.setNote.trim() || `${n} ${n === 1 ? 'sheet' : 'sheets'}.`,
        changedSheets: [],
        touches: [],
        ...(draft.drive && draft.drive.url.trim() !== '' ? { drive: { ...draft.drive, url: draft.drive.url.trim() } } : {}),
      },
    ],
    packages,
    generalConditions: 0,
    contingencyPct: NEW_PROJECT_CONTINGENCY_PCT,
    feePct: NEW_PROJECT_FEE_PCT,
  }
  return { project, customers }
}

/** A made-up sheet index to try the window with, as a cover sheet lists it. */
export const SAMPLE_SHEET_INDEX = [
  'SHEET INDEX',
  'GENERAL',
  'G-001  COVER SHEET AND CODE SUMMARY',
  'CIVIL',
  'C-101  SITE PLAN',
  'C-201  GRADING AND DRAINAGE PLAN',
  'C-301  UTILITY PLAN',
  'L-101  LANDSCAPE AND IRRIGATION PLAN',
  'ARCHITECTURAL',
  'A-101  FLOOR PLAN',
  'A-102  REFLECTED CEILING PLAN',
  'A-201  EXTERIOR ELEVATIONS',
  'A-301  WALL SECTIONS',
  'A-401  DOOR AND HARDWARE SCHEDULE',
  'A-501  ROOF PLAN AND DETAILS',
  'ID-101 FINISH PLAN',
  'STRUCTURAL',
  'S-101  FOUNDATION PLAN',
  'S-201  ROOF FRAMING PLAN',
  'MECHANICAL, ELECTRICAL AND PLUMBING',
  'M-101  HVAC PLAN',
  'P-101  PLUMBING PLAN',
  'P-201  PLUMBING RISERS',
  'E-101  LIGHTING PLAN',
  'E-201  POWER PLAN',
  'E-301  PANEL SCHEDULES',
  'FP-101 FIRE SPRINKLER PLAN',
].join('\n')

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

// ---------------------------------------------------------------------------------------------
// A set issued once the job has a schedule: the activities it touches, and the days it adds
// ---------------------------------------------------------------------------------------------

/**
 * The Dry-in milestone a set adds when it brings the job's first dry-in work onto a schedule that
 * has none, on the last dry-in finish, the way the first draft makes it (`scheduleDraft`). Null
 * when the schedule has one, or the set brought no dry-in work. The owner, 2026-10-04: "add the
 * milestone".
 */
export function dryInMilestoneFor(
  project: GcProject,
  activities: ScheduleActivity[],
  milestones: ScheduleMilestone[],
  newLineIds: string[],
): ScheduleMilestone | null {
  if (milestones.some((m) => m.id === `${project.id}-dryin` || /^dry-?in$/i.test(m.label.trim()))) return null
  const stageOf = (a: ScheduleActivity) => {
    const pkg = project.packages.find((p) => p.id === a.packageId)
    const label = pkg?.sow?.sov.find((l) => l.id === a.lineId)?.label ?? pkg?.scope.find((l) => l.id === a.lineId)?.label ?? ''
    return pkg ? lineStage(pkg.trade, label) : null
  }
  const dry = activities.filter((a) => !a.inspection && stageOf(a) === 'dryIn')
  if (!dry.some((a) => newLineIds.includes(a.lineId))) return null
  const planned = dry.reduce((m, a) => (a.finish > m ? a.finish : m), '')
  const roof = project.packages.find((k) => k.trade === 'Roofing') ?? null
  return { id: `${project.id}-dryin`, label: 'Dry-in', planned, packageId: roof?.id ?? null, metOn: null }
}

/**
 * Work a set brings onto a schedule already drawn: a new trade's lines, or lines added to a trade.
 * Each is placed the way the first draft places it (`scheduleDraft`): in its stage, after what
 * that stage waits on (the rough-in inspection for anything after the rough-ins), and after the
 * trade's own line before it along its stage's path (`stageChain`, G-143); never before `today`. What waits on its stage then waits on it too,
 * and so does the final inspection if nothing else does. A line already on the schedule stays.
 * Nothing else moves here: `pushSchedule` then moves what must start later.
 */
export function scheduleSetLines(
  project: GcProject,
  activities: ScheduleActivity[],
  lines: { packageId: string; lineId: string; label: string }[],
  today: string,
): ScheduleActivity[] {
  const fresh = lines.filter((l) => !activities.some((a) => a.lineId === l.lineId))
  if (fresh.length === 0) return activities
  const order = new Map(SCHEDULE_STAGES.map((st, i) => [st.key, i]))
  const tradeOf = (packageId: string) => project.packages.find((p) => p.id === packageId)?.trade ?? ''
  const labelOf = (a: ScheduleActivity) => {
    const pkg = project.packages.find((p) => p.id === a.packageId)
    return pkg?.sow?.sov.find((l) => l.id === a.lineId)?.label ?? pkg?.scope.find((l) => l.id === a.lineId)?.label ?? ''
  }
  const out = activities.map((a) => ({ ...a, after: [...a.after] }))
  const stageOf = new Map<string, string>()
  for (const a of out) if (!a.inspection) stageOf.set(a.lineId, lineStage(tradeOf(a.packageId), labelOf(a)))
  const roughInspection = out.find((a) => a.inspection && a.lineId === `${project.id}-insp-roughin`) ?? null
  const finalInspection = out.find((a) => a.inspection && a.lineId === `${project.id}-insp-final`) ?? null
  const inStage = (key: string) => out.filter((a) => stageOf.get(a.lineId) === key)
  const gateOf = (key: string): string | null => {
    let at = SCHEDULE_STAGES.find((st) => st.key === key)?.after ?? null
    while (at && inStage(at).length === 0) at = SCHEDULE_STAGES.find((st) => st.key === at)?.after ?? null
    return at
  }
  const placed = fresh
    .map((l, index) => ({ ...l, stage: lineStage(tradeOf(l.packageId), l.label), index }))
    .sort((a, b) => (order.get(a.stage) ?? 0) - (order.get(b.stage) ?? 0) || a.index - b.index)
  for (const line of placed) {
    const stage = SCHEDULE_STAGES.find((st) => st.key === line.stage)
    const gate = gateOf(line.stage)
    const gateActs = gate === 'roughIn' && roughInspection ? [roughInspection] : gate ? inStage(gate) : []
    const gateDay = gateActs.reduce<string | null>((m, a) => (m === null || a.finish > m ? a.finish : m), null)
    // The trade's own line before it, along its stage's own path (G-143): a crew does its lines one after another,
    // and a site line never waits on the trade's inside work.
    const chain = stageChain(line.stage)
    const own = out
      .filter((a) => a.packageId === line.packageId && !a.inspection && chain.has(stageOf.get(a.lineId) ?? ''))
      .sort((a, b) => (a.finish < b.finish ? -1 : a.finish > b.finish ? 1 : 0))
    const prev = own[own.length - 1]
    const from = [today, gateDay ? plusDays(gateDay, 1 + (stage?.lag ?? 0)) : today, prev ? plusDays(prev.finish, 1) : today].reduce((m, d) => (d > m ? d : m))
    const shares = placed.filter((l) => l.packageId === line.packageId && l.stage === line.stage).length
    const days = Math.max(2, Math.ceil((stage?.days ?? 5) / Math.max(1, shares)))
    const a: ScheduleActivity = {
      lineId: line.lineId,
      packageId: line.packageId,
      start: from,
      finish: plusDays(from, days - 1),
      after: [...new Set([...gateActs.map((g) => g.lineId), ...(prev ? [prev.lineId] : [])])],
    }
    out.push(a)
    stageOf.set(a.lineId, line.stage)
    // What waits on this stage waits on the new line too. A stage the job had no work in until now
    // becomes the gate for the stage after it.
    for (const b of out) {
      if (b === a) continue
      if (b.inspection) {
        if (b === roughInspection && line.stage === 'roughIn') b.after.push(a.lineId)
        continue
      }
      const bGate = gateOf(stageOf.get(b.lineId) ?? '')
      if (bGate === line.stage && !(bGate === 'roughIn' && roughInspection) && !b.after.includes(a.lineId)) b.after.push(a.lineId)
    }
  }
  // The final inspection waits on every line nothing else waits on.
  if (finalInspection) {
    for (const a of out) {
      if (a === finalInspection || a.inspection) continue
      if (!out.some((b) => b.after.includes(a.lineId)) && !finalInspection.after.includes(a.lineId)) finalInspection.after.push(a.lineId)
    }
  }
  return out
}

/**
 * The scheduled activities a set's changed sheets and sections reach: the scope lines they touch,
 * found on the schedule by line id (a statement of work keeps its scope line ids). Empty with no
 * schedule. `addedSpecs`: sections the set adds to the manual, so a line's guess can read them.
 */
export function activitiesTouched(
  project: GcProject,
  sheetIds: string[],
  specIds: string[] = [],
  addedSpecs: SpecSection[] = [],
  addedSheets: PlanSheet[] = [],
): ScheduleActivity[] {
  const schedule = project.schedule
  if (!schedule || sheetIds.length + specIds.length === 0) return []
  const ids = new Set(project.packages.flatMap((pkg) => linesOnPlans(project, pkg, sheetIds, specIds, addedSpecs, addedSheets).map((l) => l.id)))
  return schedule.activities.filter((a) => ids.has(a.lineId))
}

/** What a push does: every activity's new dates, the ones that moved, and the job's last day before and after. */
export interface SchedulePush {
  activities: ScheduleActivity[]
  moved: { lineId: string; days: number }[]
  lastBefore: string
  lastAfter: string
}

function dayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}

/**
 * Add days to activities a set changes: each one's finish moves out by its days (the work takes
 * longer), and everything waiting on it moves out as far as it must to start the day after, never
 * earlier than it was. Lengths are kept. A loop in what waits on what is left as drawn.
 */
export function pushSchedule(activities: ScheduleActivity[], pushes: Record<string, number>): SchedulePush {
  const byId = new Map(activities.map((a) => [a.lineId, { ...a }]))
  const order: string[] = []
  const placed = new Set<string>()
  const place = (id: string, seen: Set<string>) => {
    const a = byId.get(id)
    if (!a || placed.has(id) || seen.has(id)) return
    seen.add(id)
    for (const before of a.after) place(before, seen)
    placed.add(id)
    order.push(id)
  }
  for (const a of activities) place(a.lineId, new Set())
  for (const id of order) {
    const a = byId.get(id)
    if (!a) continue
    const length = dayIndex(a.finish) - dayIndex(a.start)
    const waits = a.after.map((b) => byId.get(b)?.finish).filter((f): f is string => !!f)
    const latest = waits.reduce<string | null>((m, f) => (m === null || f > m ? f : m), null)
    if (latest && latest >= a.start) {
      a.start = plusDays(latest, 1)
      a.finish = plusDays(a.start, length)
    }
    const add = Math.max(0, Math.round(pushes[id] ?? 0))
    if (add > 0) a.finish = plusDays(a.finish, add)
  }
  const next = activities.map((a) => byId.get(a.lineId) ?? a)
  const moved = activities
    .map((a) => ({ lineId: a.lineId, days: dayIndex(byId.get(a.lineId)?.finish ?? a.finish) - dayIndex(a.finish) }))
    .filter((m) => m.days > 0)
  const last = (list: ScheduleActivity[]) => list.reduce((m, a) => (a.finish > m ? a.finish : m), '')
  return { activities: next, moved, lastBefore: last(activities), lastAfter: last(next) }
}

// ---------------------------------------------------------------------------------------------
// A set that changes a job we have won starts its change orders to the owner
// ---------------------------------------------------------------------------------------------

function wordsAnd(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * The words a change order to the owner starts with when a set of plans changes a trade on a job
 * we have won: what the set does to the trade, "per" its sheets, and the time it adds to the job.
 * No closing full stop: Owner Billing adds it. The office types the cost; Owner Billing's draft
 * adds our fee for the price (reason 'plans', price 0, its `changeOrderPrice`). `days`: the time as
 * a number, for draftChangeOrder's `days`, so signed change orders add up.
 */
export function changeOrderFromSet(
  set: { label: string; note: string; sheets: string[]; specs?: string[] },
  trade: string,
  addedLines: string[],
  jobDays: number,
): { description: string; schedule: string; days: number } {
  // The note's first sentence, without a sheet number at its head ("E-201: the tenant…"): "per" names the sheets.
  const firstSentence = (set.note.trim().split(/(?<=[.!?])\s+/)[0] ?? '')
    .replace(/[.!?]+$/, '')
    .replace(/^[A-Za-z]{1,2}-?\d[\d.]*[A-Za-z]?\s*[:\-–—]\s*/, '')
    .replace(/^(?:section\s+)?\d{2}[ .-]?\d{2}[ .-]?\d{2}\s*[:\-–—]\s*/i, '')
  // Lower the first letter to run on after the colon, unless the word is in capitals (RTU-3).
  const runOn = /^[A-Z][A-Z0-9]/.test(firstSentence) ? firstSentence : firstSentence.charAt(0).toLowerCase() + firstSentence.slice(1)
  const what = addedLines.length > 0 ? `adds ${wordsAnd(addedLines.map((l) => l.trim().toLowerCase()))}` : runOn
  // Plain words reach the owner's portal and the pay application: "per E-102", never in brackets.
  const per = [...set.sheets, ...(set.specs ?? [])]
  const sheets = per.length > 0 ? `, per ${wordsAnd(per)}` : ''
  return {
    description: `${set.label}, ${trade}: ${what || 'the changes in the set'}${sheets}`,
    schedule: jobDays > 0 ? `+${jobDays} ${jobDays === 1 ? 'day' : 'days'}` : 'none',
    days: jobDays > 0 ? Math.round(jobDays) : 0,
  }
}

/**
 * Which of a set's change orders carries the days it adds to the job: the first one going out
 * (ticked, with a cost and words) whose trade caused them. One only, so the signed change orders'
 * days add up to the job's. Null: no days, or no change order to carry them.
 */
export function changeOrderTakingTheDays(
  rows: { id: string; on: boolean; cost: number; description: string; cause: boolean }[],
  jobDays: number,
): string | null {
  if (jobDays <= 0) return null
  return rows.find((r) => r.on && r.cost !== 0 && r.description.trim() !== '' && r.cause)?.id ?? null
}

// ---------------------------------------------------------------------------------------------
// The specs: the project manual's sections, the trades they point at, the lines that read them
// ---------------------------------------------------------------------------------------------

/** One section of the manual as it stands at a set: the newest set, up to that one, that revised it. */
export interface SpecInSet extends SpecSection {
  /** Null: as first issued. */
  changedInRev: number | null
  /** The manual did not have it before a set added it. */
  added: boolean
  /** The title before the newest set that renamed it. */
  was?: string
}

/** A section a set took out, as it was titled when it went. */
export interface SpecGone extends SpecSection {
  goneInRev: number
}

function walkSpecs(project: GcProject, rev: number): { live: SpecInSet[]; gone: SpecGone[] } {
  const out = new Map<string, SpecInSet>()
  const gone = new Map<string, SpecGone>()
  for (const spec of project.specs ?? []) out.set(spec.id, { ...spec, changedInRev: null, added: false })
  const sets = project.planSets.filter((x) => x.rev <= rev).sort((a, b) => a.rev - b.rev)
  for (const set of sets) {
    for (const id of set.changedSpecs ?? []) {
      const known = out.get(id)
      const title = set.addedSpecs?.find((x) => x.id === id)?.title || gone.get(id)?.title || `Added by ${set.label}`
      out.set(id, known ? { id: known.id, title: known.title, changedInRev: set.rev, added: known.added } : { id, title, changedInRev: set.rev, added: true })
      gone.delete(id)
    }
    for (const x of set.retitledSpecs ?? []) {
      const known = out.get(x.id)
      if (known) out.set(x.id, { ...known, title: x.title, was: known.title, changedInRev: set.rev })
    }
    for (const id of set.removedSpecs ?? []) {
      const known = out.get(id)
      if (!known) continue
      out.delete(id)
      gone.set(id, { id, title: known.was ?? known.title, goneInRev: set.rev })
    }
  }
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
  return { live: [...out.values()].sort(byId), gone: [...gone.values()].sort(byId) }
}

/**
 * The manual as it stands at one set: the sections the project began with plus what each set
 * revised, renamed or added, in number order. A section a set took out is not in it.
 */
export function specsAtRev(project: GcProject, rev: number): SpecInSet[] {
  return walkSpecs(project, rev).live
}

/** The sections taken out by the sets up to this one. */
export function specsGoneAtRev(project: GcProject, rev: number): SpecGone[] {
  return walkSpecs(project, rev).gone
}

/** A scope line a set leaves with nothing to read: every sheet it read, or every section, goes. */
export interface LineLeftBehind {
  packageId: string
  item: ScopeItem
  /** Its sheets all go. */
  sheets: string[]
  /** Its sections all go. */
  specs: string[]
}

/**
 * The scope lines a set leaves behind: lines that read from sheets or sections, and every one of
 * them is taken out. A line that names none reads its trade as a whole, so it is never left.
 */
export function linesLeftBehind(project: GcProject, goneSheets: string[], goneSpecs: string[]): LineLeftBehind[] {
  if (goneSheets.length + goneSpecs.length === 0) return []
  const out: LineLeftBehind[] = []
  for (const pkg of project.packages) {
    for (const item of pkg.scope) {
      const sheets = lineSheets(project, pkg, item).sheets
      const specs = lineSpecs(project, pkg, item).specs
      const noSheets = sheets.length > 0 && sheets.every((id) => goneSheets.includes(id))
      const noSpecs = specs.length > 0 && specs.every((id) => goneSpecs.includes(id))
      if (noSheets || noSpecs) out.push({ packageId: pkg.id, item, sheets: noSheets ? sheets : [], specs: noSpecs ? specs : [] })
    }
  }
  return out
}

/** Scope lines a set ties to new sheets or sections, because what they read is gone. */
export function withRetiedLines(
  project: GcProject,
  lines: { packageId: string; scopeId: string; sheets?: string[]; specs?: string[] }[],
): GcProject {
  if (lines.length === 0) return project
  return {
    ...project,
    packages: project.packages.map((pkg) => {
      const mine = lines.filter((l) => l.packageId === pkg.id)
      if (mine.length === 0) return pkg
      return {
        ...pkg,
        scope: pkg.scope.map((item) => {
          const tie = mine.find((l) => l.scopeId === item.id)
          if (!tie) return item
          return { ...item, ...(tie.sheets ? { sheets: tie.sheets } : {}), ...(tie.specs ? { specs: tie.specs } : {}) }
        }),
      }
    }),
  }
}

/**
 * A made-up reissued index for trying a whole new set on any project: the second sheet of the
 * first discipline with two goes (folded into the first, which is renamed for it), and two
 * sheets are new. Written as an index prints, in capitals.
 */
export function sampleReissue(sheets: PlanSheet[]): string {
  const byDiscipline = new Map<string, PlanSheet[]>()
  for (const x of sheets) byDiscipline.set(sheetDiscipline(x.id), [...(byDiscipline.get(sheetDiscipline(x.id)) ?? []), x])
  const pair = [...byDiscipline.values()].find((list) => list.length >= 2)
  const keep = pair?.[0]
  const drop = pair?.[1]
  const dashed = sheets.filter((x) => x.id.includes('-')).length >= sheets.length / 2
  const id = (letters: string, n: number) => (dashed ? `${letters}-${n}` : `${letters}${n}`)
  const free = (letters: string, from: number) => {
    let n = from
    while (sheets.some((x) => x.id.toUpperCase().replace(/[-.\s]/g, '') === `${letters}${n}`)) n += 1
    return id(letters, n)
  }
  const lines = sheets
    .filter((x) => x.id !== drop?.id)
    .map((x) => `${x.id}  ${(x.id === keep?.id && drop ? `${x.title}, ${drop.title.charAt(0).toLowerCase()}${drop.title.slice(1)}` : x.title).toUpperCase()}`)
  lines.push(`${free('A', 601)}  INTERIOR DETAILS`, `${free('E', 401)}  FIRE ALARM PLAN`)
  return ['SHEET INDEX', ...lines].join('\n')
}

/** A made-up reissued table of contents: one section of the first division with two goes, and ceramic tiling comes in. */
export function sampleReissueSpecs(specs: SpecSection[]): string {
  const counts = new Map<string, number>()
  for (const x of specs) counts.set(specDivision(x.id), (counts.get(specDivision(x.id)) ?? 0) + 1)
  const drop = specs.filter((x) => !['00', '01'].includes(specDivision(x.id)) && (counts.get(specDivision(x.id)) ?? 0) >= 2).pop()
  const lines = specs.filter((x) => x.id !== drop?.id).map((x) => `${x.id}  ${x.title.toUpperCase()}`)
  if (!specs.some((x) => x.id === '09 30 13')) lines.push('09 30 13  CERAMIC TILING')
  return ['TABLE OF CONTENTS', ...lines.sort()].join('\n')
}

/** The trades on a project that a set's sections change: each section's trade, read from its number. */
export function packagesForSpecs(project: GcProject, specIds: string[]): string[] {
  const trades = new Set(specIds.map(tradeForSpec).filter((t): t is string => t !== null))
  return project.packages.filter((p) => trades.has(p.trade)).map((p) => p.id)
}

/** The sections of the newest manual that point at a trade, with any a set is adding. */
export function tradeSpecs(project: GcProject, trade: string, added: SpecSection[] = []): SpecSection[] {
  const manual = specsAtRev(project, currentRev(project))
  const all = [...manual, ...added.filter((a) => !manual.some((x) => x.id === a.id))]
  return all.filter((x) => tradeForSpec(x.id) === trade)
}

/** The sections one scope line reads from: what the office said, or the guess when it said nothing. */
export function lineSpecs(project: GcProject, pkg: TradePackage, item: ScopeItem, added: SpecSection[] = []): { specs: string[]; guessed: boolean } {
  if (item.specs) return { specs: item.specs, guessed: false }
  return { specs: guessLineSpecs(item.label, tradeSpecs(project, pkg.trade, added)), guessed: true }
}

/**
 * Whether a line reads from a section. A line that names no section stands for the whole trade,
 * so any section of its trade counts, the rule the owner set for sheets (2026-10-02).
 */
export function lineReadsSpec(project: GcProject, pkg: TradePackage, item: ScopeItem, specId: string, added: SpecSection[] = []): boolean {
  const said = lineSpecs(project, pkg, item, added).specs
  return said.length > 0 ? said.includes(specId) : tradeForSpec(specId) === pkg.trade
}

/** The scope lines of a trade that read from any of these sections, a line that names none included. */
export function linesOnSpecs(project: GcProject, pkg: TradePackage, specIds: string[], added: SpecSection[] = []): ScopeItem[] {
  return pkg.scope.filter((item) => specIds.some((id) => lineReadsSpec(project, pkg, item, id, added)))
}

/**
 * The scope lines a set names to a trade, read the way the trade's portal reads them (the owner,
 * 2026-10-03: a trade sees only the sheets the office set; 2026-10-04: the email follows the
 * portal). A line whose sheets were only guessed reads its whole trade's sheets, so it is named
 * when any of them changes. Sections read as `linesOnSpecs` does. The email and the window's list
 * of lines a set touches use this; the schedule and the change orders keep the office's guess.
 */
export function linesATradeHears(
  project: GcProject,
  pkg: TradePackage,
  sheetIds: string[],
  specIds: string[],
  addedSpecs: SpecSection[] = [],
  addedSheets: PlanSheet[] = [],
): ScopeItem[] {
  const whole = tradeSheets(project, pkg.trade, addedSheets).map((x) => x.id)
  const onSpecs = new Set(linesOnSpecs(project, pkg, specIds, addedSpecs).map((l) => l.id))
  return pkg.scope.filter((item) => {
    const reads = item.sheets && item.sheets.length > 0 ? item.sheets : whole
    return reads.some((id) => sheetIds.includes(id)) || onSpecs.has(item.id)
  })
}

/** The scope lines a set reaches through its sheets or its sections, in the scope's order. */
export function linesOnPlans(
  project: GcProject,
  pkg: TradePackage,
  sheetIds: string[],
  specIds: string[],
  added: SpecSection[] = [],
  addedSheets: PlanSheet[] = [],
): ScopeItem[] {
  const onSheets = new Set(linesOnSheets(project, pkg, sheetIds, addedSheets).map((l) => l.id))
  const onSpecs = new Set(linesOnSpecs(project, pkg, specIds, added).map((l) => l.id))
  return pkg.scope.filter((item) => onSheets.has(item.id) || onSpecs.has(item.id))
}

// ---------------------------------------------------------------------------------------------
// The plans live in Google Drive (the owner, 2026-10-04: "I want to always have it go to a Google
// Drive link where there is a notification that says this link is accessible by anyone, this
// works, versus this link is only accessible by some, please correct.")
// ---------------------------------------------------------------------------------------------

/** A made-up folder anyone with the link can open, to try the check with. */
export const SAMPLE_DRIVE_OPEN = 'https://drive.google.com/drive/folders/1HcBidSetAnyoneWithTheLink'
/** A made-up file only some people can open. */
export const SAMPLE_DRIVE_RESTRICTED = 'https://drive.google.com/file/d/1HcPlansOnlySomePeople/view'

/** A Google Drive file or folder link, read: what it points at and its id. Null: not a Drive link. */
export function driveLink(url: string): { kind: 'file' | 'folder'; id: string } | null {
  const u = url.trim().replace(/^(?!https?:\/\/)(?=drive\.google\.com)/, 'https://')
  const file = u.match(/^https?:\/\/drive\.google\.com\/(?:u\/\d+\/)?file\/d\/([\w-]{10,})/) ?? u.match(/^https?:\/\/drive\.google\.com\/open\?id=([\w-]{10,})/)
  if (file?.[1]) return { kind: 'file', id: file[1] }
  const folder = u.match(/^https?:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/)
  if (folder?.[1]) return { kind: 'folder', id: folder[1] }
  return null
}

/**
 * Who can open a Drive link: the prototype's stand-in for the real check. The real one is the
 * owner's: a helper opens the link with no Google sign-in, and a sign-in page or "You need access"
 * means only some people can open it. The made-up restricted link reads
 * restricted until the office says it fixed it in Drive; any other Drive link reads open, said as
 * assumed. Null: not a Drive link.
 */
export function driveAccessStandIn(url: string, fixedInDrive = false): { access: 'anyone' | 'restricted'; assumed: boolean } | null {
  const link = driveLink(url)
  if (!link) return null
  if (link.id === driveLink(SAMPLE_DRIVE_RESTRICTED)?.id) return { access: fixedInDrive ? 'anyone' : 'restricted', assumed: false }
  if (link.id === driveLink(SAMPLE_DRIVE_OPEN)?.id) return { access: 'anyone', assumed: false }
  return { access: 'anyone', assumed: true }
}

/**
 * What stops a set's Drive link, for a window's footer. Null: the link is fine. A link only some
 * people can open is a warning, not a stop (the owner, 2026-10-04: "When the link is blocked and our
 * helper cannot see the link without an account, we should give a warning.").
 */
export function driveLinkProblem(url: string): string | null {
  if (url.trim() === '') return 'Add the Google Drive link to the plans.'
  if (!driveLink(url)) return 'The plans link is not a Google Drive link.'
  return null
}

// ---------------------------------------------------------------------------------------------
// What the kinds of plan sets are (the owner, 2026-10-04: "I think it's important that we explain
// to a user what these different kinds of plans are." He wrote the facts; these are his, made short.)
// ---------------------------------------------------------------------------------------------

/** One kind of set a new project starts from: when it comes, who gets it, what is in it, what it is for. */
export interface SetKindHelp {
  kind: string
  alsoCalled?: string
  when: string
  who: string
  inIt: string
  forWhat: string
}

/** The three kinds on New project's step 2, in the chips' order. */
export const SET_KIND_HELP: SetKindHelp[] = [
  {
    kind: 'Bid set',
    when: 'Usually at 100% construction documents. It is complete enough for a contractor to commit to a firm price.',
    who: 'General contractors for competitive bidding, and through them the subcontractors.',
    inIt: 'The full project manual. That is the technical specifications, bidding instructions, bid forms, and general and supplementary conditions.',
    forWhat:
      'A firm price. Questions and changes during bidding come as formal addenda. Once a contractor is picked, the bid set and its addenda are the basis of the contract.',
  },
  {
    kind: 'Pricing set',
    alsoCalled: 'Also called a budget set or an estimating set.',
    when: 'Partway through design. Often around design development, or at 50 to 75% construction documents.',
    who: 'A contractor or construction manager, usually on a negotiated or design-assist job.',
    inIt: 'Less than a full set. The specifications may be an outline, and many details are missing. The contractor fills the gaps with allowances, assumptions and qualifications.',
    forWhat:
      'A budget check. The owner can check the budget, explore value engineering, and catch cost problems before the design is locked in. It is not meant to set a binding contract price.',
  },
  {
    kind: 'Permit set',
    when: 'When the drawings go in for plan review. They are revised until they are approved.',
    who: 'The building department, or another authority having jurisdiction.',
    inIt: 'What code asks for, more than buildability or cost. It shows life safety and egress, fire separations, structural design, accessibility, energy code, and MEP systems as code sees them. It usually has a code analysis sheet, structural calculations and energy compliance forms. It carries the seals and signatures of the licensed architects and engineers. It can be light on what the reviewer does not need, like finishes, casework detail or the owner\'s own preferences.',
    forWhat: 'Code approval. Plan reviewers send comments, and the drawings get revised until approved. The approved, stamped set has to be kept on the job site.',
  },
]

// ---------------------------------------------------------------------------------------------
// The budgets against the size (the owner, 2026-10-04: "show the amount of square feet added at
// the prior page and then the cost per square foot, broken down by trade, and the total")
// ---------------------------------------------------------------------------------------------

/** An amount per square foot, to the cent: 12.3529 reads "$12.35/sq ft". */
export function perSqFtWords(perSqFt: number): string {
  return `$${perSqFt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/sq ft`
}

/** One trade's budget and what it comes to a square foot (null: no size given). */
export interface BudgetLine {
  trade: string
  amount: number
  ours: boolean
  perSqFt: number | null
}

/** Each ticked trade's budget over the project's size, and the total. No size: amounts only. */
export function budgetBySize(
  lines: { trade: string; amount: number; ours: boolean }[],
  sqFt: number | null,
): { lines: BudgetLine[]; total: number; totalPerSqFt: number | null } {
  const per = (amount: number) => (sqFt && sqFt > 0 ? amount / sqFt : null)
  const total = lines.reduce((n, l) => n + l.amount, 0)
  return { lines: lines.map((l) => ({ ...l, perSqFt: per(l.amount) })), total, totalPerSqFt: per(total) }
}

// ---------------------------------------------------------------------------------------------
// The sheet index as a table: rows from a plan PDF, a paste or typing (the owner, 2026-10-04:
// "build 1, 4 and 5 for the sheet index")
// ---------------------------------------------------------------------------------------------

/** The disciplines a sheet can be put in when its number's letters do not say. */
export const SHEET_DISCIPLINES = ['General', 'Civil', 'Landscape', 'Architectural', 'Interiors', 'Structural', 'Fire protection', 'Plumbing', 'Mechanical', 'Electrical', 'Technology']

/** A sheet's discipline: the office's pick, else read from its number's letters. */
export function disciplineOf(sheet: PlanSheet): string {
  return sheet.discipline ?? sheetDiscipline(sheet.id)
}

/**
 * The trades the sheets suggest, with each sheet the office put in a discipline its letters do not
 * say added to that discipline's trades. `guesses` is what `tradesForPlans` or `tradesForSheets` said.
 */
export function withPickedDisciplines<T extends { trade: string; from: string[] }>(guesses: T[], sheets: PlanSheet[], blank: (trade: string) => T): T[] {
  const picked = sheets.filter((s) => s.discipline && s.discipline !== sheetDiscipline(s.id))
  if (picked.length === 0) return guesses
  const out = new Map(guesses.map((g) => [g.trade, { ...g, from: [...g.from] }]))
  for (const s of picked) {
    for (const t of TRADE_TEMPLATES) {
      if (!t.disciplines.includes(s.discipline ?? '')) continue
      const g = out.get(t.trade) ?? blank(t.trade)
      if (!g.from.includes(s.id)) g.from = [...g.from, s.id]
      out.set(t.trade, g)
    }
  }
  return [...out.values()].sort((a, b) => tradeOrder(a.trade) - tradeOrder(b.trade))
}

/** One row of the sheet table while the office works on it. */
export interface SheetIndexRow {
  key: string
  id: string
  title: string
  discipline?: string
  page?: number
  from: 'pdf' | 'paste' | 'typed'
  /** Why the row could not be read, for a page of a PDF: shown until the office fixes it. */
  problem?: string
}

/** What is wrong with each row, by key: no number yet, or a number another row has. */
export function rowProblems(rows: SheetIndexRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  const seen = new Map<string, string>()
  for (const r of rows) {
    const bare = r.id.toUpperCase().replace(/[-.\s]/g, '')
    if (bare === '') out[r.key] = r.problem ?? 'Give it a sheet number.'
    else if (seen.has(bare)) out[r.key] = `Sheet ${r.id.trim()} is listed twice.`
    else seen.set(bare, r.key)
  }
  return out
}

/** The sheets the table holds: each row with a number, the first of any repeated number. */
export function sheetsOfRows(rows: SheetIndexRow[]): PlanSheet[] {
  const problems = rowProblems(rows)
  return rows
    .filter((r) => !problems[r.key])
    .map((r) => ({
      id: r.id.trim().toUpperCase(),
      title: r.title.trim(),
      ...(r.discipline && r.discipline !== sheetDiscipline(r.id) ? { discipline: r.discipline } : {}),
      ...(r.page ? { page: r.page } : {}),
    }))
}

/** The number after this one, for + Add sheet: A-101 gives A-102, A1.01 gives A1.02, E-9 gives E-10. */
export function nextSheetNumber(id: string): string {
  const m = id.trim().toUpperCase().match(/^(.*?)(\d+)[A-Z]?$/)
  if (!m) return ''
  const digits = m[2] ?? ''
  const next = String(Number(digits) + 1).padStart(digits.length, '0')
  return `${m[1] ?? ''}${next}`
}

/** One pasted line, read or skipped with why. */
export interface PastedLine {
  line: string
  sheet: PlanSheet | null
  why: string | null
}

const SHEET_NUMBER_AT_END = /^(.*?[A-Za-z].*?)[\s.\-–—:]+([A-Za-z]{1,2}(?:-\d{1,3}(?:\.\d{1,3})?|-?\d\.\d{2}|\d{3})[A-Za-z]?)\s*$/

/**
 * A pasted sheet list read line by line (any layout: tabs, dot leaders, dashes, capitals, the
 * number before the title or after it). Each line is read, or skipped with why, so nothing goes
 * missing unsaid. `already` holds the numbers the table has, so a repeat says so.
 */
export function readSheetLines(text: string, already: string[] = []): PastedLine[] {
  const bare = (x: string) => x.toUpperCase().replace(/[-.\s]/g, '')
  const seen = new Set(already.map(bare))
  const out: PastedLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, '  ').trim()
    if (line === '') continue
    if (!/\d/.test(line)) {
      out.push({ line, sheet: null, why: 'A heading, with no sheet number.' })
      continue
    }
    // A list number or a bullet in front, a "Sheet" word, and a date or a dot leader after the title are not part of it.
    const plain = line
      .replace(/^(?:\d{1,3}[.)]\s+|\d{1,3}\s+(?=[A-Za-z]{1,2}[-.\s]?\d)|[-•*·]\s+)/, '')
      .replace(/^sheet\s+(?:no\.?\s*)?/i, '')
      .replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, '')
    let sheet = sheetIndexInText(plain).sheets[0] ?? null
    if (!sheet) {
      const flipped = plain.match(SHEET_NUMBER_AT_END)
      if (flipped?.[1] && flipped[2]) sheet = sheetIndexInText(`${flipped[2]}  ${flipped[1].replace(/[\s.\-–—:]+$/, '')}`).sheets[0] ?? null
    }
    if (sheet) sheet = { ...sheet, title: sheet.title.replace(/\s*\.{3,}.*$/, '').trim() }
    if (!sheet) {
      out.push({ line, sheet: null, why: 'No sheet number at the start or the end of the line.' })
      continue
    }
    if (seen.has(bare(sheet.id))) {
      out.push({ line, sheet: null, why: `Sheet ${sheet.id} is already in the list.` })
      continue
    }
    seen.add(bare(sheet.id))
    out.push({ line, sheet, why: null })
  }
  return out
}

/** One piece of text on a PDF page: where it sits (from the bottom-left, in points) and how big it is. */
export interface PdfTextItem {
  str: string
  x: number
  y: number
  size: number
}

/** A page's text with the pieces of one line of words joined ("FIRST" and "FLOOR PLAN" read as one title). */
function textRuns(items: PdfTextItem[]): PdfTextItem[] {
  const pieces = items.map((i) => ({ ...i, str: i.str.replace(/\s+/g, ' ') })).filter((i) => i.str.trim() !== '')
  pieces.sort((a, b) => b.y - a.y || a.x - b.x)
  const runs: (PdfTextItem & { end: number })[] = []
  for (const p of pieces) {
    const last = runs[runs.length - 1]
    const width = p.str.length * p.size * 0.5
    if (last && Math.abs(last.y - p.y) < p.size * 0.3 && Math.abs(last.size - p.size) < 0.5 && p.x - last.end < p.size * 1.2 && p.x >= last.x) {
      last.str = `${last.str}${/\s$/.test(last.str) || /^\s/.test(p.str) ? '' : ' '}${p.str}`
      last.end = p.x + width
    } else {
      runs.push({ ...p, end: p.x + width })
    }
  }
  return runs.map(({ end: _end, ...r }) => ({ ...r, str: r.str.trim() }))
}

const LONE_SHEET_NUMBER = /^[A-Za-z]{1,2}(?:-\d{1,3}(?:\.\d{1,3})?|-?\d\.\d{2}|\d{3})[A-Za-z]?$/
const BLOCK_LABEL = /^(sheet(\s*(title|no\.?|number|name))?|title|drawing( title)?|project|issued?|date|scale|drawn( by)?|checked( by)?|revisions?|job( no\.?)?)\s*:?$/i

/**
 * A sheet's number and title read from its page's title block. The number is the biggest lone sheet
 * number in the bottom-right of the page (anywhere, if the corner has none). The title is the text
 * under a "Sheet title" label, else the nearest text above the number that is not a label. Null:
 * no sheet number on the page, so the office types it.
 */
export function readTitleBlock(items: PdfTextItem[], width: number, height: number): PlanSheet | null {
  const text = textRuns(items)
  const numbers = text.filter((i) => LONE_SHEET_NUMBER.test(i.str))
  if (numbers.length === 0) return null
  const inCorner = (i: PdfTextItem) => i.x > width * 0.55 && i.y < height * 0.5
  const pool = numbers.some(inCorner) ? numbers.filter(inCorner) : numbers
  const number = [...pool].sort((a, b) => b.size - a.size || a.y - b.y)[0]
  if (!number) return null
  const words = text.filter((i) => i !== number && /[A-Za-z]{2}/.test(i.str) && !BLOCK_LABEL.test(i.str) && !LONE_SHEET_NUMBER.test(i.str))
  const label = text.find((i) => /^(sheet\s*title|drawing\s*title|title)\s*:?$/i.test(i.str))
  const below = label ? words.filter((i) => i.y < label.y && Math.abs(i.x - label.x) < width * 0.25).sort((a, b) => b.y - a.y)[0] : undefined
  const above = words.filter((i) => i.y > number.y && Math.abs(i.x - number.x) < width * 0.3).sort((a, b) => a.y - b.y)[0]
  // A title under its label may run onto the lines below it, in the same size of type.
  const lines = below ? [below] : above ? [above] : []
  for (let last = below; last; ) {
    const from: PdfTextItem = last
    const next: PdfTextItem | undefined = words
      .filter((i) => i.y < from.y && from.y - i.y < from.size * 1.6 && Math.abs(i.size - from.size) < 0.5 && Math.abs(i.x - from.x) < from.size * 2)
      .sort((a, b) => b.y - a.y)[0]
    if (next) lines.push(next)
    last = next
  }
  const title = lines.map((i) => i.str).join(' ')
  return sheetIndexInText(`${number.str}  ${title}`).sheets[0] ?? { id: number.str.toUpperCase(), title }
}

/** A made-up table of contents for the made-up clinic, as a project manual prints it. */
export const SAMPLE_SPEC_INDEX = [
  'PROJECT MANUAL, TABLE OF CONTENTS',
  'DIVISION 01 - GENERAL REQUIREMENTS',
  '01 10 00  SUMMARY',
  '01 25 00  SUBSTITUTION PROCEDURES',
  'DIVISION 03 - CONCRETE',
  '03 30 00  CAST-IN-PLACE CONCRETE',
  'DIVISION 05 - METALS',
  '05 12 00  STRUCTURAL STEEL FRAMING',
  '05 31 00  STEEL DECKING',
  'DIVISION 07 - THERMAL AND MOISTURE PROTECTION',
  '07 54 23  THERMOPLASTIC POLYOLEFIN ROOFING',
  '07 62 00  SHEET METAL FLASHING AND TRIM',
  'DIVISION 08 - OPENINGS',
  '08 11 13  HOLLOW METAL DOORS AND FRAMES',
  '08 41 13  ALUMINUM-FRAMED ENTRANCES AND STOREFRONTS',
  '08 71 00  DOOR HARDWARE',
  'DIVISION 09 - FINISHES',
  '09 22 16  NON-STRUCTURAL METAL FRAMING',
  '09 29 00  GYPSUM BOARD',
  '09 51 13  ACOUSTICAL PANEL CEILINGS',
  '09 65 19  RESILIENT TILE FLOORING',
  '09 91 23  INTERIOR PAINTING',
  'DIVISION 21 - FIRE SUPPRESSION',
  '21 13 13  WET-PIPE SPRINKLER SYSTEMS',
  'DIVISION 22 - PLUMBING',
  '22 11 16  DOMESTIC WATER PIPING',
  '22 40 00  PLUMBING FIXTURES',
  'DIVISION 23 - HVAC',
  '23 31 13  METAL DUCTS',
  '23 74 13  PACKAGED ROOFTOP AIR-CONDITIONING UNITS',
  'DIVISION 26 - ELECTRICAL',
  '26 24 16  PANELBOARDS',
  '26 51 00  INTERIOR LIGHTING',
  'DIVISION 31 - EARTHWORK',
  '31 23 00  EXCAVATION AND FILL',
  'DIVISION 32 - EXTERIOR IMPROVEMENTS',
  '32 12 16  ASPHALT PAVING',
  '32 84 00  PLANTING IRRIGATION',
].join('\n')
