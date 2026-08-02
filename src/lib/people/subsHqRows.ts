import { subLaborJobBalance } from '../subLaborOutstanding'
import { buildSubComplianceBadges, type ComplianceBadge, type ComplianceDocInput } from './subCompliance'
import type { LaborJob } from '../../types/laborJob'

/**
 * Subs HQ rollup (RUN_SUBS_PLAN Phase 3, PR 3.4) — one row per sub identity,
 * merging the roster (users + people through the account link), sub-sheet
 * balances, open work orders, compliance badges, and a simple track record.
 *
 * Sheet attribution is JUNCTION-FIRST (people_labor_job_assignees), not the
 * delimited name string — this completes identity-plan item C1-7 for this
 * surface. Sheets whose junction resolves to no one (legacy name variants,
 * archived people) or to several people land in the `unattributed` bucket
 * rather than silently inflating or splitting anyone's balance.
 */

export type SubsHqPersonInput = {
  id: string
  name: string
  archived: boolean
  accountUserId: string | null
}

export type SubsHqUserInput = { id: string; name: string | null; email: string | null }

export type SubsHqSheetInput = Pick<LaborJob, 'id' | 'labor_rate' | 'items' | 'payments'> & {
  label: string
  /** Raw `assigned_to_name` text — surfaced on unattributed entries so the panel can show/fix it. */
  assignedToName?: string | null
  /** Job number (HCP) — surfaced on unattributed entries for the #chip + deep link. */
  jobNumber?: string | null
}

export type SubsHqCommitmentInput = {
  person_id: string
  amount: number
  status: string
  stepName: string | null
  projectName: string | null
}

export type SubsHqDocInput = ComplianceDocInput & { person_id: string | null; person_name: string | null }

export type SubsHqRow = {
  personId: string
  name: string
  email: string | null
  hasAccount: boolean
  sheetCount: number
  balanceDue: number
  openCommitments: Array<{ stepName: string | null; projectName: string | null; amount: number; status: string }>
  committedTotal: number
  badges: ComplianceBadge[]
  settledCount: number
  backchargeTotal: number
}

export type UnattributedSheet = {
  sheetId: string
  label: string
  jobNumber: string | null
  balance: number
  reason: 'unmatched' | 'shared'
  /** Raw `assigned_to_name` as written on the sheet ('' when blank). */
  rawAssignedTo: string
}

export type SubsHqResult = {
  rows: SubsHqRow[]
  /** Sheets no single active sub owns (unresolved names, multi-assignee, archived people). */
  unattributed: UnattributedSheet[]
}

const OPEN_COMMITMENT_STATUSES = new Set(['offered', 'accepted', 'approved'])

export function buildSubsHqRows(input: {
  people: SubsHqPersonInput[]
  users: SubsHqUserInput[]
  sheets: SubsHqSheetInput[]
  /** junction rows: sheet → person */
  assignees: Array<{ labor_job_id: string; person_id: string }>
  commitments: SubsHqCommitmentInput[]
  docs: SubsHqDocInput[]
  todayYmd: string
}): SubsHqResult {
  const activePeople = input.people.filter((p) => !p.archived)
  const usersById = new Map(input.users.map((u) => [u.id, u]))
  const peopleById = new Map(activePeople.map((p) => [p.id, p]))

  const assigneesBySheet = new Map<string, string[]>()
  for (const a of input.assignees) {
    ;(assigneesBySheet.get(a.labor_job_id) ?? assigneesBySheet.set(a.labor_job_id, []).get(a.labor_job_id)!).push(a.person_id)
  }

  const rowByPerson = new Map<string, SubsHqRow>()
  const ensureRow = (personId: string): SubsHqRow | null => {
    const person = peopleById.get(personId)
    if (!person) return null
    const existing = rowByPerson.get(personId)
    if (existing) return existing
    const account = person.accountUserId ? usersById.get(person.accountUserId) : undefined
    const row: SubsHqRow = {
      personId,
      name: person.name,
      email: account?.email ?? null,
      hasAccount: !!account,
      sheetCount: 0,
      balanceDue: 0,
      openCommitments: [],
      committedTotal: 0,
      badges: [],
      settledCount: 0,
      backchargeTotal: 0,
    }
    rowByPerson.set(personId, row)
    return row
  }

  // Every active sub gets a row even with no history (so compliance gaps show).
  for (const p of activePeople) ensureRow(p.id)

  const unattributed: SubsHqResult['unattributed'] = []
  for (const sheet of input.sheets) {
    const balance = subLaborJobBalance(sheet)
    const owners = (assigneesBySheet.get(sheet.id) ?? []).filter((pid) => peopleById.has(pid))
    if (owners.length === 1) {
      const row = ensureRow(owners[0]!)
      if (row) {
        row.sheetCount += 1
        row.balanceDue += Math.max(0, balance.balance)
        row.backchargeTotal += balance.backcharges
        continue
      }
    }
    if (balance.balance > 0 || owners.length !== 1) {
      unattributed.push({
        sheetId: sheet.id,
        label: sheet.label,
        jobNumber: sheet.jobNumber ?? null,
        balance: Math.max(0, balance.balance),
        reason: owners.length > 1 ? 'shared' : 'unmatched',
        rawAssignedTo: (sheet.assignedToName ?? '').trim(),
      })
    }
  }

  for (const c of input.commitments) {
    const row = ensureRow(c.person_id)
    if (!row) continue
    if (OPEN_COMMITMENT_STATUSES.has(c.status)) {
      row.openCommitments.push({ stepName: c.stepName, projectName: c.projectName, amount: c.amount, status: c.status })
      row.committedTotal += c.amount
    } else if (c.status === 'settled') {
      row.settledCount += 1
    }
  }

  const docsByPerson = new Map<string, ComplianceDocInput[]>()
  const nameToPersonId = new Map(activePeople.map((p) => [p.name.trim().toLowerCase(), p.id]))
  for (const d of input.docs) {
    const pid = d.person_id ?? (d.person_name ? nameToPersonId.get(d.person_name.trim().toLowerCase()) : undefined)
    if (!pid) continue
    ;(docsByPerson.get(pid) ?? docsByPerson.set(pid, []).get(pid)!).push(d)
  }
  for (const row of rowByPerson.values()) {
    row.badges = buildSubComplianceBadges(docsByPerson.get(row.personId) ?? [], input.todayYmd)
  }

  const rows = [...rowByPerson.values()].sort(
    (a, b) => b.balanceDue - a.balanceDue || b.committedTotal - a.committedTotal || a.name.localeCompare(b.name),
  )
  return { rows, unattributed }
}

export type UnattributedGroup = {
  /** Stable key for React/UI state: label + raw name + reason. */
  key: string
  label: string
  jobNumber: string | null
  rawAssignedTo: string
  reason: 'unmatched' | 'shared'
  /** Sheet ids in the group, highest open balance first. */
  sheetIds: string[]
  sheetCount: number
  totalBalance: number
}

/**
 * Dedupe unattributed sheets into panel rows: one group per distinct
 * (job label, raw assigned name, reason), sheets counted, balances summed,
 * groups sorted by open balance desc (then label for stability).
 */
export function groupUnattributedSheets(entries: UnattributedSheet[]): UnattributedGroup[] {
  const groups = new Map<string, UnattributedGroup & { balances: number[] }>()
  for (const e of entries) {
    const key = `${e.label}\u0000${e.rawAssignedTo.toLowerCase()}\u0000${e.reason}`
    let g = groups.get(key)
    if (!g) {
      g = {
        key,
        label: e.label,
        jobNumber: e.jobNumber,
        rawAssignedTo: e.rawAssignedTo,
        reason: e.reason,
        sheetIds: [],
        sheetCount: 0,
        totalBalance: 0,
        balances: [],
      }
      groups.set(key, g)
    }
    g.sheetIds.push(e.sheetId)
    g.balances.push(e.balance)
    g.sheetCount += 1
    g.totalBalance += e.balance
  }
  return [...groups.values()]
    .map(({ balances, ...g }) => ({
      ...g,
      sheetIds: g.sheetIds
        .map((id, i) => ({ id, balance: balances[i]! }))
        .sort((a, b) => b.balance - a.balance)
        .map((s) => s.id),
    }))
    .sort((a, b) => b.totalBalance - a.totalBalance || a.label.localeCompare(b.label))
}
