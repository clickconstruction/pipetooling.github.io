/**
 * GC mode — design spike. New Project, and splitting the plans into trades: the sheet index is
 * read out of what the office pastes, the trades are guessed from the sheets, and each trade
 * starts from its usual scope. A later set of plans uses the same guess, and can bring a trade
 * the job did not have. Every guess here is a starting point the office changes.
 */
import type { GcCustomer, GcProject, GcState, NewProjectDraft, NewTradeDraft, PlanSheet, ScopeItem, TradePackage } from './gcTypes'
import { sheetDiscipline, sheetsAtRev } from './gcPlans'
import { currentRev } from './gcLookups'

/** One trade the office may buy, in the order the work goes in. */
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

/** The trades a set of sheets suggests, in build order. A guess to start from, never the last word. */
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

/** Where a trade sits in build order. A trade not on the list goes last. */
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
        selfPerform: t.ours ? { ref: 'New bid', value: t.budget, note: 'Ours. Price it as our own bid in Trades mode.' } : null,
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

/** The project's trades with new ones put in build order. The trades already there keep their order. */
export function withTradesInOrder(existing: TradePackage[], added: TradePackage[]): TradePackage[] {
  const out = [...existing]
  for (const pkg of added) {
    const at = out.findIndex((p) => tradeOrder(p.trade) > tradeOrder(pkg.trade))
    if (at === -1) out.push(pkg)
    else out.splice(at, 0, pkg)
  }
  return out
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
