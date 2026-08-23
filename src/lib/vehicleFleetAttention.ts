/**
 * The Vehicles tab's fleet strip, re-cut for a phone (v2.2169): the old
 * seven-pill cloud split into FACTS (one quiet line — counts that describe the
 * fleet) and ATTENTION (a short list — counts that ask for work). Pure so the
 * ordering/labels are testable and the component stays thin.
 */

export type FleetFacts = {
  total: number
  motorPool: number
  /** Weekly insurance + registration cost; 0/undefined hides the fact. */
  weeklyInsReg?: number | null
}

/** "12 vehicles" · "7 in motor pool" · "$203.73/wk ins+reg" — zero-valued facts (other than the total) are omitted. */
export function fleetFactsLine(f: FleetFacts, formatMoney: (n: number) => string): string[] {
  const out = [`${f.total} vehicle${f.total === 1 ? '' : 's'}`]
  if (f.motorPool > 0) out.push(`${f.motorPool} in motor pool`)
  if (f.weeklyInsReg != null && f.weeklyInsReg > 0) out.push(`$${formatMoney(f.weeklyInsReg)}/wk ins+reg`)
  return out
}

export type FleetAttentionInput = {
  unassigned: number
  uninsured: number
  staleReadings: number
  oilDueSoon: number
  oilOverdue: number
  openProblems: number
  openTasks: number
}

export type FleetAttentionItem = {
  key: 'oil_overdue' | 'open_problems' | 'stale_readings' | 'uninsured' | 'unassigned' | 'oil_due_soon' | 'open_tasks'
  count: number
  /** Label WITHOUT the count ("need a reading"); pluralized for the count. */
  label: string
  tone: 'red' | 'amber'
  /** Rows that open a catch-up list carry an action (rendered with a chevron). */
  action?: 'readings' | 'tasks'
}

/**
 * Red (urgent) first, then amber, each in a fixed reading order; zero counts
 * dropped. Order within a tone is "what blocks the fleet most" → "housekeeping".
 */
export function buildFleetAttentionItems(i: FleetAttentionInput): FleetAttentionItem[] {
  const items: FleetAttentionItem[] = []
  if (i.oilOverdue > 0) items.push({ key: 'oil_overdue', count: i.oilOverdue, label: 'oil overdue', tone: 'red' })
  if (i.openProblems > 0) items.push({ key: 'open_problems', count: i.openProblems, label: `open problem${i.openProblems === 1 ? '' : 's'}`, tone: 'red' })
  if (i.staleReadings > 0) items.push({ key: 'stale_readings', count: i.staleReadings, label: 'need a reading', tone: 'amber', action: 'readings' })
  if (i.uninsured > 0) items.push({ key: 'uninsured', count: i.uninsured, label: 'not on insurance', tone: 'amber' })
  if (i.unassigned > 0) items.push({ key: 'unassigned', count: i.unassigned, label: 'unassigned', tone: 'amber' })
  if (i.oilDueSoon > 0) items.push({ key: 'oil_due_soon', count: i.oilDueSoon, label: 'oil due soon', tone: 'amber' })
  if (i.openTasks > 0) items.push({ key: 'open_tasks', count: i.openTasks, label: `maintenance task${i.openTasks === 1 ? '' : 's'}`, tone: 'amber', action: 'tasks' })
  return items
}
