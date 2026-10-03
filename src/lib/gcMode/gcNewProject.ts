/**
 * GC mode — design spike. New Project, and splitting the plans into trades: the sheet index is
 * read out of what the office pastes, the trades are guessed from the sheets, and each trade
 * starts from its usual scope. A later set of plans uses the same guess, and can bring a trade
 * the job did not have. Every guess here is a starting point the office changes.
 */
import type { GcCustomer, GcProject, GcState, NewProjectDraft, NewTradeDraft, PlanSheet, ProjectSchedule, ScheduleActivity, ScheduleMilestone, ScopeItem, TradePackage } from './gcTypes'
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

/** The sheets of the newest set that suggest a trade, with their titles. */
export function tradeSheets(project: GcProject, trade: string): PlanSheet[] {
  const index = sheetsAtRev(project, currentRev(project))
  const from = tradesForSheets(index).find((g) => g.trade === trade)?.from ?? []
  return index.filter((s) => from.includes(s.id))
}

/** The sheets one scope line reads from: what the office said, or the guess when it said nothing. */
export function lineSheets(project: GcProject, pkg: TradePackage, item: ScopeItem): { sheets: string[]; guessed: boolean } {
  if (item.sheets) return { sheets: item.sheets, guessed: false }
  return { sheets: guessLineSheets(item.label, tradeSheets(project, pkg.trade)), guessed: true }
}

/**
 * Every sheet one scope line reads from. A line that names no sheet stands for the whole trade,
 * so it reads every sheet of its trade (`wholeTrade`). The owner, 2026-10-02: count those lines
 * as touched when any of the trade's sheets changes.
 */
export function lineReads(project: GcProject, pkg: TradePackage, item: ScopeItem): { sheets: string[]; guessed: boolean; wholeTrade: boolean } {
  const said = lineSheets(project, pkg, item)
  if (said.sheets.length > 0) return { ...said, wholeTrade: false }
  return { sheets: tradeSheets(project, pkg.trade).map((s) => s.id), guessed: said.guessed, wholeTrade: true }
}

/** The scope lines of a trade that read from any of these sheets, a line that names no sheet included. */
export function linesOnSheets(project: GcProject, pkg: TradePackage, sheetIds: string[]): ScopeItem[] {
  return pkg.scope.filter((item) => lineReads(project, pkg, item).sheets.some((id) => sheetIds.includes(id)))
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
        .map((label, i) => ({ label: label.trim(), sheets: t.scopeSheets?.[i] }))
        .filter((l) => l.label !== '')
      return {
        id: pkgId,
        trade: t.trade,
        bidTab: null,
        scope: lines.map((l, i) => ({ id: `${pkgId}-${i + 1}`, label: l.label, ...(t.scopeSheets ? { sheets: l.sheets ?? [] } : {}) })),
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
  lines: { packageId: string; label: string; sheets: string[] }[],
): { project: GcProject; added: { packageId: string; scopeId: string }[] } {
  const added: { packageId: string; scopeId: string }[] = []
  const packages = project.packages.map((pkg) => {
    const mine = lines.filter((l) => l.packageId === pkg.id && l.label.trim() !== '')
    if (mine.length === 0) return pkg
    const items: ScopeItem[] = mine.map((l, i) => ({ id: `${pkg.id}-r${rev}-${i + 1}`, label: l.label.trim(), sheets: l.sheets }))
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
 * before and this one (close-in waits two days for the rough-in inspection).
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
  { key: 'closeIn', label: 'Close-in', after: 'roughIn', days: 10, lag: 2 },
  { key: 'finishes', label: 'Finishes', after: 'closeIn', days: 10 },
  { key: 'trim', label: 'Trim', after: 'finishes', days: 7 },
  { key: 'siteFinish', label: 'Site finish', after: 'dryIn', days: 10 },
  { key: 'closeout', label: 'Closeout', after: 'trim', days: 5 },
]

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
 * one stage share that stage's days (at least two each). Milestones:
 * dry-in (the last dry-in line), the rough-in inspection (two days after the last rough-in) and
 * substantial completion (five days after the last line). The office changes every date.
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
  for (const stage of SCHEDULE_STAGES) {
    const gate = gateOf(stage.key)
    const gateActs = gate ? byStage(gate).map((l) => done.get(l.lineId)).filter((a): a is ScheduleActivity => !!a) : []
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
  }
  const lastOf = (key: string) => byStage(key).reduce((m, l) => {
    const f = done.get(l.lineId)?.finish ?? ''
    return f > m ? f : m
  }, '')
  const last = activities.reduce((m, a) => (a.finish > m ? a.finish : m), start)
  const dryIn = lastOf('dryIn')
  const rough = lastOf('roughIn')
  const roof = project.packages.find((k) => k.trade === 'Roofing') ?? null
  const milestones: ScheduleMilestone[] = [
    ...(dryIn ? [{ id: `${project.id}-dryin`, label: 'Dry-in', planned: dryIn, packageId: roof?.id ?? null, metOn: null }] : []),
    ...(rough ? [{ id: `${project.id}-roughin`, label: 'Rough-in inspection', planned: plusDays(rough, 2), packageId: null, metOn: null }] : []),
    { id: `${project.id}-substantial`, label: 'Substantial completion', planned: plusDays(last, 5), packageId: null, metOn: null },
  ]
  return { activities, milestones, baseline: null, lookAhead: [] }
}
