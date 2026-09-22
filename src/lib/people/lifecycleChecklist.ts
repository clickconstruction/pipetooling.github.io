/**
 * Person Desk lifecycle checklists (PR 2): End employment and Start
 * employment as lists of open items that the flow refuses to finish past.
 *
 * Pure: the Desk loads the facts (personDeskFacts.ts), this turns them into
 * rows with a state and the one action each row offers; the modal renders
 * rows and runs the actions through the same writes the sections use. An
 * item can be resolved (done), not applicable (skipped), or deliberately
 * left open with a reason — only 'open' blocks the finish button.
 */

export type LifecycleItemKind =
  | 'open_session'
  | 'pending_sessions'
  | 'final_pay_report'
  | 'salary_schedule'
  | 'sub_balance'
  | 'portal_on'
  | 'vehicle_held'
  | 'housing_occupied'
  | 'open_work_orders'
  | 'paperwork'
  | 'employment_start'
  | 'pay_setup'
  | 'assign_packet'
  | 'hand_off_vehicle'
  | 'assign_housing'

export type LifecycleItemState = 'open' | 'done' | 'skipped' | 'left_open'

export type LifecycleAction =
  | { kind: 'open_approvals' }
  | { kind: 'force_clock_out' }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'revoke_portal' }
  | { kind: 'park_vehicle'; possessionId: string; vehicleId: string }
  | { kind: 'end_housing'; possessionId: string }
  | { kind: 'set_start_date' }
  | { kind: 'set_wage' }
  /** Leave (v2.3700): generate the final pay report through the end date, here. */
  | { kind: 'generate_pay_report' }
  /** Leave (v2.3700): drop the workday template and flip the pay row to hourly. */
  | { kind: 'clear_salary' }

export type LifecycleItem = {
  /** Stable id: kind plus the row it is about, so per-row resolution survives a refetch. */
  id: string
  kind: LifecycleItemKind
  label: string
  detail: string
  state: LifecycleItemState
  action: LifecycleAction | null
  /** Whether "Leave open" is offered — never for things that would silently keep paying or exposing. */
  canLeaveOpen: boolean
  leaveReason?: string
  /** The action waits for this item (by id) to leave the open state — order matters for pay. */
  blockedBy?: string
}

export type EndEmploymentFacts = {
  endDateYmd: string
  isSub: boolean
  hasPayConfig: boolean
  /** Leave (v2.3700): the pay row's shape decides whether a report is worth generating and whether a template must go. */
  isSalary: boolean
  hourlyWage: number | null
  openSession: boolean
  pendingSessions: { count: number; hours: number }
  /** period_end of the newest pay report, or null when none. */
  lastPayReportEnd: string | null
  /** Sub sheets: open balance and unsettled backcharges; null when not a sub or unreadable. */
  subBalance: { balance: number; backcharges: number; sheets: number } | null
  /** null = no roster row (no portal possible). */
  portalOn: boolean | null
  vehiclesHeld: Array<{ possessionId: string; vehicleId: string; label: string; since: string }>
  housing: Array<{ possessionId: string; label: string; since: string }>
  workOrders: { offered: number; accepted: number }
  /** Compliance labels still missing (subs), e.g. ["COI missing", "W-9 missing"]. */
  missingDocs: string[]
}

export type StartEmploymentFacts = {
  hasRosterRow: boolean
  startDate: string | null
  hasPayConfig: boolean
  /** true when the pay row has a wage or is salaried. */
  payConfigured: boolean
  /** Packet or any document assigned. */
  paperworkAssigned: boolean
  vehiclesHeld: number
  housing: number
  hasLogin: boolean
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function hoursShort(h: number): string {
  const r = Math.round(h * 10) / 10
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}h`
}

export function buildEndEmploymentChecklist(f: EndEmploymentFacts): LifecycleItem[] {
  const items: LifecycleItem[] = []

  items.push({
    id: 'open_session',
    kind: 'open_session',
    label: 'On the clock',
    detail: f.openSession ? 'Still clocked in — close the session first' : 'Not clocked in',
    state: f.openSession ? 'open' : 'skipped',
    action: f.openSession ? { kind: 'force_clock_out' } : null,
    canLeaveOpen: false,
  })

  items.push({
    id: 'pending_sessions',
    kind: 'pending_sessions',
    label: 'Pending sessions',
    detail:
      f.pendingSessions.count > 0
        ? `${f.pendingSessions.count} session${f.pendingSessions.count === 1 ? '' : 's'} · ${hoursShort(f.pendingSessions.hours)} not yet in payroll`
        : 'Nothing waiting',
    state: f.pendingSessions.count > 0 ? 'open' : 'done',
    action: f.pendingSessions.count > 0 ? { kind: 'open_approvals' } : null,
    canLeaveOpen: false,
  })

  if (f.hasPayConfig) {
    const covered = f.lastPayReportEnd != null && f.lastPayReportEnd >= f.endDateYmd
    const paid = f.isSalary || (f.hourlyWage ?? 0) > 0
    items.push({
      id: 'final_pay_report',
      kind: 'final_pay_report',
      label: 'Final pay report',
      detail: covered
        ? `Covered through ${f.lastPayReportEnd}`
        : !paid
          ? 'No wage on file and not salaried — nothing to pay'
          : f.lastPayReportEnd
            ? `Last report ended ${f.lastPayReportEnd} — one more covers through ${f.endDateYmd}`
            : `No pay report yet — one covers through ${f.endDateYmd}`,
      state: covered ? 'done' : !paid ? 'skipped' : 'open',
      // Leave (v2.3700): generated here, from the day after the last report (or the period start) through the end date.
      action: covered || !paid ? null : { kind: 'generate_pay_report' },
      canLeaveOpen: true,
    })
    // A salaried person who leaves stops being salaried — after the final report, which needs the
    // credit for the days it covers. Never left open: a surviving template keeps minting paid days.
    items.push({
      id: 'salary_schedule',
      kind: 'salary_schedule',
      label: 'Salary',
      detail: f.isSalary ? 'Salaried — the workday template goes and the pay row turns hourly, after the final report' : 'Hourly',
      state: f.isSalary ? 'open' : 'skipped',
      action: f.isSalary ? { kind: 'clear_salary' } : null,
      canLeaveOpen: false,
      blockedBy: f.isSalary && !covered && paid ? 'final_pay_report' : undefined,
    })
  }

  if (f.isSub && f.subBalance) {
    const owed = f.subBalance.balance !== 0 || f.subBalance.backcharges !== 0
    items.push({
      id: 'sub_balance',
      kind: 'sub_balance',
      label: 'Sub balance',
      detail: owed
        ? `${money(f.subBalance.balance)} open${f.subBalance.backcharges > 0 ? ` · ${money(f.subBalance.backcharges)} in backcharges` : ''} across ${f.subBalance.sheets} sheet${f.subBalance.sheets === 1 ? '' : 's'}`
        : `Settled · ${f.subBalance.sheets} sheet${f.subBalance.sheets === 1 ? '' : 's'}`,
      state: owed ? 'open' : 'done',
      action: owed ? { kind: 'link', href: '/jobs?tab=subs&view=pay', label: 'Sheets' } : null,
      canLeaveOpen: true,
    })
  }

  if (f.isSub && f.portalOn != null) {
    items.push({
      id: 'portal_on',
      kind: 'portal_on',
      label: 'Portal',
      detail: f.portalOn ? 'Their page is still live — turn it off so the link stops working' : 'Off',
      state: f.portalOn ? 'open' : 'done',
      action: f.portalOn ? { kind: 'revoke_portal' } : null,
      canLeaveOpen: false,
    })
  }

  for (const v of f.vehiclesHeld) {
    items.push({
      id: `vehicle:${v.possessionId}`,
      kind: 'vehicle_held',
      label: 'Vehicle',
      detail: `${v.label} · held since ${v.since}`,
      state: 'open',
      action: { kind: 'park_vehicle', possessionId: v.possessionId, vehicleId: v.vehicleId },
      canLeaveOpen: true,
    })
  }
  if (f.vehiclesHeld.length === 0) {
    items.push({ id: 'vehicle:none', kind: 'vehicle_held', label: 'Vehicle', detail: 'None held', state: 'skipped', action: null, canLeaveOpen: false })
  }

  for (const h of f.housing) {
    items.push({
      id: `housing:${h.possessionId}`,
      kind: 'housing_occupied',
      label: 'Housing',
      detail: `${h.label} · since ${h.since}`,
      state: 'open',
      action: { kind: 'end_housing', possessionId: h.possessionId },
      canLeaveOpen: true,
    })
  }
  if (f.housing.length === 0) {
    items.push({ id: 'housing:none', kind: 'housing_occupied', label: 'Housing', detail: 'None', state: 'skipped', action: null, canLeaveOpen: false })
  }

  const wo = f.workOrders.offered + f.workOrders.accepted
  if (f.isSub) {
    items.push({
      id: 'open_work_orders',
      kind: 'open_work_orders',
      label: 'Work orders',
      detail: wo > 0 ? `${f.workOrders.offered} offered · ${f.workOrders.accepted} accepted, not settled` : 'None open',
      state: wo > 0 ? 'open' : 'skipped',
      action: wo > 0 ? { kind: 'link', href: '/projects', label: 'Projects' } : null,
      canLeaveOpen: true,
    })
    items.push({
      id: 'paperwork',
      kind: 'paperwork',
      label: 'Paperwork',
      detail: f.missingDocs.length > 0 ? `${f.missingDocs.join(' · ')} — never received` : 'Complete',
      state: f.missingDocs.length > 0 ? 'open' : 'done',
      action: null,
      canLeaveOpen: true,
    })
  }

  return items
}

export function buildStartEmploymentChecklist(f: StartEmploymentFacts): LifecycleItem[] {
  const items: LifecycleItem[] = []
  items.push({
    id: 'employment_start',
    kind: 'employment_start',
    label: 'Start date',
    detail: f.startDate ? `Starts ${f.startDate}` : f.hasRosterRow ? 'Not set' : 'Needs a roster row first (create it from the header)',
    state: f.startDate ? 'done' : 'open',
    action: f.startDate || !f.hasRosterRow ? null : { kind: 'set_start_date' },
    canLeaveOpen: false,
  })
  items.push({
    id: 'pay_setup',
    kind: 'pay_setup',
    label: 'Pay',
    detail: f.payConfigured ? 'Wage or salary on file' : f.hasPayConfig ? 'Pay row exists but no wage and not salaried' : 'No pay setup',
    state: f.payConfigured ? 'done' : 'open',
    action: f.payConfigured ? null : { kind: 'set_wage' },
    canLeaveOpen: true,
  })
  items.push({
    id: 'assign_packet',
    kind: 'assign_packet',
    label: 'Paperwork',
    detail: f.paperworkAssigned ? 'Packet assigned' : 'No packet or document assigned yet',
    state: f.paperworkAssigned ? 'done' : 'open',
    action: f.paperworkAssigned ? null : { kind: 'link', href: '/people?tab=contracts', label: 'Assign on Contracts' },
    canLeaveOpen: true,
  })
  items.push({
    id: 'hand_off_vehicle',
    kind: 'hand_off_vehicle',
    label: 'Vehicle',
    detail: f.vehiclesHeld > 0 ? `${f.vehiclesHeld} held` : 'None — optional',
    state: f.vehiclesHeld > 0 ? 'done' : 'skipped',
    action: f.vehiclesHeld > 0 ? null : { kind: 'link', href: '/people?tab=vehicles', label: 'Hand off…' },
    canLeaveOpen: false,
  })
  items.push({
    id: 'assign_housing',
    kind: 'assign_housing',
    label: 'Housing',
    detail: f.housing > 0 ? 'Assigned' : 'None — optional',
    state: f.housing > 0 ? 'done' : 'skipped',
    action: f.housing > 0 ? null : { kind: 'link', href: '/people?tab=housing', label: 'Assign…' },
    canLeaveOpen: false,
  })
  return items
}

/** Apply per-row resolutions (done after an action, or left open with a reason) on top of freshly built items. */
export function applyChecklistResolutions(
  items: LifecycleItem[],
  resolutions: Record<string, { state: 'done' | 'left_open'; reason?: string }>,
): LifecycleItem[] {
  return items.map((it) => {
    const r = resolutions[it.id]
    if (!r || it.state !== 'open') return it
    return { ...it, state: r.state, leaveReason: r.reason, action: r.state === 'done' ? null : it.action }
  })
}

/** The id of the still-open item this one waits for, or null when its action may run now. */
export function checklistItemBlocker(items: readonly LifecycleItem[], item: LifecycleItem): string | null {
  if (!item.blockedBy) return null
  const dep = items.find((i) => i.id === item.blockedBy)
  return dep && dep.state === 'open' ? dep.id : null
}

/**
 * Leave (v2.3700): the period the final pay report covers — the day after the last report
 * (or the end date's Sunday when there is none), through the end date.
 */
export function finalPayReportPeriod(lastPayReportEnd: string | null, endDateYmd: string): { periodStart: string; periodEnd: string } {
  if (lastPayReportEnd && lastPayReportEnd < endDateYmd) {
    const d = new Date(lastPayReportEnd + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    return { periodStart: d.toISOString().slice(0, 10), periodEnd: endDateYmd }
  }
  const e = new Date(endDateYmd + 'T12:00:00')
  e.setDate(e.getDate() - e.getDay())
  return { periodStart: e.toISOString().slice(0, 10), periodEnd: endDateYmd }
}

export function checklistSummary(items: LifecycleItem[]): { open: number; done: number; leftOpen: number; skipped: number; canFinish: boolean } {
  let open = 0
  let done = 0
  let leftOpen = 0
  let skipped = 0
  for (const it of items) {
    if (it.state === 'open') open += 1
    else if (it.state === 'done') done += 1
    else if (it.state === 'left_open') leftOpen += 1
    else skipped += 1
  }
  return { open, done, leftOpen, skipped, canFinish: open === 0 }
}

/** The one dated, factual HR-file line End employment appends (dev only; append-only table). */
export function endEmploymentHrLine(displayName: string, endDateYmd: string, items: LifecycleItem[]): string {
  const done = items.filter((i) => i.state === 'done').map((i) => i.label.toLowerCase())
  const left = items.filter((i) => i.state === 'left_open').map((i) => `${i.label.toLowerCase()}${i.leaveReason ? ` (${i.leaveReason})` : ''}`)
  const parts = [`Employment ended ${endDateYmd} for ${displayName}.`]
  if (done.length > 0) parts.push(`Closed out: ${done.join(', ')}.`)
  if (left.length > 0) parts.push(`Left open on purpose: ${left.join(', ')}.`)
  return parts.join(' ')
}
