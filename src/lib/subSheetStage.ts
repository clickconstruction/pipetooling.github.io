/**
 * Sub sheet stages (v2.2767): where a Sub Labor sheet stands between the sub
 * and their money. Three stored stages plus a derived fourth:
 *
 *   working → walkthrough → customer_pay   (→ paid, when open = $0)
 *
 * The office steps a sheet either direction on Jobs → Sub Labor; the sub can
 * move working → walkthrough from the portal ("my work here is done"). This
 * kernel is the one vocabulary both sides read from — the office chips here,
 * the sub-facing copy in subPortal/subPortalI18n.ts. Labels must match the
 * SQL `sub_sheet_stage_label()` the Activity trigger uses.
 */

export type SubSheetStage = 'working' | 'walkthrough' | 'customer_pay'

export const SUB_SHEET_STAGES: readonly SubSheetStage[] = ['working', 'walkthrough', 'customer_pay']

export type SubSheetStageSource = 'office' | 'portal' | 'auto'

export function isSubSheetStage(value: unknown): value is SubSheetStage {
  return value === 'working' || value === 'walkthrough' || value === 'customer_pay'
}

/** Unknown / missing → `working` (the column default; every legacy sheet reads this way). */
export function normalizeSubSheetStage(value: unknown): SubSheetStage {
  return isSubSheetStage(value) ? value : 'working'
}

export function normalizeSubSheetStageSource(value: unknown): SubSheetStageSource | null {
  return value === 'office' || value === 'portal' || value === 'auto' ? value : null
}

export function nextSubSheetStage(stage: SubSheetStage): SubSheetStage | null {
  const i = SUB_SHEET_STAGES.indexOf(stage)
  return SUB_SHEET_STAGES[i + 1] ?? null
}

export function prevSubSheetStage(stage: SubSheetStage): SubSheetStage | null {
  const i = SUB_SHEET_STAGES.indexOf(stage)
  return i > 0 ? (SUB_SHEET_STAGES[i - 1] ?? null) : null
}

/** The office chip text — what we are waiting on. Mirrors `sub_sheet_stage_label()` in SQL. */
export const SUB_SHEET_STAGE_LABEL: Record<SubSheetStage, string> = {
  working: 'Waiting on work',
  walkthrough: 'Waiting on walk-through',
  customer_pay: 'Waiting on customer',
}

/** One-line hint under each stage in the office menu. */
export const SUB_SHEET_STAGE_HINT: Record<SubSheetStage, string> = {
  working: 'default on every new sheet',
  walkthrough: 'work is done — schedule the walk-through',
  customer_pay: 'passed the walk-through — bill the job',
}

export type SubSheetStageTone = 'amber' | 'violet' | 'blue'

export const SUB_SHEET_STAGE_TONE: Record<SubSheetStage, SubSheetStageTone> = {
  working: 'amber',
  walkthrough: 'violet',
  customer_pay: 'blue',
}

/** "Waiting on work → Waiting on walk-through" — the Activity line's core. */
export function describeSubSheetStageChange(from: SubSheetStage, to: SubSheetStage): string {
  return `${SUB_SHEET_STAGE_LABEL[from]} → ${SUB_SHEET_STAGE_LABEL[to]}`
}

/**
 * Who moved it and when, for the chip title and the editor box:
 * "Danny, from the portal · Sep 4" / "Malachi · Sep 6" / "auto · Sep 6".
 * `changedAt` is an ISO instant; a missing one gives just the who.
 */
export function subSheetStageStamp(input: {
  source: SubSheetStageSource | null
  changedAt: string | null
  changedByName: string | null
  contractorName: string | null
}): string | null {
  const { source, changedAt, changedByName, contractorName } = input
  if (!source && !changedAt) return null
  const firstName = (contractorName ?? '').trim().split(/\s+/)[0] || 'the sub'
  const who =
    source === 'portal'
      ? `${firstName}, from the portal`
      : source === 'auto'
        ? 'auto'
        : (changedByName ?? '').trim() || 'office'
  const when = changedAt ? formatStampDate(changedAt) : null
  return when ? `${who} · ${when}` : who
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatStampDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}
