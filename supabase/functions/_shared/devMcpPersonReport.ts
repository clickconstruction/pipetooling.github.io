// dev-mcp's plan_person_report / apply_person_report: file or dismiss a waiting field report (person_reports, the
// queue at the top of People → HR and the waiting line on a person's Timeline — docs/HR_FILES.md → Pending reports)
// through the queue's own RPCs, file_person_report / dismiss_person_report (migration 20260824170000, gated
// is_dev() OR hr_agent), behind the seat's plan → apply grammar. No new RPC and no dry-run wrapper: the dry run is the
// server's own read of the report as the dev, and the plan hash commits to the report as it stands — its status, its
// words, the person — so a report filed or dismissed since the plan refuses the apply; the RPCs are idempotent
// besides. Pure: no network, no env. Tests: src/lib/devMcp/devMcpPersonReport.test.ts.

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PERSON_REPORT_ACTIONS = ['file', 'dismiss'] as const
export type PersonReportAction = (typeof PERSON_REPORT_ACTIONS)[number]
/** The HR file's entry sources (docs/HR_FILES.md → Raw entries); a filed report is `report` unless the agent says otherwise. */
export const PERSON_REPORT_ENTRY_SOURCES = ['conversation', 'payroll_event', 'incident', 'review', 'milestone', 'job_event', 'report'] as const
export const PERSON_REPORT_CONTENT_MAX = 20000
export const PERSON_REPORT_REASON_MAX = 2000

export const PERSON_REPORT_VERBS = ['plan_person_report', 'apply_person_report'] as const
export type PersonReportVerb = (typeof PERSON_REPORT_VERBS)[number]
export function isPersonReportVerb(verb: string): verb is PersonReportVerb {
  return (PERSON_REPORT_VERBS as readonly string[]).includes(verb)
}

/** What a report verb carries, after the shape check. */
export type PersonReportPayload = { action: PersonReportAction; report_id: string; content?: string; source?: string; reason?: string }

/** The columns the server reads from person_reports for the dry run. */
export const PERSON_REPORT_SELECT = 'id,status,subject_person_id,occurred_date,created_at,author_name,content,resolution_note,resolved_at,filed_entry_id'
export type PersonReportRow = {
  id: string
  status: string
  subject_person_id: string
  occurred_date: string
  created_at: string
  author_name: string
  content: string
  resolution_note: string | null
  resolved_at: string | null
  filed_entry_id: string | null
}

export type PersonReportInput = { ok: true; p: PersonReportPayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a file carries its tightened words and source when given; a dismissal needs its reason. */
export function personReportInput(verb: PersonReportVerb, input: Json): PersonReportInput {
  const report = obj(input.report)
  const shape = `${verb} needs report — { report_id (a person_reports.id: read_rows on person_reports with status eq pending lists the queue, and get_person_file shows a person's waiting reports), action: file | dismiss; file: content? (the entry's words when you tighten them — keep the author's facts; left out, the RPC writes "Field report from <author> (submitted <day>): <their words>"), source? (${PERSON_REPORT_ENTRY_SOURCES.join(' | ')}; report when left out); dismiss: reason (required, under ${PERSON_REPORT_REASON_MAX} characters, kept on the report) }.`
  if (!report) return { ok: false, error: shape }
  const str = (k: string) => (typeof report[k] === 'string' ? (report[k] as string).trim() : '')
  const reportId = str('report_id').toLowerCase()
  const action = str('action')
  if (!UUID_RE.test(reportId) || !(PERSON_REPORT_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: shape }
  const p: PersonReportPayload = { action: action as PersonReportAction, report_id: reportId }
  if (action === 'file') {
    const content = str('content')
    if (content) {
      if (content.length > PERSON_REPORT_CONTENT_MAX) return { ok: false, error: shape }
      p.content = content
    }
    const source = str('source').toLowerCase()
    if (source) {
      if (!(PERSON_REPORT_ENTRY_SOURCES as readonly string[]).includes(source)) return { ok: false, error: shape }
      p.source = source
    }
  } else {
    const reason = str('reason')
    if (!reason || reason.length > PERSON_REPORT_REASON_MAX) return { ok: false, error: `${verb}: a dismissal needs a reason in words, under ${PERSON_REPORT_REASON_MAX} characters — it is kept on the report and read by the author.` }
    p.reason = reason
  }
  return { ok: true, p, target: reportId }
}

/** The entry file_person_report writes when no words are passed: the reporter's words with the provenance preamble (the RPC's own composition). */
export function personReportDefaultBody(report: Pick<PersonReportRow, 'author_name' | 'created_at' | 'content'>, submittedYmd: string): string {
  const author = report.author_name.trim() || 'a master technician'
  return `Field report from ${author} (submitted ${submittedYmd}): ${report.content}`
}

/** The entry's author_label as the RPC stamps it. */
export function personReportAuthorLabel(report: Pick<PersonReportRow, 'author_name'>): string {
  return `Field report — ${report.author_name.trim() || 'unknown author'}`
}

export type PersonReportDryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/**
 * The dry run: the report as it stands and what the RPC would write. A report no longer waiting is refused in words —
 * the queue's RPCs would answer `already` without writing, and a plan on it has nothing to commit to.
 */
export function personReportDryRun(p: PersonReportPayload, report: PersonReportRow, person: { id: string; name: string } | null, calendarYmd: (iso: string) => string): PersonReportDryRun {
  if (report.status !== 'pending') {
    const when = report.resolved_at ? ` on ${calendarYmd(report.resolved_at) || report.resolved_at}` : ''
    const how = report.status === 'filed' && report.filed_entry_id ? ` as entry ${report.filed_entry_id}` : report.status === 'dismissed' && report.resolution_note ? ` — ${report.resolution_note}` : ''
    return { ok: false, refused: `Nothing to plan: this report was ${report.status}${when}${how}. get_person_file shows where it stands; read_rows on person_reports with status eq pending lists what still waits.` }
  }
  const submittedYmd = calendarYmd(report.created_at) || report.created_at.slice(0, 10)
  const who = person ? { id: person.id, name: person.name } : { id: report.subject_person_id, name: '' }
  const base: Json = {
    dry_run: true,
    action: p.action,
    report: { id: report.id, status: report.status, occurred_date: report.occurred_date, submitted_on: submittedYmd, author_name: report.author_name, content: report.content, person: who },
  }
  if (p.action === 'file') {
    const source = p.source ?? 'report'
    return {
      ok: true,
      reply: {
        ...base,
        after: {
          report_status: 'filed',
          entry: { entry_date: report.occurred_date, source, content: p.content ?? personReportDefaultBody(report, submittedYmd), author_label: personReportAuthorLabel(report), words_tightened: Boolean(p.content) },
        },
        then: `apply files it through file_person_report: the append-only HR entry above lands on ${who.name || 'the person'}'s file dated the day it happened, the report is marked filed with the entry's id, and the author sees the status on their Dashboard card. Fold the entry into the summary afterwards (plan_hr_entry).`,
      },
    }
  }
  return {
    ok: true,
    reply: {
      ...base,
      after: { report_status: 'dismissed', resolution_note: p.reason ?? '' },
      then: 'apply dismisses it through dismiss_person_report: the report keeps its words and the reason, off the queue; the Timeline shows it as dismissed with the reason, and the author sees the status on their Dashboard card.',
    },
  }
}

/** The queue's own RPC the apply POSTs, and its body — never the generic door. */
export function personReportRpc(p: PersonReportPayload): { rpc: 'file_person_report' | 'dismiss_person_report'; body: Json } {
  if (p.action === 'file') {
    const body: Json = { p_report_id: p.report_id }
    if (p.content) body.p_content = p.content
    if (p.source) body.p_source = p.source
    return { rpc: 'file_person_report', body }
  }
  return { rpc: 'dismiss_person_report', body: { p_report_id: p.report_id, p_reason: p.reason ?? '' } }
}

/** The line after the write, from the RPC's own answer ({ already, status, entry_id? }). */
export function personReportAppliedWords(p: PersonReportPayload, rpcReply: unknown, personName: string): string {
  const r = obj(rpcReply) ?? {}
  const who = personName || 'the person'
  if (r.already === true) return `Nothing changed: the report was already ${typeof r.status === 'string' ? r.status : 'resolved'} before this apply reached it.`
  if (p.action === 'file') return `Filed: the report is the HR entry ${typeof r.entry_id === 'string' ? r.entry_id : ''} on ${who}'s file now, dated the day it happened; get_person_file shows it on the line. Fold it into the summary with plan_hr_entry.`
  return `Dismissed: the report keeps its words and the reason, off the queue; get_person_file shows it as dismissed.`
}
