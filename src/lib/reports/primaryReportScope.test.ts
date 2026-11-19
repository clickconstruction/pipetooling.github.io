import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  recipientsWhoReadReport,
  reportJobsOpenToUser,
  reportsOpenToRecipient,
  rowsOnJobsOpenToUser,
  rowsOpenToRecipient,
  sameAddress,
  type ReportScopeAdmin,
} from '../../../supabase/functions/_shared/primaryReportScope'

// A primary reads their own jobs' reports (the owner's word of 2026-11-19), asked about a named recipient by the
// senders that read with the service role. The database's answer is faked here; the SQL bed primary-scope-reports
// holds the rule itself (`reports_open_to_user`, `reports_open_to_address`, `report_jobs_open_to_user`).

type Answer = { data: unknown; error: { message: string } | null }
type Call = { fn: string; args: Record<string, unknown> }
type Primary = { id: string; email: string; reads: string[]; jobs: string[] }

/** The real client is one of these: a function passes its service-role client as it is. Checked by the compiler alone. */
export const takesTheRealClient: (client: SupabaseClient) => ReportScopeAdmin = (client) => client

const LUIS: Primary = { id: 'luis', email: 'luis@click.test', reads: ['r1', 'r2'], jobs: ['j1'] }
const PAT: Primary = { id: 'pat', email: 'pat@click.test', reads: [], jobs: [] }

/**
 * A service-role client over two primaries. `rpc` answers as the three functions do: every id for a recipient who is
 * not a primary. `rpcFails` makes both functions refuse; `usersFails` makes the read of the primaries refuse.
 */
function adminOf(opts: { rpcFails?: string | 'throws'; usersFails?: boolean; calls?: Call[]; reads?: string[] } = {}): ReportScopeAdmin {
  const primaries = [LUIS, PAT]
  return {
    rpc: (fn, args = {}) => {
      opts.calls?.push({ fn, args })
      if (opts.rpcFails === 'throws') return Promise.reject(new Error('network down'))
      if (opts.rpcFails) return Promise.resolve<Answer>({ data: null, error: { message: opts.rpcFails } })
      if (fn === 'report_jobs_open_to_user') {
        const jobs = args.p_job_ids as string[]
        const primary = primaries.find((p) => p.id === args.p_user_id)
        return Promise.resolve<Answer>({ data: primary ? jobs.filter((id) => primary.jobs.includes(id)) : jobs, error: null })
      }
      const ids = args.p_report_ids as string[]
      const who =
        fn === 'reports_open_to_user'
          ? primaries.find((p) => p.id === args.p_user_id)
          : primaries.find((p) => sameAddress(p.email, String(args.p_email)))
      return Promise.resolve<Answer>({ data: who ? ids.filter((id) => who.reads.includes(id)) : ids, error: null })
    },
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => {
          opts.reads?.push(`${table}.${columns} where ${column}=${value}`)
          if (opts.usersFails) return Promise.resolve<Answer>({ data: null, error: { message: 'connection refused' } })
          return Promise.resolve<Answer>({ data: primaries.map((p) => ({ id: p.id, email: ` ${p.email.toUpperCase()} ` })), error: null })
        },
      }),
    }),
  }
}

const sorted = (set: Set<string>) => [...set].sort()

afterEach(() => vi.restoreAllMocks())

describe('primaryReportScope: which reports a named recipient may be sent', () => {
  it('a primary is sent the reports they read, and no other', async () => {
    expect(sorted(await reportsOpenToRecipient(adminOf(), { userId: 'luis' }, ['r1', 'r2', 'r3']))).toEqual(['r1', 'r2'])
    expect(sorted(await reportsOpenToRecipient(adminOf(), { userId: 'pat' }, ['r1', 'r2', 'r3']))).toEqual([])
  })

  it('everyone who is not a primary is sent every report', async () => {
    expect(sorted(await reportsOpenToRecipient(adminOf(), { userId: 'the-master' }, ['r1', 'r2', 'r3']))).toEqual(['r1', 'r2', 'r3'])
  })

  it('asks the database about the user, with each report once', async () => {
    const calls: Call[] = []
    await reportsOpenToRecipient(adminOf({ calls }), { userId: 'luis' }, ['r1', 'r1', 'r3'])
    expect(calls).toEqual([{ fn: 'reports_open_to_user', args: { p_user_id: 'luis', p_report_ids: ['r1', 'r3'] } }])
  })

  it('an outside address is asked about by its address, and narrowed only when it is a primary’s own', async () => {
    const calls: Call[] = []
    const admin = adminOf({ calls })
    expect(sorted(await reportsOpenToRecipient(admin, { email: ' Luis@Click.test ' }, ['r1', 'r3']))).toEqual(['r1'])
    expect(sorted(await reportsOpenToRecipient(admin, { email: 'ap@builder.test' }, ['r1', 'r3']))).toEqual(['r1', 'r3'])
    expect(calls.map((c) => c.fn)).toEqual(['reports_open_to_address', 'reports_open_to_address'])
    expect(calls[0]!.args).toEqual({ p_email: 'Luis@Click.test', p_report_ids: ['r1', 'r3'] })
  })

  it('the user wins when a recipient carries both', async () => {
    const calls: Call[] = []
    await reportsOpenToRecipient(adminOf({ calls }), { userId: 'pat', email: 'luis@click.test' }, ['r1'])
    expect(calls).toEqual([{ fn: 'reports_open_to_user', args: { p_user_id: 'pat', p_report_ids: ['r1'] } }])
  })

  it('with no report, or no recipient, nothing is asked', async () => {
    const calls: Call[] = []
    const admin = adminOf({ calls })
    expect(sorted(await reportsOpenToRecipient(admin, { userId: 'luis' }, []))).toEqual([])
    expect(sorted(await reportsOpenToRecipient(admin, {}, ['r1']))).toEqual(['r1'])
    expect(sorted(await reportsOpenToRecipient(admin, { userId: null, email: '  ' }, ['r1']))).toEqual(['r1'])
    expect(calls).toEqual([])
  })

  it('an id the database answers that was never asked is not taken', async () => {
    const admin: ReportScopeAdmin = { rpc: () => Promise.resolve<Answer>({ data: ['r1', 'r9', 7, null], error: null }), from: () => ({}) }
    expect(sorted(await reportsOpenToRecipient(admin, { userId: 'luis' }, ['r1', 'r2']))).toEqual(['r1'])
  })
})

describe('primaryReportScope: when the question fails', () => {
  const missing = 'function public.reports_open_to_user(uuid, uuid[]) does not exist'

  it('a recipient who is not a primary is sent everything, as before the rule', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reads: string[] = []
    expect(sorted(await reportsOpenToRecipient(adminOf({ rpcFails: missing, reads }), { userId: 'the-master' }, ['r1', 'r2']))).toEqual(['r1', 'r2'])
    expect(reads).toEqual(['users.id, email where role=primary'])
    expect(log.mock.calls[0]![0]).toContain('not a primary: sent as before')
  })

  it('a primary is sent nothing, and the log says why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(sorted(await reportsOpenToRecipient(adminOf({ rpcFails: missing }), { userId: 'luis' }, ['r1', 'r2']))).toEqual([])
    expect(log.mock.calls[0]![0]).toContain(missing)
    expect(log.mock.calls[0]![0]).toContain('The recipient is a primary: nothing is sent')
  })

  it('a primary’s own address is held too, whatever its case and spaces, and any other address goes out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = adminOf({ rpcFails: missing })
    expect(sorted(await reportsOpenToRecipient(admin, { email: 'LUIS@click.test' }, ['r1']))).toEqual([])
    expect(sorted(await reportsOpenToRecipient(admin, { email: 'ap@builder.test' }, ['r1']))).toEqual(['r1'])
  })

  it('when who the primaries are does not read either, nobody is sent anything', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(sorted(await reportsOpenToRecipient(adminOf({ rpcFails: missing, usersFails: true }), { userId: 'the-master' }, ['r1']))).toEqual([])
    expect(log.mock.calls[0]![0]).toContain('did not read either')
  })

  it('a call that throws, and an answer that is no list, are failures like any other', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(sorted(await reportsOpenToRecipient(adminOf({ rpcFails: 'throws' }), { userId: 'luis' }, ['r1']))).toEqual([])
    expect(sorted(await reportsOpenToRecipient(adminOf({ rpcFails: 'throws' }), { userId: 'the-master' }, ['r1']))).toEqual(['r1'])
    const noList: ReportScopeAdmin = { ...adminOf(), rpc: () => Promise.resolve<Answer>({ data: null, error: null }) }
    expect(sorted(await reportsOpenToRecipient(noList, { userId: 'pat' }, ['r1']))).toEqual([])
  })
})

describe('primaryReportScope: the two shapes the senders use', () => {
  it('the people a notice about one report may go to keep their order', async () => {
    expect(await recipientsWhoReadReport(adminOf(), 'r1', ['the-master', 'pat', 'luis', 'rosa'])).toEqual(['the-master', 'luis', 'rosa'])
    expect(await recipientsWhoReadReport(adminOf(), 'r3', ['luis', 'the-master'])).toEqual(['the-master'])
  })

  it('with no report every recipient stays, and nothing is asked', async () => {
    const calls: Call[] = []
    expect(await recipientsWhoReadReport(adminOf({ calls }), null, ['pat', 'luis'])).toEqual(['pat', 'luis'])
    expect(await recipientsWhoReadReport(adminOf({ calls }), 'r1', [])).toEqual([])
    expect(calls).toEqual([])
  })

  it('a recipient’s rows keep their order, asked about once', async () => {
    const calls: Call[] = []
    const rows = [{ id: 'r3', n: 1 }, { id: 'r2', n: 2 }, { id: 'r1', n: 3 }]
    expect(await rowsOpenToRecipient(adminOf({ calls }), { userId: 'luis' }, rows)).toEqual([{ id: 'r2', n: 2 }, { id: 'r1', n: 3 }])
    expect(await rowsOpenToRecipient(adminOf({ calls }), { userId: 'the-master' }, rows)).toEqual(rows)
    expect(calls).toHaveLength(2)
    expect(await rowsOpenToRecipient(adminOf({ calls }), { userId: 'luis' }, [])).toEqual([])
    expect(calls).toHaveLength(2)
  })
})

describe('primaryReportScope: the crew time in the digest', () => {
  it('a primary is sent the crew time of the jobs whose reports they read, and everyone else every job', async () => {
    expect(sorted(await reportJobsOpenToUser(adminOf(), 'luis', ['j1', 'j2']))).toEqual(['j1'])
    expect(sorted(await reportJobsOpenToUser(adminOf(), 'pat', ['j1', 'j2']))).toEqual([])
    expect(sorted(await reportJobsOpenToUser(adminOf(), 'the-master', ['j1', 'j2']))).toEqual(['j1', 'j2'])
  })

  it('asks about the user with each job once, and asks nothing with no job or no user', async () => {
    const calls: Call[] = []
    const admin = adminOf({ calls })
    await reportJobsOpenToUser(admin, ' luis ', ['j1', 'j1', 'j2'])
    expect(calls).toEqual([{ fn: 'report_jobs_open_to_user', args: { p_user_id: 'luis', p_job_ids: ['j1', 'j2'] } }])
    expect(sorted(await reportJobsOpenToUser(admin, 'luis', []))).toEqual([])
    expect(sorted(await reportJobsOpenToUser(admin, null, ['j1']))).toEqual(['j1'])
    expect(calls).toHaveLength(1)
  })

  it('the sessions kept are the ones on those jobs, in their order, and a session on no job is dropped', async () => {
    const calls: Call[] = []
    const sessions = [
      { id: 's1', job_ledger_id: 'j2' },
      { id: 's2', job_ledger_id: 'j1' },
      { id: 's3', job_ledger_id: null },
      { id: 's4', job_ledger_id: 'j1' },
    ]
    expect((await rowsOnJobsOpenToUser(adminOf({ calls }), 'luis', sessions)).map((s) => s.id)).toEqual(['s2', 's4'])
    expect((await rowsOnJobsOpenToUser(adminOf({ calls }), 'the-master', sessions)).map((s) => s.id)).toEqual(['s1', 's2', 's4'])
    expect((await rowsOnJobsOpenToUser(adminOf({ calls }), 'pat', sessions)).map((s) => s.id)).toEqual([])
    expect(calls.map((c) => c.args.p_job_ids)).toEqual([['j2', 'j1'], ['j2', 'j1'], ['j2', 'j1']])
    expect(await rowsOnJobsOpenToUser(adminOf({ calls }), 'luis', [{ id: 's3', job_ledger_id: null }])).toEqual([])
    expect(calls).toHaveLength(3)
  })

  it('when the question fails a primary is sent no crew time, and everyone else all of it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const missing = 'function public.report_jobs_open_to_user(uuid, uuid[]) does not exist'
    expect(sorted(await reportJobsOpenToUser(adminOf({ rpcFails: missing }), 'luis', ['j1']))).toEqual([])
    expect(sorted(await reportJobsOpenToUser(adminOf({ rpcFails: missing }), 'the-master', ['j1']))).toEqual(['j1'])
    expect(log.mock.calls[0]![0]).toContain(missing)
    expect(sorted(await reportJobsOpenToUser(adminOf({ rpcFails: missing, usersFails: true }), 'the-master', ['j1']))).toEqual([])
  })
})

describe('sameAddress', () => {
  it('reads two addresses as one account’s whatever their case and spaces, and never two blanks', () => {
    expect(sameAddress(' Luis@Click.test', 'luis@click.test ')).toBe(true)
    expect(sameAddress('luis@click.test', 'pat@click.test')).toBe(false)
    expect(sameAddress('', '')).toBe(false)
    expect(sameAddress(null, undefined)).toBe(false)
  })
})
