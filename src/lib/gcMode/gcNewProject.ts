/**
 * GC mode — design spike. New Project, and splitting the plans into trades: the sheet index is
 * read out of what the office pastes, the trades are guessed from the sheets, and each trade
 * starts from its usual scope. A later set of plans uses the same guess, and can bring a trade
 * the job did not have. Every guess here is a starting point the office changes.
 */
import type { GcCustomer, GcProject, GcState, NewProjectDraft, NewTradeDraft, PlanSheet, ProjectSchedule, ScheduleActivity, ScheduleMilestone, ScopeItem, SpecSection, TradePackage } from './gcTypes'
import { sheetDiscipline, sheetsAtRev } from './gcPlans'
import { currentRev } from './gcLookups'
import { tradeLineup } from './gcMap'
import { BENCH_WANTED } from './gcBench'

/**
 * One trade the office may buy. The list runs in the order the specs list trades (by division),
 * not the order the work goes in: the schedule's first draft reads the stages of the job instead.
 */
export interface TradeTemplate {
  trade: string
  /** A sheet of one of these disciplines suggests the trade. */
  disciplines: string[]
  /** A sheet whose title holds one of these words suggests it too. */
  words: string[]
  /** The usual scope: the first draft of the trade's scope on every new project. */
  scope: string[]
}

export const TRADE_TEMPLATES: TradeTemplate[] = [
  { trade: 'Sitework', disciplines: ['Civil'], words: [], scope: ['Clearing and grading', 'Utilities to 5 ft of the building', 'Paving', 'Striping and signs'] },
  { trade: 'Landscaping', disciplines: ['Landscape'], words: ['landscape', 'irrigation'], scope: ['Planting', 'Irrigation', 'Sod and seed'] },
  { trade: 'Concrete', disciplines: ['Structural'], words: ['foundation', 'slab'], scope: ['Foundations', 'Slab on grade', 'Sidewalks and curbs', 'Rebar supply'] },
  { trade: 'Masonry', disciplines: [], words: ['masonry', 'cmu', 'brick'], scope: ['Block walls', 'Brick veneer', 'Grout and reinforcing'] },
  { trade: 'Structural steel', disciplines: [], words: ['steel', 'framing plan', 'joist'], scope: ['Structural steel', 'Joists and deck', 'Erection'] },
  { trade: 'Framing and drywall', disciplines: ['Interiors'], words: ['ceiling', 'partition', 'wall type', 'interior elevation'], scope: ['Framing', 'Hang and tape', 'Ceilings'] },
  { trade: 'Roofing', disciplines: [], words: ['roof'], scope: ['Roof membrane', 'Insulation', 'Sheet metal and flashing', 'Roof curbs'] },
  { trade: 'Doors and hardware', disciplines: [], words: ['door', 'hardware'], scope: ['Frames', 'Doors', 'Hardware'] },
  { trade: 'Glass and storefront', disciplines: [], words: ['storefront', 'glazing', 'window'], scope: ['Storefront', 'Glass', 'Sealants'] },
  { trade: 'Painting', disciplines: [], words: ['finish', 'paint'], scope: ['Interior paint', 'Exterior paint'] },
  { trade: 'Flooring', disciplines: [], words: ['finish', 'flooring'], scope: ['Tile', 'Carpet and vinyl plank', 'Base'] },
  { trade: 'Millwork', disciplines: [], words: ['millwork', 'casework', 'cabinet'], scope: ['Cabinets', 'Countertops', 'Install'] },
  { trade: 'Fire sprinkler', disciplines: ['Fire protection'], words: ['sprinkler'], scope: ['Design and permit', 'Mains and branch lines', 'Heads and trim'] },
  { trade: 'Plumbing', disciplines: ['Plumbing'], words: [], scope: ['Underground', 'Rough in', 'Top out', 'Trim'] },
  { trade: 'HVAC', disciplines: ['Mechanical'], words: ['hvac'], scope: ['Equipment', 'Ductwork', 'Controls', 'Test and balance'] },
  { trade: 'Electrical', disciplines: ['Electrical', 'Technology'], words: [], scope: ['Service and gear', 'Panels and feeders', 'Lighting', 'Devices', 'Fire alarm'] },
]

/**
 * A rough cost per square foot for each trade on a small commercial building: made-up numbers to
 * start a budget from, never a price. The office changes any of them line by line.
 */
export const BUDGET_PER_SQ_FT: Record<string, number> = {
  Sitework: 12,
  Landscaping: 3,
  Concrete: 14,
  Masonry: 8,
  'Structural steel': 18,
  'Framing and drywall': 12,
  Roofing: 9,
  'Doors and hardware': 4,
  'Glass and storefront': 6,
  Painting: 3,
  Flooring: 5,
  Millwork: 6,
  'Fire sprinkler': 4.5,
  Plumbing: 10,
  HVAC: 16,
  Electrical: 18,
}

/** The square feet in a size line: "6,800 sq ft clinic" reads 6800. Null when it names none. */
export function sqFtInText(text: string): number | null {
  const m = text.match(/([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sf|square\s+feet)\b/i)
  const n = m?.[1] ? Number(m[1].replace(/,/g, '')) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** A trade's rough budget from the size, to the nearest $500. Null for a trade with no rate. */
export function budgetFromSize(trade: string, sqFt: number): number | null {
  const rate = BUDGET_PER_SQ_FT[trade]
  return rate === undefined ? null : Math.round((rate * sqFt) / 500) * 500
}

/** The trades the company does with its own crews. Their number comes from our own bid in Trades mode. */
export const OUR_TRADES = ['Plumbing']

/** What a new project starts with on Our number. The office changes them there. */
export const NEW_PROJECT_CONTINGENCY_PCT = 3
export const NEW_PROJECT_FEE_PCT = 8

/** What a pasted sheet index reads as: the sheets, and the lines with a number that were not read. */
export interface SheetIndexReading {
  sheets: PlanSheet[]
  unread: string[]
}

/** "A-101", "A101", "A1.01", "FP-101", "A-101A" at the head of a line, then the title. */
const SHEET_LINE = /^\s*([A-Za-z]{1,2})([-.\s]?)(\d{1,3}(?:\.\d{1,3})?[A-Za-z]?)\b[\s\-–—:.,]*(.*)$/

/** Short words a drawing title keeps in capitals. */
const KEEP_CAPS = new Set(['HVAC', 'MEP', 'ADA', 'CMU', 'RCP', 'TPO', 'RTU', 'LV', 'FFE', 'II', 'III', 'IV'])

/** A title typed in capitals reads in sentence case: "FLOOR PLAN" reads "Floor plan", "HVAC PLAN" reads "HVAC plan". */
function titleWords(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ')
  if (t === '' || t !== t.toUpperCase()) return t
  const words = t.split(' ').map((w) => (KEEP_CAPS.has(w.replace(/[^A-Z]/g, '')) ? w : w.toLowerCase()))
  const out = words.join(' ')
  return out.charAt(0).toUpperCase() + out.slice(1)
}

/**
 * The sheets in a pasted sheet index, one a line, in the order they appear, each once. A line
 * with no digit is a heading ("ARCHITECTURAL") and is passed over. A line with a digit that does
 * not start with a sheet number is kept in `unread`, so nothing pasted goes missing unsaid.
 */
export function sheetIndexInText(text: string): SheetIndexReading {
  const sheets: PlanSheet[] = []
  const unread: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || !/\d/.test(line)) continue
    const m = line.match(SHEET_LINE)
    if (!m) {
      unread.push(line)
      continue
    }
    const sep = m[2] === '' ? '' : m[2] === '.' ? '.' : '-'
    const id = `${m[1]}${sep}${m[3]}`.toUpperCase()
    if (sheets.some((s) => s.id === id)) continue
    sheets.push({ id, title: titleWords(m[4] ?? '') })
  }
  return { sheets, unread }
}

/** One trade the sheets suggest, and the sheets that suggest it. */
export interface TradeGuess {
  trade: string
  from: string[]
}

/** The trades a set of sheets suggests, in the list's order. A guess to start from, never the last word. */
export function tradesForSheets(sheets: PlanSheet[]): TradeGuess[] {
  const out: TradeGuess[] = []
  for (const t of TRADE_TEMPLATES) {
    const from = sheets
      .filter((s) => t.disciplines.includes(sheetDiscipline(s.id)) || t.words.some((w) => s.title.toLowerCase().includes(w)))
      .map((s) => s.id)
    if (from.length > 0) out.push({ trade: t.trade, from })
  }
  return out
}

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

/** Words too common in drawing titles and scope lines to tie one to the other. */
const LINE_STOP = new Set(['and', 'the', 'with', 'from', 'plan', 'plans', 'detail', 'details', 'sheet', 'sheets', 'schedule', 'schedules', 'section', 'sections', 'building', 'supply'])

/** The words of a title or a line, cut to their first four letters, so "utilities" meets "utility". */
function stems(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !LINE_STOP.has(w))
    .map((w) => w.slice(0, 4))
}

/**
 * The sheets a scope line most likely reads from: the trade's sheets whose titles share a word
 * with the line. "Lighting" reads from the lighting plan. A line that meets no title gets none,
 * which means the trade's sheets as a whole.
 */
export function guessLineSheets(label: string, tradeSheets: PlanSheet[]): string[] {
  const want = new Set(stems(label))
  if (want.size === 0) return []
  return tradeSheets.filter((s) => stems(s.title).some((w) => want.has(w))).map((s) => s.id)
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

/** The usual scope for a trade. A trade not on the list starts empty. */
export function usualScope(trade: string): string[] {
  return TRADE_TEMPLATES.find((t) => t.trade === trade)?.scope ?? []
}

/** Where a trade sits in the list (the order the specs list trades). A trade not on the list goes last. */
export function tradeOrder(trade: string): number {
  const i = TRADE_TEMPLATES.findIndex((t) => t.trade === trade)
  return i === -1 ? TRADE_TEMPLATES.length : i
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
      }
    })
}

/**
 * Scope lines a new set adds to trades already on the job, put at the end of each trade's scope.
 * A quote that came in before never answered them, so Compare bids reads them as not clear until
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
 * (`tradeLineup`, closest first), up to a deep bench (BENCH_WANTED), so at least two quotes come
 * back. The owner, 2026-10-02: keep the map's order, so his answer to closest first or most
 * reliable first (open question 7) moves both. A company with no coverage set is in range, after
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
  const owner = record(draft.customerId, draft.ownerName, 'Owner')
  const architect = record(draft.architectId, draft.architectName, 'Architect')

  const packages = packagesFromDrafts(id, draft.trades)

  const n = draft.sheets.length
  const project: GcProject = {
    id,
    name: draft.name.trim(),
    address: draft.address.trim(),
    town: draft.town,
    ourBidSentOn: null,
    ownerContractSignedOn: null,
    permitOn: null,
    startDate: null,
    startedOn: null,
    customerId: owner.id,
    owner: owner.name,
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
 * runs beside the work inside. `days` is a first-draft length; `lag` is days between the stage
 * before and this one. The rough-in and final inspections are activities of their own (the owner,
 * 2026-10-03), drawn by `scheduleDraft`, not waits on a link.
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

/** The lines a trade's activities are drawn from: its schedule of values, or its scope (our own crew, or before one). */
function draftLines(pkg: TradePackage): { lineId: string; label: string }[] {
  if (pkg.sow && !pkg.selfPerform) return pkg.sow.sov.map((l) => ({ lineId: l.id, label: l.label }))
  return pkg.scope.map((l) => ({ lineId: l.id, label: l.label }))
}

/**
 * The schedule's first draft, from the stages of the job: every line of every trade, each in its
 * stage. A stage starts when the stage before it is done, so the trades' rough-ins run side by
 * side after framing, close-in waits on all of them and the inspection, and the trims come after
 * the finishes. Inside a trade, its lines run in stage order, one after another, and its lines in
 * one stage share that stage's days (at least two each). Two inspections are activities of their
 * own, with no trade (packageId ''): the rough-in inspection after every rough-in, which close-in
 * and anything else after the rough-ins wait on, and the final inspection after all the work.
 * Milestones: dry-in (the last dry-in line), the rough-in inspection (on its finish) and
 * substantial completion (three days after the final inspection). The office changes every date.
 */
export function scheduleDraft(project: GcProject, start: string): ProjectSchedule {
  const order = new Map(SCHEDULE_STAGES.map((st, i) => [st.key, i]))
  type Line = { lineId: string; packageId: string; trade: string; stage: string; index: number }
  const lines: Line[] = project.packages.flatMap((pkg) =>
    draftLines(pkg).map((l, index) => ({ lineId: l.lineId, packageId: pkg.id, trade: pkg.trade, stage: lineStage(pkg.trade, l.label), index })),
  )
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
    for (const line of byStage(stage.key)) {
      // The line before it in its own trade, in stage order: a crew does its lines one after another.
      const own = lines
        .filter((l) => l.packageId === line.packageId)
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
      const days = Math.max(2, Math.ceil(stage.days / Math.max(1, shares)))
      const a: ScheduleActivity = { lineId: line.lineId, packageId: line.packageId, start: from, finish: plusDays(from, days - 1), after }
      done.set(line.lineId, a)
      activities.push(a)
    }
    if (stage.key === 'roughIn' && byStage('roughIn').length > 0) {
      const roughs = byStage('roughIn').map((l) => done.get(l.lineId)).filter((a): a is ScheduleActivity => !!a)
      const from = plusDays(roughs.reduce((m, a) => (a.finish > m ? a.finish : m), start), 1)
      roughInspection = {
        lineId: `${project.id}-insp-roughin`,
        packageId: '',
        start: from,
        finish: plusDays(from, INSPECTION_DAYS - 1),
        after: roughs.map((a) => a.lineId),
        inspection: { label: 'Rough-in inspection' },
      }
      activities.push(roughInspection)
    }
  }
  // The final inspection waits on all the work; substantial completion follows it.
  const workEnd = activities.reduce((m, a) => (a.finish > m ? a.finish : m), start)
  const finalFrom = plusDays(workEnd, 1)
  const finalInspection: ScheduleActivity = {
    lineId: `${project.id}-insp-final`,
    packageId: '',
    start: finalFrom,
    finish: plusDays(finalFrom, INSPECTION_DAYS - 1),
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
 * adds our fee for the price (reason 'plans', price 0, its `changeOrderPrice`).
 */
export function changeOrderFromSet(
  set: { label: string; note: string; sheets: string[]; specs?: string[] },
  trade: string,
  addedLines: string[],
  jobDays: number,
): { description: string; schedule: string } {
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
  }
}

// ---------------------------------------------------------------------------------------------
// The specs: the project manual's sections, the trades they point at, the lines that read them
// ---------------------------------------------------------------------------------------------

/** The divisions of the project manual, by their two-digit number. */
export const SPEC_DIVISIONS: Record<string, string> = {
  '00': 'Procurement and contracting',
  '01': 'General requirements',
  '02': 'Existing conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood, plastics and composites',
  '07': 'Thermal and moisture protection',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '13': 'Special construction',
  '14': 'Conveying equipment',
  '21': 'Fire suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '25': 'Integrated automation',
  '26': 'Electrical',
  '27': 'Communications',
  '28': 'Electronic safety and security',
  '31': 'Earthwork',
  '32': 'Exterior improvements',
  '33': 'Utilities',
}

/** A section's division: its first two digits. */
export function specDivision(id: string): string {
  return id.replace(/\D/g, '').slice(0, 2)
}

/**
 * Which trade a section belongs to, by the start of its number: the longest match wins, so
 * "09 91" is painting while "09 2" is drywall. Divisions 00 and 01 belong to no trade.
 */
const SPEC_TRADES: [string, string][] = [
  ['0241', 'Sitework'],
  ['03', 'Concrete'],
  ['04', 'Masonry'],
  ['051', 'Structural steel'],
  ['052', 'Structural steel'],
  ['053', 'Structural steel'],
  ['055', 'Structural steel'],
  ['061', 'Framing and drywall'],
  ['064', 'Millwork'],
  ['075', 'Roofing'],
  ['076', 'Roofing'],
  ['077', 'Roofing'],
  ['081', 'Doors and hardware'],
  ['087', 'Doors and hardware'],
  ['084', 'Glass and storefront'],
  ['088', 'Glass and storefront'],
  ['092', 'Framing and drywall'],
  ['095', 'Framing and drywall'],
  ['093', 'Flooring'],
  ['096', 'Flooring'],
  ['099', 'Painting'],
  ['123', 'Millwork'],
  ['21', 'Fire sprinkler'],
  ['22', 'Plumbing'],
  ['23', 'HVAC'],
  ['26', 'Electrical'],
  ['27', 'Electrical'],
  ['28', 'Electrical'],
  ['31', 'Sitework'],
  ['321', 'Sitework'],
  ['328', 'Landscaping'],
  ['329', 'Landscaping'],
  ['33', 'Sitework'],
]

/** The trade a section most likely belongs to. Null: none, like the general requirements. */
export function tradeForSpec(id: string): string | null {
  const digits = id.replace(/\D/g, '')
  let best: [string, string] | null = null
  for (const rule of SPEC_TRADES) if (digits.startsWith(rule[0]) && (!best || rule[0].length > best[0].length)) best = rule
  return best?.[1] ?? null
}

/** What a pasted table of contents reads as: the sections, and the lines with numbers that were not read. */
export interface SpecIndexReading {
  sections: SpecSection[]
  unread: string[]
}

/** "07 54 23", "075423", "07-54-23", "Section 09 91 23" at the head of a line, then the title. */
const SPEC_LINE = /^\s*(?:section\s+)?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})(?:\.\d+)?\b[\s\-–—:.,]*(.*)$/i

/**
 * The sections in a pasted table of contents, one a line, each once, in the order they appear.
 * A division heading ("DIVISION 09 - FINISHES") and a line with no digit are passed over. A line
 * with digits that does not start with a section number is kept in `unread`.
 */
export function specIndexInText(text: string): SpecIndexReading {
  const sections: SpecSection[] = []
  const unread: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || !/\d/.test(line) || /^division\b/i.test(line)) continue
    const m = line.match(SPEC_LINE)
    if (!m) {
      unread.push(line)
      continue
    }
    const id = `${m[1]} ${m[2]} ${m[3]}`
    if (sections.some((s) => s.id === id)) continue
    sections.push({ id, title: titleWords(m[4] ?? '') })
  }
  return { sections, unread }
}

/** One trade the plans suggest: the sheets and the sections behind the guess. */
export interface PlansTradeGuess {
  trade: string
  from: string[]
  specs: string[]
}

/** The trades the sheets and the sections suggest together, in the list's order. */
export function tradesForPlans(sheets: PlanSheet[], specs: SpecSection[]): PlansTradeGuess[] {
  const out = new Map<string, PlansTradeGuess>()
  for (const g of tradesForSheets(sheets)) out.set(g.trade, { trade: g.trade, from: g.from, specs: [] })
  for (const s of specs) {
    const trade = tradeForSpec(s.id)
    if (!trade) continue
    const g = out.get(trade) ?? { trade, from: [], specs: [] }
    g.specs.push(s.id)
    out.set(trade, g)
  }
  return [...out.values()].sort((a, b) => tradeOrder(a.trade) - tradeOrder(b.trade))
}

/** The sections a scope line most likely reads from: the trade's sections whose titles share a word with it. */
export function guessLineSpecs(label: string, tradeSpecs: SpecSection[]): string[] {
  const want = new Set(stems(label))
  if (want.size === 0) return []
  return tradeSpecs.filter((s) => stems(s.title).some((w) => want.has(w))).map((s) => s.id)
}

/**
 * Section numbers found in a set's notes, each once, in the order they appear, written the way
 * the manual writes them ("09 91 23"). Spaced, dotted or dashed numbers read anywhere; six bare
 * digits read only after the word section, so an amount like 120000 is not taken for one.
 */
export function specsInText(text: string): string[] {
  const found: string[] = []
  const add = (a: string, b: string, c: string) => {
    if (SPEC_DIVISIONS[a] === undefined) return
    const id = `${a} ${b} ${c}`
    if (!found.includes(id)) found.push(id)
  }
  const pattern = /\bsection\s+(\d{2})[ .-]?(\d{2})[ .-]?(\d{2})\b|\b(\d{2})([ .-])(\d{2})\5(\d{2})\b/gi
  for (const m of text.matchAll(pattern)) {
    if (m[1] && m[2] && m[3]) add(m[1], m[2], m[3])
    else if (m[4] && m[6] && m[7]) add(m[4], m[6], m[7])
  }
  return found
}

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
