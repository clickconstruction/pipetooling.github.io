import { TRADE_TEMPLATES, tradeOrder } from '../gc/plans'
import type { GcState, ScopeBookStore, ScopeExclusion } from './gcTypes'
import { COMMON_EXCLUSIONS, exclusionName } from './gcExclusions'

/**
 * GC mode design spike: the scope book (the owner, 2026-10-04: "a scope book where the user can set
 * a trade and set scope that they can search in that book and pull from"; the revised design in
 * `to-dos/gc-mode/scope-book-mockup.html`). The book is read, not typed: every scope line on our
 * jobs, the usual lines, and the lines we added late on past jobs, with what the office saved,
 * changed and folded together on top (`GcState.scopeBook`).
 */

export const EMPTY_SCOPE_BOOK: ScopeBookStore = { saved: [], edits: [], merges: [], sets: [] }

/** How a line came in late on a past job: added by a later set (maybe at the cost of a change order), or left out by quotes. */
export interface ScopeBookLate {
  job: string
  how: 'set' | 'leftOut'
  /** The set that added it, like "Bulletin 1". */
  set?: string
  changeOrder?: boolean
  /** How many quotes left it out. */
  quotes?: number
}

/** One line of the book. */
export interface ScopeBookLine {
  /** The trade and the line's words as a key: one line per trade says each thing once. */
  id: string
  trade: string
  words: string
  /** The spec section the line usually reads from. */
  spec?: string
  /** What a trade with this line usually leaves out, and who does it: it comes along when the line is pulled. */
  leavesOut?: ScopeExclusion
  /** The jobs it was on, by name. */
  usedOn: string[]
  lastUsed?: string
  late: ScopeBookLate[]
  /** Where it came from: the usual lines, a job's scope, or saved by hand. */
  source: 'usual' | 'job' | 'saved'
}

/**
 * Made-up finished jobs (the ones Cibolo Creek Partners' history names), with the lines that came
 * in late on them. The real build reads these from the plan sets and change orders as they happen.
 */
const PAST_JOBS: {
  job: string
  on: string
  lines: { trade: string; words: string; spec?: string; leavesOut?: ScopeExclusion; late?: Omit<ScopeBookLate, 'job'> }[]
}[] = [
  {
    job: 'Fair Oaks Shops, Building C',
    on: '2025-08-30',
    lines: [
      { trade: 'Sitework', words: 'Clearing and grading', spec: '31 10 00' },
      { trade: 'Sitework', words: 'Utilities to 5 ft of the building', spec: '33 10 00', leavesOut: { label: 'Building connections', by: 'Plumbing' } },
      { trade: 'Sitework', words: 'Paving', spec: '32 12 16' },
      { trade: 'Sitework', words: 'Detention pond', spec: '33 40 00', late: { how: 'set', set: 'Bulletin 1', changeOrder: true } },
      { trade: 'Sitework', words: 'Curb cuts and ramps (ADA)', spec: '32 16 00', late: { how: 'set', set: 'Addendum 2' } },
      { trade: 'Concrete', words: 'Dumpster enclosure pad', late: { how: 'set', set: 'Addendum 1' } },
      { trade: 'Concrete', words: 'Foundations', spec: '03 30 00' },
      { trade: 'Framing and drywall', words: 'Fire-rated demising walls', spec: '09 21 16', late: { how: 'set', set: 'Bulletin 1', changeOrder: true } },
      { trade: 'Painting', words: 'Bollards painted safety yellow', late: { how: 'leftOut', quotes: 1 } },
      { trade: 'Fire sprinkler', words: 'Fire department connection and backflow', spec: '21 13 13', late: { how: 'set', set: 'Addendum 2' } },
      { trade: 'Plumbing', words: 'Grease interceptor', spec: '22 13 00', late: { how: 'set', set: 'Addendum 1', changeOrder: true } },
      { trade: 'Plumbing', words: 'Rough in', leavesOut: { label: 'Gas piping', by: 'HVAC' } },
      { trade: 'Electrical', words: 'Site lighting poles and bases', spec: '26 56 00', late: { how: 'leftOut', quotes: 2 } },
    ],
  },
  {
    job: 'Fair Oaks Shops, Building A',
    on: '2024-06-14',
    lines: [
      { trade: 'Sitework', words: 'Site clearing and grading' },
      { trade: 'Sitework', words: 'Erosion control and SWPPP', spec: '31 25 00', late: { how: 'leftOut', quotes: 2 } },
      { trade: 'Sitework', words: 'Building pad to ±0.1 ft', spec: '31 20 00' },
      { trade: 'Sitework', words: 'Curb and gutter', spec: '32 16 13' },
      { trade: 'Concrete', words: 'Sidewalks and curbs' },
      { trade: 'Plumbing', words: 'Grease interceptor', spec: '22 13 00' },
      { trade: 'Electrical', words: 'Site lighting poles and bases', spec: '26 56 00', late: { how: 'leftOut', quotes: 1 } },
      { trade: 'Electrical', words: 'Temporary power', late: { how: 'set', set: 'Addendum 1' } },
      { trade: 'Doors and hardware', words: 'Access control prep at the front doors', late: { how: 'set', set: 'Addendum 1' } },
    ],
  },
]

/** A line's words as a key: capitals, "&" and stray punctuation do not make two lines. */
export function scopeWordKey(words: string): string {
  return words
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/[^a-z0-9±.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The words a line has now: after the merges and edits the office made, followed in order. */
function resolveWords(store: ScopeBookStore, trade: string, words: string): string {
  let now = words
  for (let step = 0; step < 6; step++) {
    const key = scopeWordKey(now)
    const merge = store.merges.find((m) => m.trade === trade && scopeWordKey(m.from) === key)
    const edit = store.edits.find((e) => e.trade === trade && scopeWordKey(e.words) === key && scopeWordKey(e.to.words) !== key)
    const next = merge?.into ?? edit?.to.words
    if (!next) break
    now = next
  }
  return now.trim()
}

const SOURCE_RANK: Record<ScopeBookLine['source'], number> = { usual: 0, job: 1, saved: 2 }

/** Every line of the book, by trade in the list's order, then by words. */
export function scopeBook(state: GcState): ScopeBookLine[] {
  const store = state.scopeBook ?? EMPTY_SCOPE_BOOK
  const lines = new Map<string, ScopeBookLine>()
  const put = (
    trade: string,
    words: string,
    source: ScopeBookLine['source'],
    more: { spec?: string; leavesOut?: ScopeExclusion; job?: string; on?: string; late?: ScopeBookLate } = {},
  ) => {
    const now = resolveWords(store, trade, words)
    if (now === '') return
    const id = `${trade}|${scopeWordKey(now)}`
    let line = lines.get(id)
    if (!line) {
      line = { id, trade, words: now, usedOn: [], late: [], source }
      lines.set(id, line)
    }
    if (SOURCE_RANK[source] > SOURCE_RANK[line.source]) line.source = source
    if (more.spec && !line.spec) line.spec = more.spec
    if (more.leavesOut && !line.leavesOut) line.leavesOut = more.leavesOut
    if (more.job && !line.usedOn.includes(more.job)) line.usedOn.push(more.job)
    if (more.on && (!line.lastUsed || more.on > line.lastUsed)) line.lastUsed = more.on
    if (more.late) line.late.push(more.late)
  }

  // The usual lines, each with what its trade usually leaves out when the words meet.
  for (const t of TRADE_TEMPLATES) {
    for (const words of t.scope) {
      const key = scopeWordKey(words)
      const leavesOut = t.excludes?.find((x) => scopeWordKey(x.label).split(' ').includes(key))
      put(t.trade, words, 'usual', leavesOut ? { leavesOut } : {})
    }
  }
  // The finished jobs.
  for (const job of PAST_JOBS) {
    for (const l of job.lines) {
      put(l.trade, l.words, 'job', {
        job: job.job,
        on: job.on,
        ...(l.spec ? { spec: l.spec } : {}),
        ...(l.leavesOut ? { leavesOut: l.leavesOut } : {}),
        ...(l.late ? { late: { job: job.job, ...l.late } } : {}),
      })
    }
  }
  // Every scope on the jobs in the app: a line a later set added came in late, and so did one quotes left out.
  for (const project of state.projects) {
    const on = project.planSets[0]?.issuedOn ?? state.today
    for (const pkg of project.packages) {
      for (const item of pkg.scope) {
        const set = project.planSets.find((s) => s.addedLines?.some((l) => l.packageId === pkg.id && l.scopeId === item.id))
        const leftOut = pkg.invites.filter((inv) => inv.bid?.includes[item.id] === 'no').length
        const base = { job: project.name, on, ...(item.specs?.[0] ? { spec: item.specs[0] } : {}) }
        if (set) {
          const changeOrder = (project.changeOrders ?? []).some((co) => co.packageId === pkg.id && co.description.startsWith(set.label))
          put(pkg.trade, item.label, 'job', { ...base, late: { job: project.name, how: 'set', set: set.label, ...(changeOrder ? { changeOrder } : {}) } })
        } else put(pkg.trade, item.label, 'job', base)
        if (leftOut > 0) put(pkg.trade, item.label, 'job', { late: { job: project.name, how: 'leftOut', quotes: leftOut } })
      }
    }
  }
  // Saved by hand.
  for (const s of store.saved) {
    put(s.trade, s.words, 'saved', { ...(s.spec ? { spec: s.spec } : {}), ...(s.leavesOut ? { leavesOut: s.leavesOut } : {}) })
  }
  // A spec section or a "leaves out" the office changed.
  for (const e of store.edits) {
    const line = lines.get(`${e.trade}|${scopeWordKey(resolveWords(store, e.trade, e.to.words))}`)
    if (!line) continue
    if (e.to.spec === null) delete line.spec
    else if (e.to.spec) line.spec = e.to.spec
    if (e.to.leavesOut === null) delete line.leavesOut
    else if (e.to.leavesOut) line.leavesOut = e.to.leavesOut
  }
  return [...lines.values()].sort((a, b) => tradeOrder(a.trade) - tradeOrder(b.trade) || a.trade.localeCompare(b.trade) || a.words.localeCompare(b.words))
}

/** Whether the book has this trade's line, said any way ("&" or "and", any capitals). */
export function inScopeBook(book: ScopeBookLine[], trade: string, words: string): ScopeBookLine | undefined {
  const id = `${trade}|${scopeWordKey(words)}`
  return book.find((l) => l.id === id)
}

/** How a line came in late, said after its words: "came in with Bulletin 1 on Fair Oaks Shops, Building C. It cost a change order." */
export function lateWords(late: ScopeBookLate): string {
  if (late.how === 'leftOut') return `was left out by ${late.quotes ?? 1} ${(late.quotes ?? 1) === 1 ? 'quote' : 'quotes'} on ${late.job}.`
  return `came in with ${late.set ?? 'a later set'} on ${late.job}.${late.changeOrder ? ' It cost a change order.' : ''}`
}

/** One hit of a search of the book. */
export interface ScopeBookHit {
  line: ScopeBookLine
  /** The scope being written has it already. */
  here: boolean
  /** It is another trade's line: pulling it in is a choice the office sees. */
  otherTrade: boolean
}

/**
 * The book searched from a trade's scope: this trade's lines first (the ones we missed before,
 * then the most used), then the ones already here, then other trades' lines that match. With no
 * words typed, only this trade's lines.
 */
export function searchScopeBook(book: ScopeBookLine[], trade: string, query: string, here: string[]): ScopeBookHit[] {
  const tokens = scopeWordKey(query).split(' ').filter(Boolean)
  const hereKeys = new Set(here.map(scopeWordKey))
  const matches = (l: ScopeBookLine) => {
    if (tokens.length === 0) return true
    const words = scopeWordKey(l.words).split(' ')
    return tokens.every((t) => words.some((w) => w.startsWith(t))) || scopeWordKey(l.words).includes(scopeWordKey(query))
  }
  const rank = (a: ScopeBookLine, b: ScopeBookLine) =>
    Number(b.late.length > 0) - Number(a.late.length > 0) || b.usedOn.length - a.usedOn.length || a.words.localeCompare(b.words)
  const mine = book.filter((l) => l.trade === trade && matches(l))
  const fresh = mine.filter((l) => !hereKeys.has(scopeWordKey(l.words))).sort(rank)
  const already = mine.filter((l) => hereKeys.has(scopeWordKey(l.words))).sort(rank)
  const others =
    tokens.length === 0
      ? []
      : book
          .filter((l) => l.trade !== trade && matches(l) && !hereKeys.has(scopeWordKey(l.words)))
          .sort(rank)
          .slice(0, 6)
  return [
    ...fresh.map((line) => ({ line, here: false, otherTrade: false })),
    ...already.map((line) => ({ line, here: true, otherTrade: false })),
    ...others.map((line) => ({ line, here: false, otherTrade: true })),
  ]
}

/** This trade's lines we added late before, that the scope being written does not have yet. */
export function oftenMissed(book: ScopeBookLine[], trade: string, here: string[]): ScopeBookLine[] {
  const hereKeys = new Set(here.map(scopeWordKey))
  return book
    .filter((l) => l.trade === trade && l.late.length > 0 && !hereKeys.has(scopeWordKey(l.words)))
    .sort((a, b) => b.late.length - a.late.length || b.usedOn.length - a.usedOn.length || a.words.localeCompare(b.words))
}

/** A set of lines to start a trade's scope from. */
export interface ScopeSetChoice {
  id: string
  trade: string
  name: string
  lines: string[]
  /** Where it came from, in words: "saved Oct 4", "as on Boerne Retail Shell", "the usual lines". */
  note: string
  source: 'saved' | 'job' | 'usual'
}

/**
 * The sets a trade's scope can start from: the ones saved by hand, the scope of this trade on each
 * other job (two lines or more), and the usual lines. Two with the same lines show once.
 */
export function scopeSetsFor(state: GcState, trade: string, exceptProjectId: string | null = null): ScopeSetChoice[] {
  const store = state.scopeBook ?? EMPTY_SCOPE_BOOK
  const now = (words: string) => resolveWords(store, trade, words)
  const out: ScopeSetChoice[] = []
  for (const s of store.sets.filter((x) => x.trade === trade)) {
    out.push({ id: s.id, trade, name: s.name, lines: s.lines.map(now), note: `saved ${shortDay(s.savedOn)}`, source: 'saved' })
  }
  for (const project of state.projects) {
    if (project.id === exceptProjectId) continue
    const pkg = project.packages.find((p) => p.trade === trade)
    const lines = (pkg?.scope ?? []).map((l) => now(l.label)).filter(Boolean)
    if (lines.length >= 2) out.push({ id: `job:${project.id}`, trade, name: `${trade} as on ${project.name}`, lines, note: `as on ${project.name}`, source: 'job' })
  }
  for (const job of PAST_JOBS) {
    const lines = job.lines.filter((l) => l.trade === trade).map((l) => now(l.words))
    if (lines.length >= 2) out.push({ id: `past:${job.job}`, trade, name: `${trade} as on ${job.job}`, lines, note: `as on ${job.job}`, source: 'job' })
  }
  const usual = TRADE_TEMPLATES.find((t) => t.trade === trade)?.scope ?? []
  if (usual.length > 0) out.push({ id: `usual:${trade}`, trade, name: `${trade}, the usual lines`, lines: usual.map(now), note: 'the usual lines', source: 'usual' })
  // Two sets with the same lines show once: the usual one over a job's, a saved one over both.
  const keyOf = (s: ScopeSetChoice) => [...new Set(s.lines.map(scopeWordKey))].sort().join('|')
  const keep = new Map<string, ScopeSetChoice>()
  const first: Record<ScopeSetChoice['source'], number> = { saved: 0, usual: 1, job: 2 }
  for (const s of [...out].sort((a, b) => first[a.source] - first[b.source])) if (!keep.has(keyOf(s))) keep.set(keyOf(s), s)
  return out.filter((s) => keep.get(keyOf(s)) === s)
}

/** The lines of a set a scope does not have yet, each once. Lines already there stay as they are. */
export function linesToAdd(here: string[], add: string[]): string[] {
  const keys = new Set(here.map(scopeWordKey))
  const out: string[] = []
  for (const words of add) {
    const key = scopeWordKey(words)
    if (key === '' || keys.has(key)) continue
    keys.add(key)
    out.push(words.trim())
  }
  return out
}

const SMALL_WORDS = new Set(['and', 'the', 'of', 'to', 'at', 'a', 'an', 'for', 'in', 'on', 'with', 'by'])

/** A line's words that tell it apart. In Sitework every line is site work, so "site" tells nothing; in Electrical, "Site lighting" is not "Lighting". */
function wordSet(words: string, trade: string): Set<string> {
  return new Set(
    scopeWordKey(words)
      .split(' ')
      .filter((w) => w !== '' && !SMALL_WORDS.has(w) && !(w === 'site' && trade === 'Sitework'))
      .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)),
  )
}

/** Two lines of one trade that look like the same thing. `keep` is the one used more; `fold` goes into it. */
export interface ScopeBookDuplicate {
  trade: string
  keep: ScopeBookLine
  fold: ScopeBookLine
}

/**
 * Lines of one trade that say the same thing in other words: the same words once the small ones
 * ("and", "the", "site" in Sitework) and plurals are set aside ("Site clearing and grading" and
 * "Clearing and grading").
 */
export function scopeBookDuplicates(book: ScopeBookLine[]): ScopeBookDuplicate[] {
  const out: ScopeBookDuplicate[] = []
  for (let i = 0; i < book.length; i++) {
    for (let j = i + 1; j < book.length; j++) {
      const a = book[i]
      const b = book[j]
      if (!a || !b || a.trade !== b.trade) continue
      const wa = wordSet(a.words, a.trade)
      const wb = wordSet(b.words, b.trade)
      if (wa.size === 0 || wa.size !== wb.size || ![...wa].every((w) => wb.has(w))) continue
      const aFirst = a.usedOn.length - b.usedOn.length || SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || b.words.length - a.words.length
      out.push(aFirst >= 0 ? { trade: a.trade, keep: a, fold: b } : { trade: a.trade, keep: b, fold: a })
    }
  }
  return out
}

/** "2026-10-04" reads "Oct 4". */
function shortDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** How much a line is used, in words: "6 jobs · last Oct 2", "the usual lines", "saved by hand". */
export function scopeBookUseWords(line: ScopeBookLine): string {
  if (line.usedOn.length === 0) return line.source === 'saved' ? 'saved by hand' : 'the usual lines'
  const jobs = `${line.usedOn.length} ${line.usedOn.length === 1 ? 'job' : 'jobs'}`
  return line.lastUsed ? `${jobs} · last ${shortDay(line.lastUsed)}` : jobs
}

// ---------------------------------------------------------------------------------------------
// Each trade's exclusions, kept beside its lines (the owner approved exclusions by company,
// 2026-10-04; REMAINING Round 5, New Project 1): the names the quote form offers come from here.
// ---------------------------------------------------------------------------------------------

/** One thing a trade's quotes leave out, with where the book has it from. */
export interface ScopeBookExclusion {
  trade: string
  /** The shared name (`exclusionName`): "permits" and "Permit fees" are both "Permits and fees". */
  name: string
  /** One of the trade's usual exclusions: the quote form's ticks, or one its usual lines bring. */
  usual: boolean
  /** The jobs where it was a Known exclusion of this trade, by name. */
  onJobs: string[]
  /** How many quotes for this trade left it out. */
  quotes: number
  /** Who does it instead, when a job or the usual list said. */
  by?: string
}

/**
 * Each trade's exclusions: its usual ones, every Known exclusion on our jobs, and every exclusion a
 * company's quote named, each folded onto its shared name. Most named first.
 */
export function scopeBookExclusions(state: GcState): ScopeBookExclusion[] {
  const out = new Map<string, ScopeBookExclusion>()
  const put = (trade: string, said: string, more: { usual?: boolean; job?: string; quote?: boolean; by?: string }) => {
    const name = exclusionName(said)
    if (name === '') return
    const id = `${trade}|${scopeWordKey(name)}`
    let x = out.get(id)
    if (!x) {
      x = { trade, name, usual: false, onJobs: [], quotes: 0 }
      out.set(id, x)
    }
    if (more.usual) x.usual = true
    if (more.job && !x.onJobs.includes(more.job)) x.onJobs.push(more.job)
    if (more.quote) x.quotes += 1
    if (more.by && !x.by) x.by = more.by
  }
  for (const [trade, names] of Object.entries(COMMON_EXCLUSIONS.byTrade)) for (const n of names) put(trade, n, { usual: true })
  for (const t of TRADE_TEMPLATES) for (const e of t.excludes ?? []) put(t.trade, e.label, { usual: true, by: e.by })
  for (const line of scopeBook(state)) if (line.leavesOut) put(line.trade, line.leavesOut.label, { usual: true, by: line.leavesOut.by })
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      for (const e of pkg.excludes ?? []) put(pkg.trade, e.label, { job: project.name, by: e.by })
      for (const inv of pkg.invites) for (const e of inv.bid?.exclusions ?? []) put(pkg.trade, e.name, { quote: true })
    }
  }
  const weight = (x: ScopeBookExclusion) => x.quotes + x.onJobs.length
  return [...out.values()].sort(
    (a, b) => tradeOrder(a.trade) - tradeOrder(b.trade) || a.trade.localeCompare(b.trade) || weight(b) - weight(a) || Number(b.usual) - Number(a.usual) || a.name.localeCompare(b.name),
  )
}

/** Where the book has an exclusion from, in words: "usual · on 2 jobs · left out by 3 quotes". */
export function scopeBookExclusionWords(x: ScopeBookExclusion): string {
  return [
    x.usual ? 'usual' : null,
    x.onJobs.length > 0 ? `on ${x.onJobs.length} ${x.onJobs.length === 1 ? 'job' : 'jobs'}` : null,
    x.quotes > 0 ? `left out by ${x.quotes} ${x.quotes === 1 ? 'quote' : 'quotes'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
