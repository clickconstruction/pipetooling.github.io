/**
 * Materials by stage (v2.3673) — the paper: the printed schedule of values
 * (page 1: the three stages; page 2: every fixture with its stage) and the
 * short "Materials by stage" section the cover letter and the Approval PDF
 * carry. Pure HTML / text builders; the caller gathers the summary
 * (`computeMaterialsByStage`, or `loadMaterialsByStageForBid` for the paper
 * that fetches its own data).
 */
import { escapeHtml } from './htmlDoc'
import { formatCurrency } from '../format'
import {
  STAGE_KEYS,
  STAGE_LABELS,
  STAGE_NUMBER,
  describeWeights,
  normalizeWeights,
  stagesOf,
  type FixtureStageBreakdown,
  type MaterialsByStageSummary,
  type StageMoney,
} from '../bids/materialsByStage'
import type { TakeoffStage } from '../bids/bidTakeoffHelpers'

export const MATERIALS_BY_STAGE_HEADING = 'Materials by stage:'

export type MaterialsByStageLetterRow = { label: string; amountFormatted: string }

/** The three letter rows, in stage order, skipping a stage with nothing in it. */
export function materialsByStageLetterRows(summary: Pick<MaterialsByStageSummary, 'scaled'>): MaterialsByStageLetterRow[] {
  return STAGE_KEYS.filter((k) => summary.scaled[k] > 0.005).map((k) => ({ label: STAGE_LABELS[k], amountFormatted: `$${formatCurrency(summary.scaled[k])}` }))
}

/** `['Materials by stage:', 'Rough In — $29,227.36', …]`; [] when there are no rows. */
export function buildMaterialsByStageSectionLines(rows: ReadonlyArray<MaterialsByStageLetterRow>): string[] {
  if (rows.length === 0) return []
  return [MATERIALS_BY_STAGE_HEADING, ...rows.map((r) => `${r.label} — ${r.amountFormatted}`)]
}

/**
 * The fixture names under each stage for the printed page: a fixture that
 * splits reads "½ of ft of 4IN WASTE" (or "70% of …"); one whose lines went
 * their own way reads "part of SK-1".
 */
export function fixtureNamesByStage(fixtures: ReadonlyArray<FixtureStageBreakdown>): Record<TakeoffStage, string[]> {
  const out: Record<TakeoffStage, string[]> = { rough_in: [], top_out: [], trim_set: [] }
  for (const f of fixtures) {
    if (f.raw <= 0) continue
    const staged = f.byStage.rough_in + f.byStage.top_out + f.byStage.trim_set
    for (const k of STAGE_KEYS) {
      const amt = f.byStage[k]
      if (amt <= 0.005) continue
      const share = staged > 0 ? amt / f.raw : 0
      let prefix = ''
      if (share < 0.995) {
        if (f.ownSplitCount > 0) prefix = 'part of '
        else if (Math.abs(share - 0.5) < 0.005) prefix = '½ of '
        else if (Math.abs(share - 1 / 3) < 0.005) prefix = '⅓ of '
        else prefix = `${Math.round(share * 100)}% of `
      }
      out[k].push(prefix + f.fixture)
    }
  }
  return out
}

/** "3", "1 + 2 (½ · ½)", "1 + 2 (70 · 30)", "mixed" (lines went their own way), or "—". */
export function fixtureStageText(f: FixtureStageBreakdown): string {
  if (f.ownSplitCount > 0) return 'mixed'
  const w = f.fixtureWeights
  const n = normalizeWeights(w)
  if (!n) return f.raw > 0 ? '—' : ''
  const lit = stagesOf(n)
  const nums = lit.map((k) => String(STAGE_NUMBER[k])).join(' + ')
  const d = describeWeights(n)
  return d ? `${nums} (${d})` : nums
}

export type ScheduleOfValuesInput = {
  /** Raw (unescaped) title; the builder escapes it. */
  title: string
  /** Raw one-line subtitle: "BP431 · Blanco · takeoff materials by stage × 1.5 · printed 9/21/26 · Wendi". */
  subtitle: string
  summary: MaterialsByStageSummary
  /** Scale to contract (opt-in): the bid amount and the stages spread by their shares. */
  contract?: { amount: number; scaled: StageMoney } | null
  /** Names for the fixtures that carry no stage (the footer). */
  unstagedNames?: string[]
  /** "Factor 1.5 is the company default." / "Factor 1.35 is this bid's own." */
  factorNote?: string | null
}

const cell = 'padding:0.4rem 0.5rem; border-bottom:1px solid #e5e7eb; vertical-align:top'
const num = `${cell}; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums`
const money = (n: number) => `$${formatCurrency(n)}`

export function buildScheduleOfValuesHtml(input: ScheduleOfValuesInput): string {
  const { summary } = input
  const names = fixtureNamesByStage(summary.fixtures)
  const factorLabel = `× ${summary.factor}`
  const stageRows = STAGE_KEYS.map((k) => {
    const list = names[k]
    return `<tr>
        <td style="${cell}"><strong>${STAGE_NUMBER[k]} · ${STAGE_LABELS[k]}</strong></td>
        <td style="${cell}; color:#4b5563; font-size:0.85em">${escapeHtml(list.join(', ') || '—')}</td>
        <td style="${num}">${money(summary.byStage[k])}</td>
        <td style="${num}"><strong>${money(summary.scaled[k])}</strong></td>
        <td style="${num}">${summary.assignedRaw > 0 ? `${(Math.round(summary.sharesPct[k] * 10) / 10).toFixed(1)} %` : '—'}</td>
        ${input.contract ? `<td style="${num}"><strong>${money(input.contract.scaled[k])}</strong></td>` : ''}
      </tr>`
  }).join('')
  const totalRow = `<tr>
        <td style="${cell}; border-top:1.5px solid #17191e; border-bottom:none; font-weight:700">Total</td>
        <td style="${cell}; border-top:1.5px solid #17191e; border-bottom:none"></td>
        <td style="${num}; border-top:1.5px solid #17191e; border-bottom:none; font-weight:700">${money(summary.assignedRaw)}</td>
        <td style="${num}; border-top:1.5px solid #17191e; border-bottom:none; font-weight:700">${money(summary.totalScaled)}</td>
        <td style="${num}; border-top:1.5px solid #17191e; border-bottom:none; font-weight:700">${summary.assignedRaw > 0 ? '100 %' : '—'}</td>
        ${input.contract ? `<td style="${num}; border-top:1.5px solid #17191e; border-bottom:none; font-weight:700">${money(input.contract.amount)}</td>` : ''}
      </tr>`
  const th = 'text-align:left; font-size:0.75em; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1.5px solid #17191e; padding:0.35rem 0.5rem'
  const thNum = `${th}; text-align:right`
  const unstaged = (input.unstagedNames ?? []).filter(Boolean)
  const footerBits: string[] = []
  if (summary.unassignedRaw > 0.005) footerBits.push(`${money(summary.unassignedRaw)} of material still has no stage${summary.incompleteFixtureIds.length > 0 ? ` (${summary.incompleteFixtureIds.length} fixture${summary.incompleteFixtureIds.length === 1 ? '' : 's'})` : ''}.`)
  if (unstaged.length > 0) footerBits.push(`Not staged: ${unstaged.join(', ')}.`)
  footerBits.push(`Materials from the Takeoffs sheet; order rounding included.`)
  if (input.factorNote) footerBits.push(input.factorNote)
  if (input.contract) footerBits.push(`Scaled to contract: the ${money(input.contract.amount)} bid spread by each stage's share of the staged material.`)

  const fixtureRows = summary.fixtures
    .filter((f) => f.raw > 0)
    .map(
      (f) => `<tr>
        <td style="${cell}">${escapeHtml(f.fixture)}</td>
        <td style="${cell}; text-align:center; white-space:nowrap">${escapeHtml(fixtureStageText(f))}</td>
        <td style="${num}">${money(f.raw)}</td>
        <td style="${num}">${f.byStage.rough_in > 0.005 ? money(f.byStage.rough_in) : ''}</td>
        <td style="${num}">${f.byStage.top_out > 0.005 ? money(f.byStage.top_out) : ''}</td>
        <td style="${num}">${f.byStage.trim_set > 0.005 ? money(f.byStage.trim_set) : ''}</td>
        <td style="${num}; color:#b91c1c">${f.unassigned > 0.005 ? money(f.unassigned) : ''}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>
  body { font-family: sans-serif; margin: 1in; color: #17191e; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  h1 { font-size: 1.35rem; margin: 0; }
  h2 { font-size: 1rem; margin: 0 0 0.5rem; }
  .sub { color: #6b7280; font-size: 0.85rem; margin: 0.15rem 0 1.25rem; }
  .foot { color: #6b7280; font-size: 0.8rem; margin-top: 0.9rem; }
  .page2 { page-break-before: always; margin-top: 2rem; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${escapeHtml(input.title)}</h1>
  <p class="sub">${escapeHtml(input.subtitle)}</p>
  <table>
    <thead><tr><th style="${th}">Stage</th><th style="${th}">Fixtures &amp; tie-ins</th><th style="${thNum}">Materials</th><th style="${thNum}">${escapeHtml(factorLabel)}</th><th style="${thNum}">Share</th>${input.contract ? `<th style="${thNum}">Of contract</th>` : ''}</tr></thead>
    <tbody>${stageRows}${totalRow}</tbody>
  </table>
  <p class="foot">${footerBits.map((b) => escapeHtml(b)).join(' ')}</p>
  <div class="page2">
    <h2>Every fixture and its stage</h2>
    <table>
      <thead><tr><th style="${th}">Fixture or tie-in</th><th style="${th}; text-align:center">Stage</th><th style="${thNum}">Materials</th><th style="${thNum}">1 Rough In</th><th style="${thNum}">2 Top Out</th><th style="${thNum}">3 Trim Set</th><th style="${thNum}">No stage</th></tr></thead>
      <tbody>${fixtureRows || `<tr><td colspan="7" style="${cell}; color:#6b7280">No costed fixtures.</td></tr>`}</tbody>
    </table>
    <p class="foot">"mixed" = lines under the fixture carry their own stage; the three columns say where the money went. Raw material, before the factor.</p>
  </div>
</body></html>`
}
