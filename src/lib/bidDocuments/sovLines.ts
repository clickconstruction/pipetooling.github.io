/**
 * Schedule of values, the My lines shape (v2.4070): the estimator's own lines,
 * seeded from the three stages, then theirs — rename, add, reorder, remove, note.
 * A line's value is typed; when the letter splits labor and material, a line's
 * labor is typed too (null = the company labor share), and material is what is
 * left. The lines are checked against the contract (`reconcileLines`) and can be
 * scaled to it in one move. Pure; the tab and the Approval PDF read the rows from
 * `bid_sov_lines`.
 */
import { formatCurrency } from '../format'
import type { TakeoffStage } from '../bids/bidTakeoffHelpers'
import { SCHEDULE_OF_VALUES_HEADING, type ScheduleOfValuesLetter } from './scheduleOfValues'
import { SOV_NOTE_INDENT, type SovStageSplit } from './sovLaborMaterial'
import { escapeHtml } from './htmlDoc'

export type SovLine = {
  id: string
  sortOrder: number
  label: string
  value: number
  /** Typed labor; null = the company labor share when the letter splits. */
  labor: number | null
  note: string
  /** The stage this line was seeded from, when it was. */
  stage: TakeoffStage | null
}

/** A line as it will be inserted — everything but the id. */
export type SovLineSeed = Omit<SovLine, 'id'>

const cents = (n: number) => Math.round((Number(n) || 0) * 100)
const money = (n: number) => `$${formatCurrency(n)}`

/** The three stage lines from the letter (and the split's labor when there is one) — what "My lines" starts from. */
export function seedLinesFromStages(letter: Pick<ScheduleOfValuesLetter, 'rows'>, split?: ReadonlyArray<SovStageSplit> | null): SovLineSeed[] {
  const bySt = split ? new Map(split.map((s) => [s.stage, s] as const)) : null
  return letter.rows.map((r, i) => {
    const s = bySt?.get(r.stage)
    return { sortOrder: i, label: r.label, value: r.amount, labor: s ? s.labor : null, note: s?.note ?? '', stage: r.stage }
  })
}

export type SovLineSplit = { labor: number; material: number; source: 'typed' | 'rule' }

/** A line's labor / material: the typed labor (clamped to the value), else the company share; material is the rest. */
export function lineSplit(line: Pick<SovLine, 'value' | 'labor'>, ruleLaborPct: number): SovLineSplit {
  const v = cents(line.value)
  if (line.labor != null && Number.isFinite(Number(line.labor))) {
    const l = Math.min(v, Math.max(0, cents(line.labor)))
    return { labor: l / 100, material: (v - l) / 100, source: 'typed' }
  }
  const l = Math.round((v * ruleLaborPct) / 100)
  return { labor: l / 100, material: (v - l) / 100, source: 'rule' }
}

export type SovLinesTotals = { value: number; labor: number; material: number }

export function sovLinesTotals(lines: ReadonlyArray<Pick<SovLine, 'value' | 'labor'>>, ruleLaborPct: number): SovLinesTotals {
  let v = 0
  let l = 0
  let m = 0
  for (const line of lines) {
    const s = lineSplit(line, ruleLaborPct)
    v += cents(line.value)
    l += cents(s.labor)
    m += cents(s.material)
  }
  return { value: v / 100, labor: l / 100, material: m / 100 }
}

/** How the lines stand against the contract: the gap is contract − lines (positive = short). */
export function reconcileLines(lines: ReadonlyArray<Pick<SovLine, 'value'>>, contractAmount: number): { total: number; gap: number; balanced: boolean } {
  const total = lines.reduce((a, l) => a + cents(l.value), 0)
  const gap = cents(contractAmount) - total
  return { total: total / 100, gap: gap / 100, balanced: gap === 0 }
}

/**
 * Every line scaled by the same factor so they add to the contract to the cent
 * (largest remainder for the leftover cents); a typed labor figure scales with its
 * line. Lines that are all zero cannot be scaled — returns null.
 */
export function scaleLinesToContract<T extends Pick<SovLine, 'value' | 'labor'>>(lines: ReadonlyArray<T>, contractAmount: number): Array<T & { value: number; labor: number | null }> | null {
  const total = lines.reduce((a, l) => a + cents(l.value), 0)
  const target = cents(contractAmount)
  if (total <= 0 || target <= 0) return null
  const exact = lines.map((l) => (cents(l.value) * target) / total)
  const floors = exact.map((c) => Math.floor(c))
  let left = target - floors.reduce((a, b) => a + b, 0)
  const order = exact.map((c, i) => ({ i, frac: c - Math.floor(c) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] = (floors[i] ?? 0) + 1
    left -= 1
  }
  return lines.map((l, i) => {
    const newValue = (floors[i] ?? 0) / 100
    const ratio = cents(l.value) > 0 ? (floors[i] ?? 0) / cents(l.value) : 0
    const labor = l.labor == null ? null : Math.min(newValue, Math.round(cents(l.labor) * ratio) / 100)
    return { ...l, value: newValue, labor }
  })
}

/**
 * The GC's line names pasted from their form: one per line; a leading number,
 * bullet or dash is dropped ("3. Gas piping" → "Gas piping"); blank lines skipped.
 */
export function parsePastedLineNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\(?\d+[.)]?)\s*/, '').trim())
    .filter((l) => l.length > 0)
    .map((l) => l.slice(0, 200))
}

export type SovLinesSectionOptions = { split?: boolean; ruleLaborPct?: number; totalOnly?: boolean }

/**
 * The letter section for the lines shape: `Label — $value` (with `(labor … · material …)` when
 * split), a note indented under its line, then the lines' Total. [] when there are no lines.
 */
export function buildSovLinesSectionLines(lines: ReadonlyArray<SovLine>, options?: SovLinesSectionOptions): string[] {
  const kept = lines.filter((l) => l.label.trim() || cents(l.value) > 0)
  if (kept.length === 0) return []
  const rule = options?.ruleLaborPct ?? 45
  const totals = sovLinesTotals(kept, rule)
  if (options?.totalOnly) return [SCHEDULE_OF_VALUES_HEADING, `See the attached schedule — ${money(totals.value)}`]
  const out: string[] = [SCHEDULE_OF_VALUES_HEADING]
  for (const l of kept) {
    const label = l.label.trim() || '(unnamed line)'
    if (options?.split) {
      const s = lineSplit(l, rule)
      out.push(`${label} — ${money(l.value)} (labor ${money(s.labor)} · material ${money(s.material)})`)
    } else {
      out.push(`${label} — ${money(l.value)}`)
    }
    if (l.note.trim()) out.push(`${SOV_NOTE_INDENT}${l.note.trim()}`)
  }
  out.push(options?.split ? `Total — ${money(totals.value)} (labor ${money(totals.labor)} · material ${money(totals.material)})` : `Total — ${money(totals.value)}`)
  return out
}

export type SovLinesSheetInput = {
  title: string
  subtitle: string
  lines: ReadonlyArray<SovLine>
  contractAmount: number
  split: boolean
  ruleLaborPct: number
}

const cell = 'padding:0.4rem 0.5rem; border-bottom:1px solid #e5e7eb; vertical-align:top'
const num = `${cell}; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums`
const th = 'text-align:left; font-size:0.75em; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1.5px solid #17191e; padding:0.35rem 0.5rem'
const thNum = `${th}; text-align:right`
const totalCell = `${cell}; border-top:1.5px solid #17191e; border-bottom:none; font-weight:700`
const totalNum = `${num}; border-top:1.5px solid #17191e; border-bottom:none; font-weight:700`

/** The attached sheet for the lines shape — the pay-application form: #, description, (labor, material,) scheduled value, notes. */
export function buildSovLinesSheetHtml(input: SovLinesSheetInput): string {
  const kept = input.lines.filter((l) => l.label.trim() || cents(l.value) > 0)
  const totals = sovLinesTotals(kept, input.ruleLaborPct)
  const rec = reconcileLines(kept, input.contractAmount)
  const rows = kept
    .map((l, i) => {
      const s = input.split ? lineSplit(l, input.ruleLaborPct) : null
      return `<tr>
        <td style="${num}">${i + 1}</td>
        <td style="${cell}">${escapeHtml(l.label.trim() || '(unnamed line)')}</td>
        ${s ? `<td style="${num}">${money(s.labor)}${s.source === 'rule' ? ' <span style="font-size:0.75em; color:#6b7280">(rule)</span>' : ''}</td><td style="${num}">${money(s.material)}</td>` : ''}
        <td style="${num}"><strong>${money(l.value)}</strong></td>
        <td style="${cell}; color:#4b5563; font-size:0.85em">${escapeHtml(l.note.trim())}</td>
      </tr>`
    })
    .join('')
  const footer: string[] = ['Lump-sum proposal; this allocation is for progress billing only.']
  if (!rec.balanced) footer.push(`The lines add to ${money(rec.total)}; the contract is ${money(input.contractAmount)}.`)
  if (input.split) footer.push(`Labor and material as the estimator allocated them; "(rule)" = the company labor share (${input.ruleLaborPct}%) where no figure was typed.`)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>
  body { font-family: sans-serif; margin: 1in; color: #17191e; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  h1 { font-size: 1.35rem; margin: 0; }
  .sub { color: #6b7280; font-size: 0.85rem; margin: 0.15rem 0 1.25rem; }
  .foot { color: #6b7280; font-size: 0.8rem; margin-top: 0.9rem; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${escapeHtml(input.title)}</h1>
  <p class="sub">${escapeHtml(input.subtitle)}</p>
  <table>
    <thead><tr><th style="${thNum}">#</th><th style="${th}">Description of work</th>${input.split ? `<th style="${thNum}">Labor</th><th style="${thNum}">Material</th>` : ''}<th style="${thNum}">Scheduled value</th><th style="${th}">Notes</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="${input.split ? 6 : 4}" style="${cell}; color:#6b7280">No lines yet.</td></tr>`}
      <tr>
        <td style="${totalCell}"></td>
        <td style="${totalCell}">Total</td>
        ${input.split ? `<td style="${totalNum}">${money(totals.labor)}</td><td style="${totalNum}">${money(totals.material)}</td>` : ''}
        <td style="${totalNum}">${money(totals.value)}</td>
        <td style="${totalCell}"></td>
      </tr>
    </tbody>
  </table>
  <p class="foot">${footer.map((b) => escapeHtml(b)).join(' ')}</p>
</body></html>`
}
