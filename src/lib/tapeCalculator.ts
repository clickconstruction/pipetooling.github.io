/**
 * Pure kernel for the Pricing Tape calculator (v2.2359) — the floating
 * tape calculator on Bids → Pricing. All math, tape, paste-parsing, and
 * search logic lives here; BidsPricingCalculator.tsx is a thin shell.
 *
 * Left-to-right evaluation like a desk adding machine — no operator
 * precedence, on purpose: `2 + 3 × 4` is 20, matching what an estimator
 * keys into a physical calculator.
 */

export type CalcOp = '+' | '−' | '×' | '÷'

export type TapeEntry = {
  id: string
  expr: string
  result: number
  /** epoch ms */
  at: number
  note?: string
}

export type CalcState = {
  /** the number currently being typed, as a raw string ("0", "1599.03") */
  current: string
  pending: { acc: number; op: CalcOp } | null
  /** display pieces of the expression so far, e.g. ["8", "×"] */
  exprParts: string[]
  /** true right after `=` (or a paste-sum / rollback) — next digit starts fresh */
  justEvaluated: boolean
}

export const initialCalcState: CalcState = {
  current: '0',
  pending: null,
  exprParts: [],
  justEvaluated: false,
}

const round10 = (n: number) => Math.round(n * 1e10) / 1e10

export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n * 100) / 100
  return r.toLocaleString('en-US', { maximumFractionDigits: 10 })
}

/** Comma-group a raw typed string without losing a trailing "." or "0" the user typed. */
export function formatTyped(s: string): string {
  const neg = s.startsWith('-')
  const body = neg ? s.slice(1) : s
  const [intPart = '', ...rest] = body.split('.')
  const int = intPart
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (
    (neg ? '-' : '') + (int || '0') + (rest.length ? '.' + rest.join('') : '')
  )
}

export function applyOp(a: number, op: CalcOp, b: number): number {
  if (op === '+') return a + b
  if (op === '−') return a - b
  if (op === '×') return a * b
  return b === 0 ? NaN : a / b
}

export function pressDigit(state: CalcState, d: string): CalcState {
  const base = state.justEvaluated
    ? { ...state, current: '0', justEvaluated: false }
    : state
  if (d === '.') {
    if (base.current.includes('.')) return base
    return { ...base, current: base.current + '.' }
  }
  return { ...base, current: base.current === '0' ? d : base.current + d }
}

export function pressOp(state: CalcState, op: CalcOp): CalcState {
  const v = parseFloat(state.current) || 0
  const pending = state.pending
    ? { acc: applyOp(state.pending.acc, state.pending.op, v), op }
    : { acc: v, op }
  return {
    current: '0',
    pending,
    exprParts: [...state.exprParts, formatTyped(state.current), op],
    justEvaluated: false,
  }
}

export function pressEquals(
  state: CalcState,
  now: number,
): { state: CalcState; entry: TapeEntry | null } {
  if (!state.pending) return { state, entry: null }
  const v = parseFloat(state.current) || 0
  const result = applyOp(state.pending.acc, state.pending.op, v)
  const entry: TapeEntry = {
    id: `${now}-${Math.floor(Math.random() * 1e6)}`,
    expr: [...state.exprParts, formatTyped(state.current)].join(' '),
    result,
    at: now,
  }
  return {
    state: {
      current: String(Number.isFinite(result) ? round10(result) : 0),
      pending: null,
      exprParts: [],
      justEvaluated: true,
    },
    entry,
  }
}

export function pressClear(): CalcState {
  return { ...initialCalcState }
}

export function pressBackspace(state: CalcState): CalcState {
  if (state.justEvaluated) return state
  return {
    ...state,
    current: state.current.length > 1 ? state.current.slice(0, -1) : '0',
  }
}

export function pressPercent(state: CalcState): CalcState {
  return {
    ...state,
    current: String(round10((parseFloat(state.current) || 0) / 100)),
    justEvaluated: false,
  }
}

/** Load a tape entry's result back into the display as the start of the next calculation. */
export function rollBackTo(entry: TapeEntry): CalcState {
  return {
    current: String(entry.result),
    pending: null,
    exprParts: [],
    justEvaluated: true,
  }
}

/**
 * Pull dollar amounts out of pasted text.
 * - `$1,599.03`, `1,599.03`, `617.97` → numbers
 * - accounting negatives `(617.97)` → -617.97
 * - part codes stay out: a digit glued to a letter, dot, or hyphen
 *   ("WH-1", "FS-1", "PVC4") is an identifier, not a price
 */
export function parsePastedNumbers(text: string): number[] {
  const tokens = text.match(/(?<![\w.-])\(?\$?\s?\d[\d,]*(?:\.\d+)?\)?/g) ?? []
  const out: number[] = []
  for (const tok of tokens) {
    const n = parseFloat(tok.replace(/[^0-9.]/g, ''))
    if (Number.isNaN(n)) continue
    out.push(tok.includes('(') ? -n : n)
  }
  return out
}

/**
 * Apply a paste to the calculator.
 * One number → it lands in the display as if typed.
 * Several → they sum into one tape entry, every number printed so a bad grab is visible.
 */
export function applyPaste(
  state: CalcState,
  text: string,
  now: number,
): { state: CalcState; entry: TapeEntry | null } {
  const nums = parsePastedNumbers(text)
  if (nums.length === 0) return { state, entry: null }
  if (nums.length === 1) {
    return {
      state: { ...state, current: String(nums[0]), justEvaluated: false },
      entry: null,
    }
  }
  const sum = round10(nums.reduce((a, b) => a + b, 0))
  const entry: TapeEntry = {
    id: `${now}-${Math.floor(Math.random() * 1e6)}`,
    expr: nums.map(formatAmount).join(' + ') + ' (pasted)',
    result: sum,
    at: now,
  }
  return {
    state: {
      current: String(sum),
      pending: null,
      exprParts: [],
      justEvaluated: true,
    },
    entry,
  }
}

/** "just now" · "4m ago" · "1h 12m ago", plus time of day — Wendi's ask verbatim. */
export function formatWhen(at: number, now: number): string {
  const mins = Math.max(0, Math.round((now - at) / 60000))
  const ago =
    mins === 0
      ? 'just now'
      : mins < 60
        ? `${mins}m ago`
        : `${Math.floor(mins / 60)}h ${mins % 60}m ago`
  const d = new Date(at)
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${ago} · ${h}:${m < 10 ? '0' : ''}${m} ${ampm}`
}

/**
 * Filter the tape. Matches expression, result, note, and timestamp text;
 * comma-insensitive so "1599" finds "1,599.03".
 */
export function filterTape(
  entries: TapeEntry[],
  query: string,
  now: number,
): TapeEntry[] {
  const q = query.trim().toLowerCase().replace(/,/g, '')
  if (!q) return entries
  return entries.filter((e) => {
    const hay =
      `${e.expr} ${formatAmount(e.result)} ${formatWhen(e.at, now)} ${e.note ?? ''}`.toLowerCase()
    return hay.includes(q) || hay.replace(/,/g, '').includes(q)
  })
}

const TAPE_CAP = 200

/** Append an entry, keeping the tape from growing without bound. */
export function appendEntry(
  entries: TapeEntry[],
  entry: TapeEntry,
): TapeEntry[] {
  const next = [...entries, entry]
  return next.length > TAPE_CAP ? next.slice(next.length - TAPE_CAP) : next
}

export function deserializeTape(json: string | null): TapeEntry[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is TapeEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as TapeEntry).id === 'string' &&
        typeof (e as TapeEntry).expr === 'string' &&
        typeof (e as TapeEntry).result === 'number' &&
        typeof (e as TapeEntry).at === 'number' &&
        ((e as TapeEntry).note === undefined ||
          typeof (e as TapeEntry).note === 'string'),
    )
  } catch {
    return []
  }
}

/** Map a KeyboardEvent.key to a calculator action, or null if it isn't one. */
export type CalcKey =
  | { kind: 'digit'; d: string }
  | { kind: 'op'; op: CalcOp }
  | { kind: 'equals' }
  | { kind: 'clear' }
  | { kind: 'backspace' }
  | { kind: 'percent' }

export function keyboardCalcKey(key: string): CalcKey | null {
  if (/^[0-9]$/.test(key)) return { kind: 'digit', d: key }
  if (key === '.') return { kind: 'digit', d: '.' }
  if (key === '+') return { kind: 'op', op: '+' }
  if (key === '-') return { kind: 'op', op: '−' }
  if (key === '*' || key === 'x' || key === 'X') return { kind: 'op', op: '×' }
  if (key === '/') return { kind: 'op', op: '÷' }
  if (key === '=' || key === 'Enter') return { kind: 'equals' }
  if (key === 'Backspace') return { kind: 'backspace' }
  if (key === '%') return { kind: 'percent' }
  if (key === 'c' || key === 'C') return { kind: 'clear' }
  return null
}

/**
 * Letters that start a tape note right after `=`. Excludes x/X (multiply
 * chains from a result) and c/C (clear) so calculator muscle memory wins.
 */
export function isNoteStarterKey(key: string): boolean {
  return /^[a-wyzA-WYZ]$/.test(key) && key !== 'c' && key !== 'C'
}
