// dev-mcp's check_query_plan (punch list #430): a dev reads the plan of one of a short list of fixed statements, as
// themself, through dev_query_plan (migration 20261124063000) over the same GET door as every other read.
//
// No free SQL passes here or there. The statements live in the database function, whole; this file names their keys so
// the verb's description can say what there is to read, and the test holds the two lists together. The key the agent
// sends is checked for shape and passed on; the database decides whether it names a statement. Adding a statement is a
// migration, then a line below.
//
// A plan can run past a thousand lines (agreements_on_file: about 1,290 on an empty schema), more than one reply
// holds. The database hands the whole plan back, and the fitting is done here, on the lines: a window of them from a
// line number, or `find`, the nodes whose lines hold a piece of text with every node above them. `find` is matched
// against the plan's text in this file. It never reaches the database.
// Pure: no env reads, no network.

export const QUERY_PLAN_RPC = 'dev_query_plan'

/** The statements the database function holds, by key. The text is for people; the function's own copy is what runs. */
export const QUERY_PLAN_STATEMENTS: Readonly<Record<string, string>> = {
  agreements_on_file: 'SELECT * FROM public.agreements_on_file',
  people_hours_recorded: 'SELECT * FROM public.people_hours_recorded WHERE work_date >= current_date - 14',
}

/** The characters of plan lines one reply carries; the door cuts a reply at 80,000 (devMcpDoor.ts). */
export const QUERY_PLAN_WINDOW_CHARS = 55_000
/** Where a `find` reply skips lines. Never a line of a plan: EXPLAIN writes no such line. */
export const QUERY_PLAN_GAP = '⋯'

const KEY_SHAPE = /^[a-z][a-z0-9_]{0,59}$/
const FIND_MAX = 80

export type QueryPlanAsk =
  | { ok: true; args: { p_key: string; p_analyze: boolean }; find: string | null; from: number }
  | { ok: false; error: string }

/** The RPC arguments the verb's input becomes — a key by shape, analyze unless plainly false — and what stays here: find and from. */
export function queryPlanArgs(input: Record<string, unknown>): QueryPlanAsk {
  const key = typeof input.statement === 'string' ? input.statement.trim() : ''
  const known = Object.keys(QUERY_PLAN_STATEMENTS).join(', ')
  if (!key) return { ok: false, error: `check_query_plan reads the plan of a named statement. Pass statement: one of ${known}.` }
  if (!KEY_SHAPE.test(key)) return { ok: false, error: `check_query_plan takes a statement's key, never SQL. The statements are: ${known}.` }
  let find: string | null = null
  if (input.find != null) {
    if (typeof input.find !== 'string' || !input.find.trim()) return { ok: false, error: 'find is a piece of text to look for in the plan, such as a table\'s name.' }
    find = input.find.trim()
    if (find.length > FIND_MAX) return { ok: false, error: `find is ${find.length} characters; ${FIND_MAX} is the most. Look for a table's name or a node's.` }
  }
  let from = 1
  if (input.from != null) {
    if (typeof input.from !== 'number' || !Number.isInteger(input.from) || input.from < 1) return { ok: false, error: 'from is a line number, 1 or more: the next_from of the reply before.' }
    if (find) return { ok: false, error: 'Pass find or from, not both: find picks its own lines.' }
    from = input.from
  }
  return { ok: true, args: { p_key: key, p_analyze: input.analyze !== false }, find, from }
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((l): l is string => typeof l === 'string') : [])
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** `Planning Time: 1.234 ms` → 1.234. */
function timeOf(lines: readonly string[], label: string): number | null {
  for (const line of lines) {
    const m = new RegExp(`^${label}: ([0-9.]+) ms`).exec(line.trim())
    if (m) return Number(m[1])
  }
  return null
}

/** The relations a plan reads whole (`Seq Scan on customers pcu`), with how many scans name each, in the plan's order. */
export function walkedRelations(lines: readonly string[]): { relation: string; scans: number }[] {
  const seen: { relation: string; scans: number }[] = []
  for (const line of lines) {
    const m = /\bSeq Scan on ([A-Za-z_][A-Za-z0-9_.]*)/.exec(line)
    if (!m) continue
    const had = seen.find((s) => s.relation === m[1])
    if (had) had.scans += 1
    else seen.push({ relation: m[1], scans: 1 })
  }
  return seen
}

const indentOf = (line: string) => line.length - line.trimStart().length
/** A line that opens a node or a section of the tree: the first line, `->  Node`, `SubPlan 2`, `InitPlan 1`, `CTE name`. */
const opensNode = (line: string, i: number) => i === 0 || /^\s*(->\s|SubPlan \d|InitPlan \d|CTE \S)/.test(line)
/**
 * The lines of every node that holds `text`, with every node above it and their own lines (a join's condition is a
 * line of the join, above the scan it loops over). Case is ignored. Indices into `lines`, in order.
 */
export function findInPlan(lines: readonly string[], text: string): { indices: number[]; matches: number } {
  const needle = text.toLowerCase()
  // Each line's node: itself when it opens one, else the nearest opener above. A trailer line (`Planning:`, the times)
  // belongs to no node.
  // Every line of the tree after its first is indented, so the first flush-left line below it opens the trailer.
  let firstTrailer = lines.length
  for (let j = 1; j < lines.length; j += 1) {
    if (indentOf(lines[j]) === 0) {
      firstTrailer = j
      break
    }
  }
  const owner: number[] = []
  let open = 0
  for (let i = 0; i < lines.length; i += 1) {
    if (i >= firstTrailer) owner.push(-1)
    else {
      if (opensNode(lines[i], i)) open = i
      owner.push(open)
    }
  }
  const keep = new Set<number>()
  const keepNode = (node: number) => {
    for (let i = node; i < firstTrailer && (i === node || owner[i] === node); i += 1) keep.add(i)
  }
  let matches = 0
  const done = new Set<number>()
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].toLowerCase().includes(needle)) continue
    matches += 1
    const node = owner[i]
    if (node < 0) {
      keep.add(i)
      continue
    }
    // The node, then each opener above it with a smaller indent: its path to the top.
    let at = node
    let indent = indentOf(lines[at])
    while (!done.has(at)) {
      done.add(at)
      keepNode(at)
      let up = at - 1
      while (up >= 0 && !(owner[up] === up && indentOf(lines[up]) < indent)) up -= 1
      if (up < 0) break
      at = up
      indent = indentOf(lines[at])
    }
  }
  return { indices: [...keep].sort((a, b) => a - b), matches }
}

export type PlanFit = {
  lines: string[]
  /** A window: the first and last line shown, and where the next window starts (null at the end). */
  from?: number
  to?: number
  next_from?: number | null
  /** find: how many lines held the text, how many lines are shown, and whether the budget cut them short. */
  find?: string
  matches?: number
  shown?: number
  held_back?: number
}

/** The lines one reply carries: a window from a line number, or what `find` picked, each inside the budget. */
export function fitPlan(lines: readonly string[], ask: { find: string | null; from: number }, budget: number = QUERY_PLAN_WINDOW_CHARS): PlanFit {
  if (ask.find) {
    const { indices, matches } = findInPlan(lines, ask.find)
    const out: string[] = []
    let chars = 0
    let shown = 0
    let last = -1
    for (const i of indices) {
      const cost = lines[i].length + 1 + (last >= 0 && i !== last + 1 ? 2 : 0)
      if (shown > 0 && chars + cost > budget) break
      if (shown === 0 ? i > 0 : i !== last + 1) out.push(QUERY_PLAN_GAP)
      out.push(lines[i])
      chars += cost
      shown += 1
      last = i
    }
    if (shown > 0 && last < lines.length - 1) out.push(QUERY_PLAN_GAP)
    return { lines: out, find: ask.find, matches, shown, held_back: indices.length - shown }
  }
  const start = Math.min(Math.max(1, ask.from), Math.max(1, lines.length))
  const out: string[] = []
  let chars = 0
  let i = start - 1
  for (; i < lines.length; i += 1) {
    const cost = lines[i].length + 1
    if (out.length > 0 && chars + cost > budget) break
    out.push(lines[i])
    chars += cost
  }
  return { lines: out, from: start, to: start + out.length - 1, next_from: i < lines.length ? i + 1 : null }
}

/** The plan's lines as the database sent them: the whole plan, or its head and last lines when the database cut it. */
export function planLines(body: unknown): { lines: string[]; total: number; cutByDatabase: number } {
  const b = obj(body)
  const head = strings(b.lines)
  const tail = strings(b.last_lines)
  const total = typeof b.line_count === 'number' ? b.line_count : head.length + tail.length
  const leftOut = b.cut === true && typeof b.left_out === 'number' ? b.left_out : 0
  return { lines: leftOut > 0 ? [...head, `${QUERY_PLAN_GAP} ${leftOut} lines left out by the database's cap`, ...tail] : [...head, ...tail], total, cutByDatabase: leftOut }
}

/** The one-line reading put in front of the reply, read off the whole plan, whatever the reply's window shows. */
export function queryPlanReading(body: unknown, fit?: PlanFit): string {
  const b = obj(body)
  const key = typeof b.key === 'string' ? b.key : 'the statement'
  const { lines, total, cutByDatabase } = planLines(body)
  if (lines.length === 0) return `${key}: the database answered with no plan lines.`
  const parts: string[] = []
  if (b.analyzed === true) {
    parts.push(`analyzed, so the statement ran: planning ${timeOf(lines, 'Planning Time') ?? '?'} ms, execution ${timeOf(lines, 'Execution Time') ?? '?'} ms`)
  } else {
    parts.push('the plan alone, nothing ran')
  }
  const walked = walkedRelations(lines)
  parts.push(walked.length === 0 ? 'no Seq Scan anywhere in it' : `Seq Scan on ${walked.map((w) => (w.scans > 1 ? `${w.relation} ×${w.scans}` : w.relation)).join(', ')}`)
  parts.push(cutByDatabase > 0 ? `${plural(total, 'line')}, ${cutByDatabase} left out by the database's cap, so a scan there is not counted` : plural(total, 'line'))
  let shows = ''
  if (fit?.find != null) {
    shows = fit.matches === 0
      ? ` Nothing in the plan holds "${fit.find}".`
      : ` ${plural(fit.matches ?? 0, 'line')} ${fit.matches === 1 ? 'holds' : 'hold'} "${fit.find}"; shown with the nodes above them, ${QUERY_PLAN_GAP} where lines are skipped${(fit.held_back ?? 0) > 0 ? `, and ${fit.held_back} more lines did not fit: look for something narrower` : ''}.`
  } else if (fit && fit.next_from != null) {
    shows = ` Lines ${fit.from}–${fit.to} are here; from: ${fit.next_from} reads on, and runs the statement again. find: a table's name shows its scans with the joins above them in one call.`
  }
  return `${key}: ${parts.join('; ')}. A Seq Scan is a walk only where it sits under a loop: read its lines.${shows}`
}

/** The whole reply: the reading, what the database said of the plan, and the lines that fit. */
export function queryPlanReply(body: unknown, ask: { find: string | null; from: number }, budget: number = QUERY_PLAN_WINDOW_CHARS): Json {
  const b = obj(body)
  const { lines, total, cutByDatabase } = planLines(body)
  const fit = fitPlan(lines, ask, budget)
  const { lines: shown, ...window } = fit
  return {
    reading: queryPlanReading(body, fit),
    key: b.key ?? null,
    analyzed: b.analyzed === true,
    line_count: total,
    ...(cutByDatabase > 0 ? { left_out_by_database: cutByDatabase } : {}),
    ...window,
    lines: shown,
  }
}
