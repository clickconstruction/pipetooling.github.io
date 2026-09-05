import { subLaborJobBalance } from '../subLaborOutstanding'
import { buildSubComplianceBadges, type ComplianceBadge, type ComplianceDocInput } from './subCompliance'
import { generalConditionsStanding, type GeneralConditionsStanding } from '../subWorkOrders/subWorkOrder'
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
  /** v2.2842: the sheet's job date (YYYY-MM-DD) — feeds the sub's "last worked". */
  jobDateYmd?: string | null
  /** v2.2842: when the sheet was paid (YYYY-MM-DD) — also counts as work. */
  paidAtYmd?: string | null
}

export type SubsHqCommitmentInput = {
  person_id: string
  amount: number
  status: string
  stepName: string | null
  projectName: string | null
  /** v2.2790: sheet work orders (no step) name their sheet instead. */
  sheetLabel?: string | null
  /** v2.2842: when the sub accepted the offer (YYYY-MM-DD) — counts as work. */
  acceptedAtYmd?: string | null
}

export type SubsHqDocInput = ComplianceDocInput & {
  person_id: string | null
  person_name: string | null
  /** v2.2790: which Contract Book entry + version this copy applied (General Conditions standing). */
  applied_contract_template_document_id?: string | null
  applied_version_date?: string | null
  document_name?: string | null
}

/** The Contract Book's General Conditions for subs, when one exists (audience = 'sub'). */
export type SubsHqGeneralConditionsInput = { documentId: string; documentName: string; bookVersionDate: string | null }

export type SubsHqRow = {
  personId: string
  name: string
  email: string | null
  hasAccount: boolean
  sheetCount: number
  balanceDue: number
  openCommitments: Array<{ stepName: string | null; projectName: string | null; sheetLabel: string | null; amount: number; status: string }>
  committedTotal: number
  badges: ComplianceBadge[]
  /** v2.2790: where they stand against the Book's General Conditions; 'none' when the Book has no such document. */
  generalConditions: GeneralConditionsStanding
  settledCount: number
  backchargeTotal: number
  /** v2.2842: newest attributed sheet job date / paid date / accepted work order (YYYY-MM-DD); null = never. */
  lastWorkedYmd: string | null
}

export type UnattributedSheet = {
  sheetId: string
  label: string
  jobNumber: string | null
  balance: number
  /** 'archived' = the sheet's person exists on the roster but is archived — historical, not broken. */
  reason: 'unmatched' | 'shared' | 'archived'
  /** Raw `assigned_to_name` as written on the sheet ('' when blank). */
  rawAssignedTo: string
  /** Set when reason === 'archived': the archived person's roster name. */
  archivedPersonName: string | null
}

export type SubsHqResult = {
  rows: SubsHqRow[]
  /** Sheets no single active sub owns (unresolved names, multi-assignee, archived people). */
  unattributed: UnattributedSheet[]
}

const OPEN_COMMITMENT_STATUSES = new Set(['offered', 'accepted', 'approved'])

/** Keep the newest well-formed YYYY-MM-DD on the row. */
function bumpLastWorked(row: SubsHqRow, ...candidates: Array<string | null | undefined>): void {
  for (const c of candidates) {
    const ymd = (c ?? '').trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
    if (!row.lastWorkedYmd || ymd > row.lastWorkedYmd) row.lastWorkedYmd = ymd
  }
}

export function buildSubsHqRows(input: {
  people: SubsHqPersonInput[]
  users: SubsHqUserInput[]
  sheets: SubsHqSheetInput[]
  /** junction rows: sheet → person */
  assignees: Array<{ labor_job_id: string; person_id: string }>
  commitments: SubsHqCommitmentInput[]
  docs: SubsHqDocInput[]
  todayYmd: string
  generalConditions?: SubsHqGeneralConditionsInput | null
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
      generalConditions: 'none',
      settledCount: 0,
      backchargeTotal: 0,
      lastWorkedYmd: null,
    }
    rowByPerson.set(personId, row)
    return row
  }

  // Every active sub gets a row even with no history (so compliance gaps show).
  for (const p of activePeople) ensureRow(p.id)

  // Archived-person detection: junction owner who is archived, or a raw name
  // that uniquely matches an archived person. Historical sheets, not errors.
  const allPeopleById = new Map(input.people.map((p) => [p.id, p]))
  const archivedByNormName = new Map<string, SubsHqPersonInput | null>()
  for (const p of input.people) {
    if (!p.archived) continue
    const k = p.name.trim().toLowerCase()
    archivedByNormName.set(k, archivedByNormName.has(k) ? null : p) // null = ambiguous
  }

  const unattributed: SubsHqResult['unattributed'] = []
  for (const sheet of input.sheets) {
    const balance = subLaborJobBalance(sheet)
    const junctionOwners = assigneesBySheet.get(sheet.id) ?? []
    const owners = junctionOwners.filter((pid) => peopleById.has(pid))
    if (owners.length === 1) {
      const row = ensureRow(owners[0]!)
      if (row) {
        row.sheetCount += 1
        row.balanceDue += Math.max(0, balance.balance)
        row.backchargeTotal += balance.backcharges
        bumpLastWorked(row, sheet.jobDateYmd, sheet.paidAtYmd)
        continue
      }
    }
    if (balance.balance > 0 || owners.length !== 1) {
      const rawAssignedTo = (sheet.assignedToName ?? '').trim()
      let reason: UnattributedSheet['reason'] = owners.length > 1 ? 'shared' : 'unmatched'
      let archivedPersonName: string | null = null
      if (reason === 'unmatched') {
        const junctionArchived =
          junctionOwners.length === 1 ? allPeopleById.get(junctionOwners[0]!) : undefined
        const nameArchived = rawAssignedTo ? archivedByNormName.get(rawAssignedTo.toLowerCase()) : undefined
        const archivedMatch = junctionArchived?.archived ? junctionArchived : nameArchived || null
        if (archivedMatch) {
          reason = 'archived'
          archivedPersonName = archivedMatch.name
        }
      }
      unattributed.push({
        sheetId: sheet.id,
        label: sheet.label,
        jobNumber: sheet.jobNumber ?? null,
        balance: Math.max(0, balance.balance),
        reason,
        rawAssignedTo,
        archivedPersonName,
      })
    }
  }

  for (const c of input.commitments) {
    const row = ensureRow(c.person_id)
    if (!row) continue
    bumpLastWorked(row, c.acceptedAtYmd)
    if (OPEN_COMMITMENT_STATUSES.has(c.status)) {
      row.openCommitments.push({ stepName: c.stepName, projectName: c.projectName, sheetLabel: c.sheetLabel ?? null, amount: c.amount, status: c.status })
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
  const gc = input.generalConditions ?? null
  for (const row of rowByPerson.values()) {
    const docs = docsByPerson.get(row.personId) ?? []
    row.badges = buildSubComplianceBadges(docs, input.todayYmd)
    if (gc) {
      // Best signed copy of the General Conditions: by applied Book entry first, then by name.
      const signedCopies = (docs as SubsHqDocInput[]).filter(
        (d) =>
          d.status === 'signed' &&
          (d.applied_contract_template_document_id === gc.documentId ||
            (d.document_name ?? '').trim().toLowerCase() === gc.documentName.trim().toLowerCase()),
      )
      const sortedVersions = signedCopies.map((d) => d.applied_version_date ?? '').sort()
      const bestVersion = sortedVersions[sortedVersions.length - 1] || null
      row.generalConditions = generalConditionsStanding({ bookVersionDate: gc.bookVersionDate, signedVersionDate: bestVersion, signed: signedCopies.length > 0 })
    }
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
  reason: 'unmatched' | 'shared' | 'archived'
  archivedPersonName: string | null
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
        archivedPersonName: e.archivedPersonName,
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
