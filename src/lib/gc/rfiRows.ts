/**
 * GC mode, the real build, the Building lane's U5b: questions during construction (RFIs) as their rows hold them
 * (`gc_rfis` with its `change_order_id`, and `gc_rfi_holds`; migrations 20261008030000 and 20261010012000), read back as
 * the prototype's `Rfi`, so the kernels in ./buildingRfis.ts read them unchanged. The plan:
 * to-dos/gc-mode/mockups/building-u5.md on branch spike/gc-mode. What a row holds that the prototype never kept (the
 * email that took it to the architect, and who of ours typed it in) rides beside the kernel's shape, by RFI.
 */
import type { Database, Json } from '../../types/database'
import type { GcState, Rfi, RfiImpact } from './types'

export type RfiTableRow = Database['public']['Tables']['gc_rfis']['Row']
export type RfiHoldTableRow = Database['public']['Tables']['gc_rfi_holds']['Row']

/** The two tables' rows for some projects, as `loadGcRfis` reads them. */
export interface RfiTables {
  rfis: RfiTableRow[]
  holds: RfiHoldTableRow[]
}

const IMPACTS: readonly RfiImpact[] = ['none', 'plans', 'cost']
const ANSWERED_BY = ['architect', 'us'] as const

function known<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(`An RFI's ${what} reads "${value}", which the app does not know.`)
}

/** One RFI as the kernels read it: the work it holds, and its answer when it has one. */
export function rfiFromRows(row: RfiTableRow, holds: RfiHoldTableRow[]): Rfi {
  return {
    id: row.id,
    number: row.number,
    question: row.question,
    sheets: row.sheets,
    packageId: row.package_id,
    partnerId: row.asked_by_company_id,
    askedOn: row.asked_on,
    holds: holds
      .filter((h) => h.rfi_id === row.id)
      .map((h) => h.scope_item_id)
      .sort(),
    neededDays: row.needed_days,
    sentToArchitectOn: row.sent_to_architect_on,
    answer:
      row.answered_on === null
        ? null
        : {
            on: row.answered_on,
            text: row.answer_text ?? '',
            by: known(row.answered_by ?? '', ANSWERED_BY, 'answerer'),
            impact: known(row.impact ?? '', IMPACTS, 'impact'),
            cost: Number(row.cost),
            days: row.days,
          },
    changeOrderId: row.change_order_id,
  }
}

/** A project's RFIs in their numbers' order, as the prototype keeps them. */
export function rfisFromRows(projectId: string, tables: RfiTables): Rfi[] {
  return tables.rfis
    .filter((row) => row.project_id === projectId)
    .sort((a, b) => a.number - b.number)
    .map((row) => rfiFromRows(row, tables.holds))
}

/** The board's projects with their RFIs laid over them (`boardProjectFromView` maps the rest). */
export function withRfis(state: GcState, tables: RfiTables): GcState {
  return {
    ...state,
    projects: state.projects.map((project) => ({ ...project, rfis: rfisFromRows(project.id, tables) })),
  }
}

/** What an RFI's row holds beside the kernel's `Rfi`. */
export interface RfiExtra {
  /** The email that took it to the architect. Null: not sent, or sent another way. */
  emailSendLogId: string | null
  /** Who of ours typed it in. Null: the trade's portal. */
  recordedBy: string | null
}

/** Every RFI's email and recorder, by its id. */
export function rfiExtras(tables: RfiTables): Map<string, RfiExtra> {
  return new Map(tables.rfis.map((r) => [r.id, { emailSendLogId: r.email_send_log_id, recordedBy: r.recorded_by }]))
}

/** A new RFI as the window gives it (the prototype's addRfi action). */
export interface RfiDraft {
  projectId: string
  question: string
  sheets: string[]
  /** The trade it is about. Null: our own work. */
  packageId: string | null
  /** The company that asked by phone, the one awarded the trade. Null: our own people. */
  askedByCompanyId: string | null
  /** This job's scope lines it holds until answered. */
  holds: string[]
  neededDays: number
}

/**
 * What `gc_add_rfi` takes: the words trimmed, each sheet and line once, and the days whole. Days that are not a number of
 * none or more are left out, so the database takes RFI_NEEDED_DAYS, as the reducer does.
 */
export function addRfiPayload(draft: RfiDraft): Json {
  return {
    projectId: draft.projectId,
    question: draft.question.trim(),
    sheets: [...new Set(draft.sheets.map((s) => s.trim()).filter(Boolean))],
    packageId: draft.packageId,
    askedByCompanyId: draft.askedByCompanyId,
    holds: [...new Set(draft.holds)],
    ...(Number.isFinite(draft.neededDays) && draft.neededDays >= 0 ? { neededDays: Math.round(draft.neededDays) } : {}),
  }
}

/** An answer as the window gives it (the prototype's answerRfi action). */
export interface RfiAnswer {
  text: string
  by: 'architect' | 'us'
  impact: RfiImpact
  cost: number
  days: number
}

/** What `gc_answer_rfi` takes: a cost answer's cost and days, whole; any other answer, neither. */
export function answerRfiPayload(answer: RfiAnswer): Json {
  const whole = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0))
  return {
    text: answer.text.trim(),
    by: answer.by,
    impact: answer.impact,
    cost: answer.impact === 'cost' ? whole(answer.cost) : 0,
    days: answer.impact === 'cost' ? whole(answer.days) : 0,
  }
}

/**
 * The scope lines a question's sheets point at: the lines whose own sheets name one of them, matched without case
 * or spaces. The ask form ticks them, and the office unticks what does not belong.
 */
export function holdsForSheets(sheets: string[], lineSheets: Record<string, string[] | null | undefined>): string[] {
  const key = (s: string) => s.replace(/\s+/g, '').toUpperCase()
  const asked = new Set(sheets.map(key).filter(Boolean))
  if (asked.size === 0) return []
  return Object.entries(lineSheets)
    .filter(([, own]) => (own ?? []).some((s) => asked.has(key(s))))
    .map(([lineId]) => lineId)
}
