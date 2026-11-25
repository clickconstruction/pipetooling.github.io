/**
 * A person's statement of account from the dev seat (v2.8052): `plan_sub_statement` and `apply_sub_statement` over the
 * `sub-statement` function. The paper is the office's own, so each restated rule is held to the app's here: the mint's
 * arguments, the file's name, its title, the sent copy's row and the rows it is read from. Every name is made up.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import { isSubStatementVerb, subStatementInput, SUB_STATEMENT_FUNCTION } from '../../../supabase/functions/_shared/devMcpSubLabor'
import { planVerbFor, WRITE_VERBS, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { subPaperFingerprint } from '../../../supabase/functions/_shared/subPaperMarks'
import { buildStatementOfAccount } from '../../../supabase/functions/_shared/subPapers'
import { buildStatementOfAccountPdf } from '../../../supabase/functions/_shared/subPapersPdf'
import { ITEM_COLUMNS, PAYMENT_COLUMNS, readSubPapersRows, REGISTER_COLUMNS, SHEET_COLUMNS, type RowsClient, type StatementRegisterRow, type SubPapersRowsRead } from '../../../supabase/functions/_shared/subPapersRows'
import { portalPaperSet, portalPaperSheets } from '../../../supabase/functions/_shared/subPortalPapers'
import {
  lastStatementOf,
  statementsOf,
  pickStatementPerson,
  planStatement,
  shapeStatementAsk,
  statementCopyName,
  statementFileName,
  statementMintArgs,
  statementRangeFor,
  statementSentRow,
  statementTitle,
  STATEMENT_SENT_BUCKET,
  STATEMENT_SENT_KIND,
} from '../../../supabase/functions/_shared/subStatementMake'
import { sentCopyFileName, sentDocumentInsert } from '../sent/sentCopies'
import { ALDER_1, ASSIGNEES, CEDAR_1, CEDAR_2, CREDITS, HARLAN, harlanRows, ITEMS, JOB_ALDER, JOB_CEDAR, JOBS_LEDGER, ORA, PAYMENTS, PEOPLE, registerRows, RIDGE_1, SENDINGS, SHEETS, TESS, USERS } from '../subPortal/subPortalPapersFixture'
import { mintSubPaperArgs } from '../subWorkOrders/subPaperRegister'
import { subPaperAttachmentName, subPaperTitle, SUB_PAPER_SENT_KIND } from '../subWorkOrders/subPaperSend'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const FUNCTION = readFileSync('supabase/functions/sub-statement/index.ts', 'utf8')
const PORTAL = readFileSync('supabase/functions/sub-portal/index.ts', 'utf8')
const CONFIG = readFileSync('supabase/config.toml', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const NOTES = readFileSync('docs/dev-mcp/SERVER_NOTES.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const SENT_IO = readFileSync('src/lib/sent/sentCopiesIo.ts', 'utf8')

const TODAY = '2026-11-20'
const NOW = new Date('2026-11-20T18:00:00Z')
const COMPANY = { name: 'ZZ Sample Plumbing', lines: ['1 Sample Way', '(555) 010-0100'] }
const WHO = { person: { id: HARLAN, name: 'Harlan Mechanical' }, company: COMPANY, now: NOW }

const withPeriod = (rows: ReturnType<typeof registerRows>, extra: Array<Partial<StatementRegisterRow>> = []): StatementRegisterRow[] => [
  ...rows.map((r) => ({ ...r, period_to: null })),
  ...extra.map((r, i) => ({ id: `sa-${i}`, kind: 'statement_of_account', number: null, revision: 1, labor_job_id: null, sending_id: null, payment_id: null, issued_at: null, replaced_by: null, voided_at: null, fingerprint: '', period_to: null, ...r })),
]
const rowsFor = (register: StatementRegisterRow[] = withPeriod(registerRows())): SubPapersRowsRead => ({ ...harlanRows(), register })

describe('the ask', () => {
  const shaped = (raw: unknown) => shapeStatementAsk(raw, TODAY)
  const error = (raw: unknown): string => {
    const s = shaped(raw)
    if (s.ok) throw new Error('expected a refusal')
    return s.error
  }
  it('names a person and one of the window’s five chips, to date when left out', () => {
    expect(shaped({ person: '  Harlan   Mechanical ' })).toEqual({ ok: true, ask: { person: 'Harlan Mechanical', period: { key: 'to_date' } } })
    for (const key of ['to_date', 'since_last', 'this_month', 'this_year'] as const) expect(shaped({ person: HARLAN, period: key })).toEqual({ ok: true, ask: { person: HARLAN, period: { key } } })
    expect(shaped({ person: HARLAN, period: { from: '2026-10-01', to: '2026-10-31' } })).toEqual({ ok: true, ask: { person: HARLAN, period: { key: 'dates', from: '2026-10-01', to: '2026-10-31' } } })
    expect(shaped({ person: HARLAN, period: { to: '2026-10-31' } })).toMatchObject({ ok: true, ask: { period: { key: 'dates', from: null, to: '2026-10-31' } } })
  })
  it('refuses nobody, a wildcard, a day that is no day, a period that ends before it starts and a day that has not come', () => {
    expect(error(null)).toContain('person is a people.id')
    expect(error({ person: 'Har*' })).toContain('no wildcard')
    expect(error({ person: HARLAN, period: 'last_week' })).toContain("'to_date' (the default)")
    expect(error({ person: HARLAN, period: { from: '2026-13-01' } })).toContain("'to_date' (the default)")
    expect(error({ person: HARLAN, period: {} })).toContain("'to_date' (the default)")
    expect(error({ person: HARLAN, period: { from: '2026-10-31', to: '2026-10-01' } })).toBe('The period ends before it starts.')
    expect(error({ person: HARLAN, period: { to: '2026-11-21' } })).toContain('today is 2026-11-20')
  })
})

describe('who the paper is for', () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: HARLAN, name: 'Harlan Mechanical', kind: 'sub', account_user_id: null, archived_at: null, ...over })
  it('is the one roster row an ask means', () => {
    expect(pickStatementPerson('Harlan Mechanical', [row(), row()])).toEqual({ ok: true, person: { id: HARLAN, name: 'Harlan Mechanical' } })
    // A row that still stands is taken over one that left under the same name.
    expect(pickStatementPerson('Harlan Mechanical', [row({ id: ORA, archived_at: '2026-07-01T12:00:00Z' }), row()])).toMatchObject({ ok: true, person: { id: HARLAN } })
  })
  it('refuses nobody and several, with the ids to pick from', () => {
    const say = (people: ReturnType<typeof row>[]): string => {
      const p = pickStatementPerson('ZZ Sample', people)
      if (p.ok) throw new Error('expected a refusal')
      return p.refused
    }
    expect(say([])).toContain('No roster person "ZZ Sample" is visible to you')
    expect(say([row(), row({ id: ORA, name: 'Ora Plumbing' })])).toContain(`matches 2 roster rows — pass the people.id of one: Harlan Mechanical (${HARLAN}, sub); Ora Plumbing (${ORA}, sub).`)
  })
})

describe('the period', () => {
  it('since the last statement starts the day after it ended', () => {
    const register = withPeriod(registerRows(), [
      { number: 'SA-0003', issued_at: '2026-10-05T15:00:00Z', period_to: '2026-09-30' },
      { number: 'SA-0007', issued_at: '2026-11-02T15:00:00Z', period_to: null },
      { number: 'SA-0009', issued_at: '2026-11-18T15:00:00Z', period_to: null, voided_at: '2026-11-18T16:00:00Z' },
    ])
    // A statement made to date ended the day it was made, and a void one is no statement.
    expect(lastStatementOf(register)).toEqual({ number: 'SA-0007', endedOn: '2026-11-02', madeAt: '2026-11-02T15:00:00Z' })
    // The range carries when that statement was made: a line typed after it and dated inside it is counted (v2.8269).
    expect(statementRangeFor({ key: 'since_last' }, TODAY, lastStatementOf(register))).toEqual({ ok: true, range: { from: '2026-11-03', to: TODAY, lateAfter: '2026-11-02T15:00:00Z' } })
    expect(lastStatementOf(withPeriod(registerRows()))).toBeNull()
  })
  it('a statement made today is set apart, as in the window: since the last statement runs from the one before', () => {
    const register = withPeriod(registerRows(), [
      { number: 'SA-0007', issued_at: '2026-11-02T15:00:00Z', period_to: null },
      { number: 'SA-0011', issued_at: `${TODAY}T15:00:00Z`, period_to: null },
      { number: 'SA-0012', issued_at: `${TODAY}T19:00:00Z`, period_to: TODAY },
    ])
    expect(statementsOf(register, TODAY)).toEqual({ last: { number: 'SA-0007', endedOn: '2026-11-02', madeAt: '2026-11-02T15:00:00Z' }, madeToday: { number: 'SA-0012' } })
    const { last, madeToday } = statementsOf(register, TODAY)
    expect(statementRangeFor({ key: 'since_last' }, TODAY, last, madeToday)).toEqual({ ok: true, range: { from: '2026-11-03', to: TODAY, lateAfter: '2026-11-02T15:00:00Z' } })
    // Without today the two of today are the last statement, as the day after reads them.
    expect(statementsOf(register).last).toMatchObject({ number: 'SA-0012', endedOn: TODAY })
    // A first statement made today leaves nothing to start after, and the refusal says so.
    const first = statementsOf(register.filter((r) => r.number !== 'SA-0007'), TODAY)
    expect(first.last).toBeNull()
    expect(statementRangeFor({ key: 'since_last' }, TODAY, first.last, first.madeToday)).toEqual({ ok: false, refused: "Their first statement, SA-0012, was made today, so there is no statement before today to start after. Ask for period 'to_date'." })
  })
  it('a month and a year run from their first day to today, and to date has no edge', () => {
    expect(statementRangeFor({ key: 'this_month' }, TODAY, null)).toEqual({ ok: true, range: { from: '2026-11-01', to: TODAY } })
    expect(statementRangeFor({ key: 'this_year' }, TODAY, null)).toEqual({ ok: true, range: { from: '2026-01-01', to: TODAY } })
    expect(statementRangeFor({ key: 'to_date' }, TODAY, null)).toEqual({ ok: true, range: { from: null, to: null } })
    expect(statementRangeFor({ key: 'dates', from: null, to: '2026-10-31' }, TODAY, null)).toEqual({ ok: true, range: { from: null, to: '2026-10-31' } })
  })
  it('refuses since the last statement before any was made, or when it ended today', () => {
    expect(statementRangeFor({ key: 'since_last' }, TODAY, null)).toMatchObject({ ok: false, refused: expect.stringContaining('No statement of account has been made for them yet') })
    expect(statementRangeFor({ key: 'since_last' }, TODAY, { endedOn: TODAY })).toMatchObject({ ok: false, refused: expect.stringContaining('has no day in it yet') })
  })
})

describe('the plan', () => {
  const planned = (period: Parameters<typeof planStatement>[2] = { key: 'to_date' }, rows = rowsFor()) => {
    const p = planStatement(rows, WHO, period)
    if (!p.ok) throw new Error(p.refused)
    return p
  }
  it('is the statement the office’s builders draw from the person’s own sheets, to the fingerprint', () => {
    const rows = rowsFor()
    const p = planned({ key: 'to_date' }, rows)
    const set = portalPaperSet(rows, { subName: 'Harlan Mechanical', company: COMPANY, now: NOW })
    const office = buildStatementOfAccount(portalPaperSheets(rows), { from: null, to: null }, set.ctx)
    expect(p.statement).toEqual(office)
    expect(p.fingerprint).toBe(subPaperFingerprint(office))
    expect(p.range).toEqual({ from: null, to: null })
    expect(p.reply).toMatchObject({
      paper: 'Statement of account',
      person: { people_id: HARLAN, name: 'Harlan Mechanical' },
      period: { asked: 'to_date', from: null, to: null, words: 'To date, Nov 20, 2026' },
      still_open: office.stillOpen,
      totals: { comes_to: office.totals.comesTo, paid: office.totals.paid, open: office.stillOpen },
      paid_in_period: office.paidInPeriod,
      counts: { sheets_of_their_own: 3, on_this_paper: office.rows.length, shared_sheets_left_off: 1 },
      register: { last_statement: null, this_would_be: 'a new paper under the next SA number' },
      letterhead: 'ZZ Sample Plumbing',
      fingerprint: p.fingerprint,
    })
    // A sheet shared with another sub is on nobody's paper, and the jobs are the ones the paper names.
    expect((p.reply.sheets as unknown[]).length).toBe(office.rows.length)
    expect(JSON.stringify(p.reply)).not.toContain('Ridgeway')
    expect(p.jobIds.sort()).toEqual([JOB_ALDER, JOB_CEDAR].sort())
    expect(String(p.reply.how_it_adds_up)).toContain('− payments')
  })
  it('says what making it does and what it does not, and writes nothing itself', () => {
    const p = planned()
    expect((p.reply.makes as string[]).join(' ')).toContain('mint_sub_paper as you')
    expect((p.reply.makes as string[]).join(' ')).toContain('Documents → Sent copies')
    expect((p.reply.does_not as string[]).join(' ')).toContain('It sends nothing')
    expect((p.reply.does_not as string[]).join(' ')).toContain('no work statement and no payment record')
    expect(p.statement.number).toBe('')
  })
  it('a part payment, a payment in full and a period read as the paper reads them', () => {
    const month = planned({ key: 'this_month' })
    expect(month.range).toEqual({ from: '2026-11-01', to: TODAY })
    expect(month.reply.period).toMatchObject({ asked: 'this_month', words: 'Nov 1, 2026 to Nov 20, 2026' })
    const sections = (month.reply.sheets as Array<{ section: string; reads: string }>).map((s) => s.section)
    expect(sections).toContain('Brought forward')
    expect((month.reply.sheets as Array<{ reads: string }>).some((s) => s.reads.startsWith('Paid in full'))).toBe(true)
    // The same figures whichever way the period is asked.
    expect(planned({ key: 'dates', from: '2026-11-01', to: TODAY }).fingerprint).toBe(month.fingerprint)
    const since = planned({ key: 'since_last' }, rowsFor(withPeriod(registerRows(), [{ number: 'SA-0007', issued_at: '2026-11-02T15:00:00Z' }])))
    expect(since.range).toEqual({ from: '2026-11-03', to: TODAY, lateAfter: '2026-11-02T15:00:00Z' })
    expect(since.reply.register).toMatchObject({ last_statement: { number: 'SA-0007', ended_on: '2026-11-02' } })
  })
  it('since the last statement carries a payment typed after it and dated inside it, as the window does', () => {
    // SA-0007 ran to Nov 12 and was made that day at 15:00 UTC. Sending 231, dated Nov 12, was typed at 16:00.
    const rows = rowsFor(withPeriod(registerRows(), [{ number: 'SA-0007', issued_at: '2026-11-12T15:00:00Z', period_to: '2026-11-12' }]))
    const since = planned({ key: 'since_last' }, rows)
    expect(since.range).toEqual({ from: '2026-11-13', to: TODAY, lateAfter: '2026-11-12T15:00:00Z' })
    expect(since.statement.late).toEqual({ payments: 1, backcharges: 0, sheets: 0 })
    expect(since.reply.last_payments).toEqual([{ day: 'Nov 12, 2026', how: expect.any(String), number: 'PR-0231', amount: 2200, recorded_after_the_last_statement: true }])
    expect(since.reply.carried).toBe('1 payment dated before this period was recorded after the last statement was made, so it is counted in this one.')
    // The paper made under its number carries the same.
    expect(since.numbered('SA-0008').late).toEqual({ payments: 1, backcharges: 0, sheets: 0 })
    // The same days asked as dates are cut by the date alone: the payment is before them, and nothing is carried.
    const dates = planned({ key: 'dates', from: '2026-11-13', to: TODAY }, rows)
    expect(dates.reply.last_payments).toEqual([])
    expect(dates.reply.carried).toBeUndefined()
    expect(dates.statement.adds.opening).toBe(since.statement.adds.opening - 2200)
  })
  it('a statement made today does not stop since the last statement: it runs from the one before, and the reply names today’s', () => {
    const rows = rowsFor(withPeriod(registerRows(), [{ number: 'SA-0007', issued_at: '2026-11-02T15:00:00Z' }, { number: 'SA-0011', issued_at: `${TODAY}T15:00:00Z` }]))
    const since = planned({ key: 'since_last' }, rows)
    expect(since.range).toMatchObject({ from: '2026-11-03', to: TODAY })
    expect(since.reply.register).toMatchObject({ last_statement: { number: 'SA-0007', ended_on: '2026-11-02' }, made_today: 'SA-0011' })
  })
  it('a teammate’s own sheet is theirs: a superintendent whose roster row is kind sub', () => {
    const OWN = '00000000-0000-4000-8000-0000000371b9'
    const rows: SubPapersRowsRead = {
      personId: TESS,
      sheets: [{ id: OWN, assigned_to_name: 'Tess Lead', address: '410 Cedar Hollow Rd', job_number: '2041', job_ledger_id: JOB_CEDAR, job_date: '2026-11-13', created_at: '2026-11-13T15:00:00Z', labor_rate: 45 }],
      items: [{ job_id: OWN, fixture: 'Bonus: after hours', count: 1, hrs_per_unit: 14.5, is_fixed: false, labor_rate: 45, direct_labor_amount: null, sequence_order: 0 }],
      payments: [{ id: 'p-own', job_id: OWN, amount: 200, memo: 'Cash on the job', payment_date: '2026-08-19', created_at: '2026-11-20T15:00:00Z', hidden_from_sub: false, method: 'cash', method_ref: null, sending_id: null }],
      assignees: [{ labor_job_id: OWN, person_id: TESS }],
      people: PEOPLE,
      users: USERS,
      jobNames: { [JOB_CEDAR]: 'Cedar Hollow Clinic' },
      sendings: [],
      credits: [],
      register: [],
      acks: [],
    }
    const p = planStatement(rows, { ...WHO, person: { id: TESS, name: 'Tess Lead' } }, { key: 'to_date' })
    if (!p.ok) throw new Error(p.refused)
    expect(p.reply).toMatchObject({ still_open: 452.5, totals: { comes_to: 652.5, paid: 200, open: 452.5 }, counts: { sheets_of_their_own: 1, shared_sheets_left_off: 0 } })
    expect((p.reply.sheets as Array<{ reads: string }>)[0]!.reads).toBe('1 part payment')
    expect(p.reply.last_payments).toEqual([{ day: 'Aug 19, 2026', how: 'Cash', number: null, amount: 200 }])
  })
  it('refuses a person with no sheet of their own, and a set that does not add up, with what is off', () => {
    const refused = (rows: SubPapersRowsRead, set?: Parameters<typeof planStatement>[3]): string => {
      const p = planStatement(rows, WHO, { key: 'to_date' }, set)
      if (p.ok) throw new Error('expected a refusal')
      return p.refused
    }
    const none = { ...rowsFor(), sheets: [], items: [], payments: [], assignees: [] }
    expect(refused(none)).toBe('Harlan Mechanical has no sub labor sheet, so there is no statement to make.')
    const shared = rowsFor()
    const onlyShared = { ...shared, sheets: shared.sheets.filter((s) => s.id === RIDGE_1), assignees: shared.assignees.filter((a) => a.labor_job_id === RIDGE_1) }
    expect(refused(onlyShared)).toContain('is named on 1 sheet, and none is theirs alone')
    const rows = rowsFor()
    const set = portalPaperSet(rows, { subName: 'Harlan Mechanical', company: COMPANY, now: NOW })
    expect(set.ok).toBe(true)
    expect(refused(rows, { ...set, ok: false, problems: ['WS-2041-1: the payments do not sum to Paid so far.'] })).toBe(
      'Harlan Mechanical\'s papers do not add up, so none is made: WS-2041-1: the payments do not sum to Paid so far. Open the sheet it names on Jobs → Subs → Pay and check its payments.',
    )
  })
})

describe('making it is the window’s Download', () => {
  const rows = rowsFor()
  const p = planStatement(rows, WHO, { key: 'this_month' })
  if (!p.ok) throw new Error(p.refused)
  const paper = p.numbered('SA-0007')

  it('the register is handed what the window hands it', () => {
    expect(statementMintArgs(p.statement, HARLAN, p.range)).toEqual(mintSubPaperArgs(p.statement, HARLAN, p.range))
    expect(statementMintArgs(p.statement, HARLAN, p.range)).toMatchObject({ p_kind: 'statement_of_account', p_person_id: HARLAN, p_period_from: '2026-11-01', p_period_to: TODAY, p_still_open: p.statement.stillOpen })
  })
  it('the paper is drawn again under the number that came back, with the same figures', () => {
    expect(paper.number).toBe('SA-0007')
    expect(paper.foot.startsWith('SA-0007 · ')).toBe(true)
    expect(subPaperFingerprint(paper)).toBe(p.fingerprint)
  })
  it('its file and its title are the window’s', () => {
    expect(statementFileName(paper)).toBe(subPaperAttachmentName(paper))
    expect(statementFileName(paper)).toBe('SA-0007 Statement of account.pdf')
    expect(statementTitle(paper)).toBe(subPaperTitle(paper))
    for (const name of [statementFileName(paper), 'a/b\\c d#1.pdf', '...', '']) expect(statementCopyName(name)).toBe(sentCopyFileName(name))
  })
  it('its sent copy is the row the app writes for a downloaded paper', () => {
    const id = '00000000-0000-4000-8000-0000000371aa'
    const stored = { path: `${id}/SA-0007-Statement-of-account.pdf`, hash: 'abc', bytes: 4321 }
    const filing = { kind: SUB_PAPER_SENT_KIND.statement_of_account, title: subPaperTitle(paper), how: 'download' as const, recipientName: 'Harlan Mechanical', personId: HARLAN, jobIds: p.jobIds, source: null }
    expect(statementSentRow(id, paper, HARLAN, p.jobIds, stored)).toEqual(sentDocumentInsert(id, filing, { ...stored, type: 'application/pdf' }))
    // A copy that could not be kept still leaves the row, with no path.
    expect(statementSentRow(id, paper, HARLAN, p.jobIds, null)).toEqual(sentDocumentInsert(id, filing, null))
    expect(STATEMENT_SENT_KIND).toBe(SUB_PAPER_SENT_KIND.statement_of_account)
    expect(SENT_IO).toContain(`export const SENT_COPIES_BUCKET = '${STATEMENT_SENT_BUCKET}'`)
  })
  it('the PDF draws under pdf-lib', async () => {
    const bytes = await buildStatementOfAccountPdf(pdfLib as unknown as PdfLibLike, paper, p.range)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })
})

describe('the rows are read through whoever asks', () => {
  /** A client over the fixture's tables that answers a page at a time and counts the reads. */
  function fakeClient(tables: Record<string, Array<Record<string, unknown>>>, refuse: string | null = null): { client: RowsClient; asked: string[] } {
    const asked: string[] = []
    const client: RowsClient = {
      from(table: string) {
        let rows = (tables[table] ?? []).slice()
        const q = {
          select: () => q,
          in: (column: string, values: readonly string[]) => {
            rows = rows.filter((r) => values.includes(String(r[column])))
            return q
          },
          eq: (column: string, value: string) => {
            rows = rows.filter((r) => String(r[column]) === value)
            return q
          },
          order: () => q,
          range: (from: number, to: number) => {
            asked.push(table)
            return Promise.resolve(table === refuse ? { data: null, error: { message: 'permission denied' } } : { data: rows.slice(from, to + 1), error: null })
          },
        }
        return q
      },
    }
    return { client, asked }
  }
  const tables = {
    people_labor_job_assignees: ASSIGNEES,
    people_labor_jobs: SHEETS,
    people_labor_job_items: ITEMS,
    people_labor_job_payments: PAYMENTS,
    people: PEOPLE,
    users: USERS,
    jobs_ledger: JOBS_LEDGER,
    sub_payment_sendings: SENDINGS,
    sub_credit_entries: CREDITS,
    sub_papers: withPeriod(registerRows()).map((r) => ({ ...r, person_id: HARLAN })),
  } as unknown as Record<string, Array<Record<string, unknown>>>

  it('every sheet the person is named on, with everyone else on those sheets, and never another person’s own', async () => {
    const { client } = fakeClient(tables)
    const rows = await readSubPapersRows(client, HARLAN)
    expect(rows.sheets.map((s) => s.id).sort()).toEqual([ALDER_1, CEDAR_1, CEDAR_2, RIDGE_1].sort())
    expect(rows.assignees.some((a) => a.person_id === ORA)).toBe(true)
    expect(rows.jobNames).toEqual({ [JOB_CEDAR]: 'Cedar Hollow Clinic', [JOB_ALDER]: 'Alder Court Remodel' })
    expect(rows.register.length).toBe(5)
    // The same statement as the fixture's own rows give.
    const read = planStatement(rows, WHO, { key: 'to_date' })
    const fixture = planStatement(rowsFor(), WHO, { key: 'to_date' })
    expect(read.ok && fixture.ok && read.fingerprint === fixture.fingerprint).toBe(true)
  })
  it('a person named on nothing reads no sheet, and a refused read is said, never counted as none', async () => {
    expect((await readSubPapersRows(fakeClient(tables).client, '00000000-0000-4000-8000-000000037100')).sheets).toEqual([])
    await expect(readSubPapersRows(fakeClient(tables, 'people_labor_job_payments').client, HARLAN)).rejects.toThrow('people_labor_job_payments: permission denied')
  })
  it('the tables and columns are the ones the sub’s own page reads', () => {
    for (const columns of [SHEET_COLUMNS, ITEM_COLUMNS, PAYMENT_COLUMNS]) expect(PORTAL).toContain(`'${columns}'`)
    expect(PORTAL).toContain(`'${REGISTER_COLUMNS.replace(', period_to', '')}'`)
    for (const table of ['sub_payment_sendings', 'sub_credit_entries', 'sub_papers', 'people_labor_job_assignees']) expect(PORTAL).toContain(`'${table}'`)
  })
})

describe('the seat’s two verbs', () => {
  it('are a plan and its apply that name no RPC', () => {
    expect(isSubStatementVerb('plan_sub_statement') && isSubStatementVerb('apply_sub_statement')).toBe(true)
    expect(isSubStatementVerb('plan_sub_labor')).toBe(false)
    expect(WRITE_VERBS.plan_sub_statement).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_sub_statement).toEqual({ rpc: null, step: 'apply' })
    expect(planVerbFor('apply_sub_statement')).toBe('plan_sub_statement')
  })
  it('shape only as far as naming a person: the function reads the rest', () => {
    expect(subStatementInput('plan_sub_statement', { statement: { person: ' Harlan  Mechanical ' } })).toEqual({ ok: true, p: { person: 'Harlan Mechanical', period: 'to_date' }, target: null, planHash: null })
    expect(subStatementInput('plan_sub_statement', { statement: { person: HARLAN, period: { from: '2026-11-01' } } })).toMatchObject({ ok: true, p: { period: { from: '2026-11-01' } } })
    expect(subStatementInput('plan_sub_statement', { statement: {} })).toMatchObject({ ok: false, error: expect.stringContaining('plan_sub_statement needs statement: { person') })
    expect(subStatementInput('apply_sub_statement', { statement: { person: HARLAN } })).toMatchObject({ ok: false, error: expect.stringContaining('needs plan_hash') })
    const hash = 'a'.repeat(64)
    expect(writeRpcBody('apply_sub_statement', { statement: { person: HARLAN, period: 'this_month' }, plan_hash: hash })).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { person: HARLAN, period: 'this_month' } }, planHash: hash })
  })
  it('call the function as the dev, and hold it to the figures the plan read', () => {
    expect(SUB_STATEMENT_FUNCTION).toBe('sub-statement')
    expect(SERVER).toContain("name: 'plan_sub_statement'")
    expect(SERVER).toContain("name: 'apply_sub_statement'")
    expect(SERVER).toContain('invokeAsDev(session, SUB_STATEMENT_FUNCTION, { person: p.person, period: p.period })')
    expect(SERVER).toContain('invokeAsDev(session, SUB_STATEMENT_FUNCTION, { person: p.person, period: p.period, make: true, expect: plan.fingerprint })')
    expect(SERVER).toContain("const SERVER_VERSION = '0.134.0'")
    expect(SERVER).toContain('Writes are one hundred and fifty-six verbs and nothing else:')
    expect(SERVER).toContain('the other ninety-eight name no RPC')
    expect(SERVER).toContain('plan_sub_statement → apply_sub_statement (a person\'s Statement of account as the papers window\'s Download makes it')
  })
  it('the function reads as the caller, refuses a changed set, registers before it draws and sends nothing', () => {
    expect(FUNCTION).toContain("const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])")
    expect(FUNCTION).toContain('refuseArchivedCaller(admin, user.id, corsHeaders)')
    expect(FUNCTION).toContain('readSubPapersRows(userClient as unknown as RowsClient, picked.person.id)')
    expect(FUNCTION).toContain('if (!make) return jsonResponse({ ok: true, plan: plan.reply })')
    expect(FUNCTION).toContain('if (!expect || expect !== plan.fingerprint)')
    expect(FUNCTION.indexOf("userClient.rpc('mint_sub_paper'")).toBeGreaterThan(FUNCTION.indexOf('expect !== plan.fingerprint'))
    expect(FUNCTION.indexOf('buildStatementOfAccountPdf(')).toBeGreaterThan(FUNCTION.indexOf("userClient.rpc('mint_sub_paper'"))
    expect(FUNCTION).not.toContain('sendEmailViaResend')
    expect(FUNCTION).not.toMatch(/admin\s*\.from\('(people_labor|sub_papers|sent_documents)/)
    expect(CONFIG).toContain('[functions.sub-statement]\nverify_jwt = false')
  })
  it('is written down where the seat is', () => {
    expect(README).toContain('`plan_sub_statement(statement)` · `apply_sub_statement(statement, plan_hash)`')
    expect(README).toContain('one hundred and fifty-six `plan_` / `apply_` / `revert_` verbs')
    expect(NOTES).toContain('0.121.0 (v2.8052;')
    expect(EDGE).toContain('### sub-statement')
    expect(EDGE).toContain('**v2.8052 (server 0.121.0) — a statement of account from the seat**')
  })
})
