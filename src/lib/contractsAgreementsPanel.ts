import { formatAppliedVersionPlainDate, isoToPlainDateInAppTz } from './personContractAppliedDate'

/**
 * Document-centric aggregation for the Contracts Agreements panel (v2.1407):
 * pivots the tab's caches into one summary per document name — who is
 * assigned it (via template assignment or an ad-hoc copy), who has signed,
 * and per-person compliance (sent / last viewed / signed) for the expanded
 * view. Chase states: 'viewed_not_signed' (opened the signing page but
 * stalled), 'never_opened' (sent but no recorded view — note views only
 * record from 2026-08-05 onward), 'unsent'.
 */

export type AgreementComplianceState = 'signed' | 'viewed_not_signed' | 'never_opened' | 'unsent'

export type AgreementPersonRow = {
  personName: string
  state: AgreementComplianceState
  sentAt: string | null
  lastViewedAt: string | null
  signedAt: string | null
}

export type AgreementSummary = {
  documentName: string
  templateNames: string[]
  assignedCount: number
  signedCount: number
  rows: AgreementPersonRow[]
}

type PersonDocInput = {
  person_name: string
  document_name: string
  status: string
  lineage_version: number
  sent_at: string | null
  signer_last_viewed_at: string | null
  signed_at: string | null
}

const STATE_ORDER: Record<AgreementComplianceState, number> = {
  viewed_not_signed: 0,
  never_opened: 1,
  unsent: 2,
  signed: 3,
}

function statusPriority(status: string): number {
  return status === 'signed' ? 2 : status === 'sent' ? 1 : 0
}

/** The person's authoritative row for a document: best status wins, then the newest lineage version. */
export function bestPersonDocRow<T extends PersonDocInput>(rows: readonly T[]): T | null {
  let best: T | null = null
  for (const row of rows) {
    if (
      best == null ||
      statusPriority(row.status) > statusPriority(best.status) ||
      (statusPriority(row.status) === statusPriority(best.status) && row.lineage_version > best.lineage_version)
    ) {
      best = row
    }
  }
  return best
}

export function agreementComplianceState(row: PersonDocInput | null): AgreementComplianceState {
  if (!row) return 'unsent'
  if (row.status === 'signed') return 'signed'
  if (row.status === 'sent') return row.signer_last_viewed_at ? 'viewed_not_signed' : 'never_opened'
  return 'unsent'
}

export function buildAgreementSummaries(input: {
  templates: ReadonlyArray<{ id: string; name: string }>
  templateDocuments: ReadonlyArray<{ template_id: string; document_name: string }>
  assignments: ReadonlyArray<{ person_name: string; template_id: string }>
  personDocuments: ReadonlyArray<PersonDocInput>
}): AgreementSummary[] {
  const templateNameById = new Map(input.templates.map((t) => [t.id, t.name]))

  const templatesByDoc = new Map<string, Set<string>>()
  for (const td of input.templateDocuments) {
    const set = templatesByDoc.get(td.document_name) ?? new Set<string>()
    set.add(td.template_id)
    templatesByDoc.set(td.document_name, set)
  }

  const assigneesByTemplate = new Map<string, Set<string>>()
  for (const a of input.assignments) {
    const set = assigneesByTemplate.get(a.template_id) ?? new Set<string>()
    set.add(a.person_name)
    assigneesByTemplate.set(a.template_id, set)
  }

  const personDocsByDoc = new Map<string, Map<string, PersonDocInput[]>>()
  const docNames = new Set<string>(templatesByDoc.keys())
  for (const pd of input.personDocuments) {
    docNames.add(pd.document_name)
    const byPerson = personDocsByDoc.get(pd.document_name) ?? new Map<string, PersonDocInput[]>()
    const list = byPerson.get(pd.person_name) ?? []
    list.push(pd)
    byPerson.set(pd.person_name, list)
    personDocsByDoc.set(pd.document_name, byPerson)
  }

  const summaries: AgreementSummary[] = []
  for (const documentName of docNames) {
    const templateIds = [...(templatesByDoc.get(documentName) ?? [])]
    const assigned = new Set<string>()
    for (const tid of templateIds) {
      for (const person of assigneesByTemplate.get(tid) ?? []) assigned.add(person)
    }
    const byPerson = personDocsByDoc.get(documentName) ?? new Map<string, PersonDocInput[]>()
    for (const person of byPerson.keys()) assigned.add(person)

    const rows: AgreementPersonRow[] = [...assigned].map((personName) => {
      const best = bestPersonDocRow(byPerson.get(personName) ?? [])
      return {
        personName,
        state: agreementComplianceState(best),
        sentAt: best?.sent_at ?? null,
        lastViewedAt: best?.signer_last_viewed_at ?? null,
        signedAt: best?.signed_at ?? null,
      }
    })
    rows.sort(
      (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.personName.localeCompare(b.personName),
    )

    summaries.push({
      documentName,
      templateNames: templateIds.map((tid) => templateNameById.get(tid) ?? tid).sort(),
      assignedCount: rows.length,
      signedCount: rows.filter((r) => r.state === 'signed').length,
      rows,
    })
  }

  // Incomplete agreements first (lowest signed share first), fully signed last; alphabetical within.
  summaries.sort((a, b) => {
    const aDone = a.assignedCount > 0 && a.signedCount === a.assignedCount
    const bDone = b.assignedCount > 0 && b.signedCount === b.assignedCount
    if (aDone !== bDone) return aDone ? 1 : -1
    const aPct = a.assignedCount > 0 ? a.signedCount / a.assignedCount : 0
    const bPct = b.assignedCount > 0 ? b.signedCount / b.assignedCount : 0
    return aPct - bPct || a.documentName.localeCompare(b.documentName)
  })
  return summaries
}

/** Short date for the compliance table: 'Jul 12' this year, 'Jul 12, 2025' otherwise; handles plain dates and timestamps. */
export function formatAgreementShortDate(value: string | null | undefined, todayYear: number = new Date().getFullYear()): string | null {
  if (!value) return null
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : isoToPlainDateInAppTz(value)
  const label = formatAppliedVersionPlainDate(plain)
  if (!label) return null
  const year = Number(plain!.slice(0, 4))
  return year === todayYear ? label.replace(`, ${year}`, '') : label
}
