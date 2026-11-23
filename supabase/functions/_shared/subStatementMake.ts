/**
 * A person's statement of account made off the screen: the dev seat's `plan_sub_statement` and `apply_sub_statement`,
 * through the `sub-statement` function. It is the paper the office's papers window makes (punch list #350): the same
 * rows, the same builders (`subPapers.ts` over `subPortalPapers.ts`'s sheets), the same check, the same register.
 *
 *  - **The plan writes nothing.** It answers the statement as data: each sheet, what was paid, what is still open and
 *    the one line of how it adds up, with what making it would do.
 *  - **Making it is the window's Download.** The paper is registered through `mint_sub_paper` as the caller, drawn
 *    under the number that came back, and kept as a sent copy on the person and each job. Nothing is sent to anyone.
 *  - **A set that does not add up is not made**, as in the window: the reasons come back and no figure does.
 *
 * Pure: no table, and the clock is handed in. The reads and the writes are `sub-statement/index.ts`.
 */
import { calendarYmdInAppTzFromIso } from './appTimeZone.ts'
import { subPaperFingerprint } from './subPaperMarks.ts'
import { buildStatementOfAccount, statementAddsWords, statementLateWords, subPaperAddsUp, type PaperCompany, type StatementOfAccount, type StatementRange } from './subPapers.ts'
import type { StatementRegisterRow, SubPapersRowsRead } from './subPapersRows.ts'
import { portalPaperSet, type PortalPaperSet } from './subPortalPapers.ts'

type Json = Record<string, unknown>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const validYmd = (s: string): boolean => YMD_RE.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`))

/** The window's five chips. `dates` is *Pick dates*, with either end left open. */
export type StatementPeriod = { key: 'to_date' | 'since_last' | 'this_month' | 'this_year' } | { key: 'dates'; from: string | null; to: string | null }
export const STATEMENT_PERIOD_WORDS = "period is 'to_date' (the default), 'since_last', 'this_month', 'this_year' or { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' }"

export type StatementAsk = { person: string; period: StatementPeriod }

/** The ask as the function takes it. `person` is a people.id, a users.id or the person's whole name. */
export function shapeStatementAsk(raw: unknown, today: string): { ok: true; ask: StatementAsk } | { ok: false; error: string } {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Json) : null
  const person = typeof src?.person === 'string' ? src.person.trim().replace(/\s+/g, ' ') : ''
  if (!person) return { ok: false, error: 'person is a people.id, a users.id or the person\'s whole name.' }
  if (/[*%]/.test(person)) return { ok: false, error: 'person takes no wildcard: the whole name, or an id.' }
  const p = src?.period
  if (p == null || p === 'to_date') return { ok: true, ask: { person, period: { key: 'to_date' } } }
  if (p === 'since_last' || p === 'this_month' || p === 'this_year') return { ok: true, ask: { person, period: { key: p } } }
  if (typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: STATEMENT_PERIOD_WORDS }
  const day = (v: unknown): string | null | false => (v == null || v === '' ? null : typeof v === 'string' && validYmd(v.trim()) ? v.trim() : false)
  const from = day((p as Json).from)
  const to = day((p as Json).to)
  if (from === false || to === false || (from === null && to === null)) return { ok: false, error: STATEMENT_PERIOD_WORDS }
  if (from && to && from > to) return { ok: false, error: 'The period ends before it starts.' }
  // A paper closes on a real day, today at the latest.
  if ((to && to > today) || (from && from > today)) return { ok: false, error: `A statement closes on a day that has come: today is ${today}.` }
  return { ok: true, ask: { person, period: { key: 'dates', from, to } } }
}

// ── who ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type StatementPersonRow = { id: string; name: string | null; kind: string | null; account_user_id: string | null; archived_at: string | null }

export const isStatementPersonId = (s: string): boolean => UUID_RE.test(s)

/** The one roster row an ask means. A paper is for a roster person: their sheets are tied to them by that row. */
export function pickStatementPerson(asked: string, people: readonly StatementPersonRow[]): { ok: true; person: { id: string; name: string } } | { ok: false; refused: string } {
  const live = people.filter((p) => !p.archived_at)
  const rows = live.length > 0 ? live : people
  const unique = [...new Map(rows.map((p) => [p.id, p])).values()]
  if (unique.length === 0) return { ok: false, refused: `No roster person "${asked}" is visible to you. Pass a people.id, a users.id or the whole name; find_person lists the team.` }
  if (unique.length > 1) return { ok: false, refused: `"${asked}" matches ${unique.length} roster rows — pass the people.id of one: ${unique.slice(0, 8).map((p) => `${(p.name ?? '').trim() || 'no name'} (${p.id}${p.kind ? `, ${p.kind}` : ''})`).join('; ')}.` }
  const p = unique[0]!
  return { ok: true, person: { id: p.id, name: (p.name ?? '').trim() || 'no name' } }
}

// ── the period ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The last statement of account made for this person, by the day it ended, and the newest one that ended today
 * (the office's `subPaperRegister`, one rule for both). With `today` handed in a statement that ended today is
 * set apart: the day is not over, so nothing can start after it yet, and *since the last statement* runs from
 * the one before. `madeAt` is when the last one was made: a line typed after it and dated inside it is carried.
 */
export function statementsOf(register: readonly StatementRegisterRow[], today?: string): { last: { number: string; endedOn: string; madeAt: string } | null; madeToday: { number: string } | null } {
  let last: { number: string; endedOn: string; at: string } | null = null
  let madeToday: { number: string; at: string } | null = null
  for (const r of register) {
    if (r.voided_at || r.kind !== 'statement_of_account' || !(r.number ?? '').trim()) continue
    const at = r.issued_at ?? ''
    const number = (r.number ?? '').trim()
    const endedOn = (r.period_to ?? '').slice(0, 10) || (at ? calendarYmdInAppTzFromIso(at).slice(0, 10) : '')
    if (today && endedOn >= today) {
      if (!madeToday || at > madeToday.at) madeToday = { number, at }
      continue
    }
    if (endedOn && (!last || endedOn > last.endedOn || (endedOn === last.endedOn && at > last.at))) last = { number, endedOn, at }
  }
  return { last: last ? { number: last.number, endedOn: last.endedOn, madeAt: last.at } : null, madeToday: madeToday ? { number: madeToday.number } : null }
}

/** The last statement alone. See `statementsOf`. */
export function lastStatementOf(register: readonly StatementRegisterRow[], today?: string): { number: string; endedOn: string; madeAt: string } | null {
  return statementsOf(register, today).last
}

function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10)
}

/** The dates a chip means, as the window reads them: a month or a year runs from its first day to today. */
export function statementRangeFor(period: StatementPeriod, today: string, last: { endedOn: string; madeAt?: string } | null, madeToday: { number: string } | null = null): { ok: true; range: StatementRange } | { ok: false; refused: string } {
  if (period.key === 'to_date') return { ok: true, range: { from: null, to: null } }
  if (period.key === 'dates') return { ok: true, range: { from: period.from, to: period.to } }
  if (period.key === 'this_month') return { ok: true, range: { from: `${today.slice(0, 7)}-01`, to: today } }
  if (period.key === 'this_year') return { ok: true, range: { from: `${today.slice(0, 4)}-01-01`, to: today } }
  if (!last) return { ok: false, refused: madeToday ? `Their first statement, ${madeToday.number}, was made today, so there is no statement before today to start after. Ask for period 'to_date'.` : "No statement of account has been made for them yet, so there is nothing to start after. Ask for period 'to_date'." }
  const from = nextDay(last.endedOn)
  if (from > today) return { ok: false, refused: `Their last statement ended ${last.endedOn}, so a statement since then has no day in it yet. Ask for period 'to_date'.` }
  // The window's rule (the owner, 2026-11-21): cut by the date, and a line typed after the last statement was made is carried.
  return { ok: true, range: { from, to: today, lateAfter: last.madeAt || null } }
}

// ── the plan ─────────────────────────────────────────────────────────────────────────────────────────────────

export const STATEMENT_MAKES = [
  'It registers the paper through mint_sub_paper as you: a statement of account takes the next SA number each time it is made, and a number is never given out twice.',
  'It draws the PDF under that number with the kernel the papers window prints with, and keeps it as a sent copy on the person and on each job (Documents → Sent copies, under Statements and reports), marked downloaded.',
  'It hands back a link to that copy that opens for one hour.',
]
export const STATEMENT_DOES_NOT = [
  'It sends nothing: no email, no text, no push. Give the person the file yourself.',
  'It makes no work statement and no payment record, and numbers no sheet: those are the papers window\'s own presses. A sheet the office has not numbered reads by its job and its day.',
  'It changes no sheet, no payment and no balance.',
]

export type StatementPlan =
  | { ok: true; statement: StatementOfAccount; range: StatementRange; jobIds: string[]; fingerprint: string; reply: Json; /** The paper again under the number the register answered. */ numbered: (number: string) => StatementOfAccount }
  | { ok: false; refused: string }

/** The statement and what the plan says of it. `now` is the caller's clock, so a test holds the day. */
export function planStatement(
  rows: SubPapersRowsRead,
  who: { person: { id: string; name: string }; company: PaperCompany; now: Date },
  period: StatementPeriod,
  set: PortalPaperSet = portalPaperSet(rows, { subName: who.person.name, company: who.company, now: who.now }),
): StatementPlan {
  const name = who.person.name
  if (set.sheets.length === 0) {
    const shared = rows.sheets.length
    return { ok: false, refused: shared > 0 ? `${name} is named on ${shared} ${shared === 1 ? 'sheet' : 'sheets'}, and none is theirs alone. A paper is made from a person's own sheets: Whose is it… on People → Subs settles a shared one.` : `${name} has no sub labor sheet, so there is no statement to make.` }
  }
  const { last, madeToday } = statementsOf(rows.register, set.ctx.today)
  const ranged = statementRangeFor(period, set.ctx.today, last, madeToday)
  if (!ranged.ok) return ranged
  const range = ranged.range
  // When each sheet was typed, as the office's builder hands it: a statement since the last one counts a sheet typed after it as new work.
  const typed = new Map(rows.sheets.map((s) => [s.id, s.created_at ?? '']))
  const sheets = set.sheets.map((s) => ({ ...s, at: typed.get(s.id) ?? '' }))
  const statement = buildStatementOfAccount(sheets, range, set.ctx)
  // The window's check: the three papers against each other over every date (`portalPaperSet`), then this period's own arithmetic.
  const problems = [...new Set([...set.problems, ...subPaperAddsUp(statement).problems])]
  if (problems.length > 0) return { ok: false, refused: `${name}'s papers do not add up, so none is made: ${problems.slice(0, 6).join(' ')} Open the sheet it names on Jobs → Subs → Pay and check its payments.` }
  const ledgerOf = new Map(rows.sheets.map((s) => [s.id, s.job_ledger_id ?? '']))
  const jobIds = [...new Set(statement.rows.map((r) => ledgerOf.get(r.sheetId) ?? '').filter(Boolean))]
  const fingerprint = subPaperFingerprint(statement)
  const warnings: string[] = []
  if (statement.undated > 0) warnings.push(`${statement.undated} money ${statement.undated === 1 ? 'line has' : 'lines have'} no day and ${statement.undated === 1 ? 'is' : 'are'} left off a statement with a period. A statement to date counts ${statement.undated === 1 ? 'it' : 'them'}.`)
  if (statement.rows.length === 0) warnings.push('No sheet falls in this period, so the paper would list no work.')
  const shared = rows.sheets.length - set.sheets.length
  return {
    ok: true,
    statement,
    range,
    jobIds,
    fingerprint,
    numbered: (number) => buildStatementOfAccount(sheets, range, set.ctx, { number }),
    reply: {
      paper: 'Statement of account',
      person: { people_id: who.person.id, name },
      period: { asked: period.key, from: range.from, to: range.to, words: statement.period, closes_on: statement.closingDay },
      still_open: statement.stillOpen,
      sheets: statement.rows.map((r) => ({ section: r.section === 'forward' ? 'Brought forward' : 'Work in this period', statement: r.sheetName, job: r.job, reads: r.words, comes_to: r.comesTo, paid: r.paid, open: r.open })),
      totals: { comes_to: statement.totals.comesTo, paid: statement.totals.paid, open: statement.totals.open },
      last_payments: statement.lastPayments.map((p) => ({ day: p.day, how: p.how, number: p.number || null, amount: p.amount, ...(p.late ? { recorded_after_the_last_statement: true } : {}) })),
      paid_in_period: statement.paidInPeriod,
      how_it_adds_up: statementAddsWords(statement, range),
      ...(statementLateWords(statement) ? { carried: statementLateWords(statement) } : {}),
      ...(statement.credit > 0 ? { held_as_credit: statement.credit } : {}),
      ...(statement.paidThisYear ? { paid_this_year: statement.paidThisYear } : {}),
      counts: { sheets_of_their_own: set.sheets.length, on_this_paper: statement.rows.length, payments_in_period: statement.lastPayments.length, shared_sheets_left_off: shared },
      register: {
        last_statement: last ? { number: last.number, ended_on: last.endedOn } : null,
        ...(madeToday ? { made_today: madeToday.number } : {}),
        this_would_be: 'a new paper under the next SA number',
      },
      letterhead: who.company.name,
      makes: STATEMENT_MAKES,
      does_not: STATEMENT_DOES_NOT,
      ...(warnings.length ? { warnings } : {}),
      // What an apply holds the figures to: a sheet or a payment changed since reads differently.
      fingerprint,
    },
  }
}

// ── making it ────────────────────────────────────────────────────────────────────────────────────────────────

/** What `mint_sub_paper` takes for a statement of account (the office's `mintSubPaperArgs`). The snapshot is the paper before its number. */
export function statementMintArgs(statement: StatementOfAccount, personId: string, range: StatementRange): Json {
  return { p_kind: 'statement_of_account', p_person_id: personId, p_snapshot: statement as unknown as Json, p_fingerprint: subPaperFingerprint(statement), p_period_from: range.from, p_period_to: range.to, p_still_open: statement.stillOpen }
}

/** `SA-0007 Statement of account.pdf` (the office's `subPaperAttachmentName`). */
export function statementFileName(statement: Pick<StatementOfAccount, 'number'>): string {
  return `${statement.number ? `${statement.number} ` : ''}Statement of account.pdf`
}

/** `Statement of account · <name> · <period>` (the office's `subPaperTitle`). */
export function statementTitle(statement: Pick<StatementOfAccount, 'sub' | 'period'>): string {
  return `Statement of account · ${statement.sub.name} · ${statement.period}`
}

export const STATEMENT_SENT_KIND = 'sub_statement_of_account'
export const STATEMENT_SENT_BUCKET = 'sent-documents'

/** A file name the bucket takes (the app's `sentCopyFileName`). */
export function statementCopyName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? ''
  return base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 80) || 'copy'
}

/** The `sent_documents` row for the copy, as the app's `sentDocumentInsert` writes a downloaded paper. `stored` is null when the copy could not be kept. */
export function statementSentRow(id: string, statement: StatementOfAccount, personId: string, jobIds: readonly string[], stored: { path: string; hash: string; bytes: number } | null): Json {
  return {
    id,
    kind: STATEMENT_SENT_KIND,
    title: statementTitle(statement).slice(0, 300),
    how: 'download',
    recipient_name: statement.sub.name.trim().slice(0, 300),
    recipient_emails: [],
    subject: '',
    job_ids: [...new Set(jobIds.filter((j) => UUID_RE.test(j)))],
    customer_id: null,
    bid_id: null,
    person_id: personId,
    source_table: '',
    source_id: null,
    copy_path: stored?.path ?? null,
    copy_type: stored ? 'application/pdf' : '',
    copy_hash: stored?.hash ?? '',
    copy_bytes: stored?.bytes ?? null,
  }
}
