/**
 * GC mode, the real build, the Building lane's U4b: the submittal register as its rows hold it (`gc_submittals`,
 * `gc_submittal_holds`, `gc_submittal_rounds`, migration 20261008030000), read back as the prototype's
 * `Submittal`, so the kernels in ./buildingSubmittals.ts read it unchanged. The plan: to-dos/gc-mode/mockups/building-u4.md
 * on branch spike/gc-mode. What a round holds that the prototype never kept (its Drive link, who sent it, the email
 * that took it to the architect) rides beside the kernel's shape, by submittal and round.
 */
import type { Database, Json } from '../../types/database'
import type { GcState, Submittal, SubmittalAnswer, SubmittalKind, SubmittalRound } from './types'

export type SubmittalTableRow = Database['public']['Tables']['gc_submittals']['Row']
export type SubmittalHoldTableRow = Database['public']['Tables']['gc_submittal_holds']['Row']
export type SubmittalRoundTableRow = Database['public']['Tables']['gc_submittal_rounds']['Row']

/** The three tables' rows for some projects, as `loadGcSubmittals` reads them. */
export interface SubmittalTables {
  submittals: SubmittalTableRow[]
  holds: SubmittalHoldTableRow[]
  rounds: SubmittalRoundTableRow[]
}

export const SUBMITTAL_KINDS: readonly SubmittalKind[] = ['product data', 'shop drawings', 'samples']
export const SUBMITTAL_ANSWERS: readonly SubmittalAnswer[] = ['approved', 'approved as noted', 'revise']

function known<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(`A submittal's ${what} reads "${value}", which the app does not know.`)
}

function roundFromRow(row: SubmittalRoundTableRow): SubmittalRound {
  return {
    sentOn: row.sent_on,
    file: row.file_name,
    note: row.note,
    toArchitectOn: row.to_architect_on,
    answeredOn: row.answered_on,
    answer: row.answer === null ? null : known(row.answer, SUBMITTAL_ANSWERS, 'answer'),
    answerNote: row.answer_note,
  }
}

/** One submittal as the kernels read it: the work it holds, and its rounds from the first. */
export function submittalFromRows(row: SubmittalTableRow, holds: SubmittalHoldTableRow[], rounds: SubmittalRoundTableRow[]): Submittal {
  return {
    id: row.id,
    number: row.number,
    packageId: row.package_id,
    title: row.title,
    kind: known(row.kind, SUBMITTAL_KINDS, 'kind'),
    ...(row.spec_section ? { specSection: row.spec_section } : {}),
    lineIds: holds
      .filter((h) => h.submittal_id === row.id)
      .map((h) => h.scope_item_id)
      .sort(),
    leadDays: row.lead_days,
    ...(row.needed_by ? { neededBy: row.needed_by } : {}),
    askedOn: row.asked_on,
    rounds: rounds
      .filter((r) => r.submittal_id === row.id)
      .sort((a, b) => a.round - b.round)
      .map(roundFromRow),
  }
}

/** A project's register in the order it was added, as the prototype keeps it. */
export function submittalsFromRows(projectId: string, tables: SubmittalTables): Submittal[] {
  return tables.submittals
    .filter((row) => row.project_id === projectId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.number.localeCompare(b.number))
    .map((row) => submittalFromRows(row, tables.holds, tables.rounds))
}

/** The board's projects with their submittals laid over them (`boardProjectFromView` maps the rest). */
export function withSubmittals(state: GcState, tables: SubmittalTables): GcState {
  return {
    ...state,
    projects: state.projects.map((project) => ({ ...project, submittals: submittalsFromRows(project.id, tables) })),
  }
}

/** What a round holds beside the kernel's `SubmittalRound`. */
export interface SubmittalRoundExtra {
  driveUrl: string | null
  /** From its portal, or by email and recorded by the office (decision 6). */
  sentBy: 'trade' | 'office'
  /** The email that took it to the architect. Null: not sent, or sent another way. */
  emailSendLogId: string | null
}

/** A round's key: the submittal and the round's number, 1 for the first. */
export function submittalRoundKey(submittalId: string, round: number): string {
  return `${submittalId}#${round}`
}

/** Every round's Drive link, sender and email, by `submittalRoundKey`. */
export function submittalRoundExtras(tables: SubmittalTables): Map<string, SubmittalRoundExtra> {
  return new Map(
    tables.rounds.map((r) => [
      submittalRoundKey(r.submittal_id, r.round),
      { driveUrl: r.drive_url, sentBy: known(r.sent_by, ['trade', 'office'] as const, 'sender'), emailSendLogId: r.email_send_log_id },
    ]),
  )
}

/** A new submittal as the window gives it (the prototype's addSubmittal action). */
export interface SubmittalDraft {
  packageId: string
  title: string
  kind: SubmittalKind
  specSection?: string
  /** The trade's scope lines it holds until approved. */
  lineIds: string[]
  /** Days from approval to the material on site. */
  leadDays: number
  /** Only when none of the work it holds is on the schedule. */
  neededBy?: string
}

/** What `gc_add_submittal` takes: the words trimmed, each line once, the days whole and never below none. */
export function addSubmittalPayload(draft: SubmittalDraft): Json {
  const section = draft.specSection?.trim()
  const neededBy = draft.neededBy?.trim()
  return {
    packageId: draft.packageId,
    title: draft.title.trim(),
    kind: draft.kind,
    ...(section ? { specSection: section } : {}),
    lineIds: [...new Set(draft.lineIds)],
    leadDays: Math.max(0, Math.round(Number.isFinite(draft.leadDays) ? draft.leadDays : 0)),
    ...(neededBy ? { neededBy } : {}),
  }
}

/** A round that came by email, as the office records it (decision 6). */
export interface SubmittalCameIn {
  submittalId: string
  file: string
  driveUrl?: string
  note?: string
}

/** What `gc_submittal_came_in` takes. */
export function cameInPayload(cameIn: SubmittalCameIn): Json {
  const link = cameIn.driveUrl?.trim()
  return {
    submittalId: cameIn.submittalId,
    file: cameIn.file.trim(),
    ...(link ? { driveUrl: link } : {}),
    note: (cameIn.note ?? '').trim(),
  }
}

/**
 * The spec sections a trade's own scope lines name, for the section box's suggestions: each once, in the order
 * the lines give them.
 */
export function tradeSpecSections(scope: { specs?: string[] | null }[]): string[] {
  return [...new Set(scope.flatMap((line) => (line.specs ?? []).map((s) => s.trim()).filter(Boolean)))]
}
