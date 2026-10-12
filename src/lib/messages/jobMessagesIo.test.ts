/**
 * Messages cut 10, J2: one Pipeline job's lines for its Job activity (`loadJobMessages`). A stand-in client applies the
 * query's own filters to a few rows, so the test reads what each query asks for and what comes back: the job's lines,
 * and while it is open the customer's lines tied to no job since it began.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, queries: [] as Array<{ table: string; ops: Array<[string, unknown[]]> }> }))

vi.mock('../supabase', () => {
  const pass = (r: Row, [op, args]: [string, unknown[]]) => {
    const [col, val] = args as [string, unknown]
    if (op === 'eq') return r[col] === val
    if (op === 'neq') return r[col] !== val
    if (op === 'is') return (r[col] ?? null) === val
    if (op === 'in') return (val as unknown[]).includes(r[col])
    if (op === 'gte') return String(r[col]) >= String(val)
    return true
  }
  return {
    supabase: {
      from: (table: string) => {
        const q = { table, ops: [] as Array<[string, unknown[]]> }
        db.queries.push(q)
        const builder: Record<string | symbol, unknown> = new Proxy(
          {},
          {
            get: (_t, prop) =>
              prop === 'then'
                ? (resolve: (v: unknown) => void) => resolve({ data: (db.tables[table] ?? []).filter((r) => q.ops.every((o) => pass(r, o))), error: null })
                : (...args: unknown[]) => {
                    q.ops.push([String(prop), args])
                    return builder
                  },
          },
        )
        return builder
      },
    },
  }
})

import { loadJobMessages } from './messagesIo'

const message = (id: string, over: Row): Row => ({
  id,
  contact_id: 'c-dana',
  channel_id: null,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: 'jl-1312',
  channel: 'text',
  direction: 'in',
  who_user_id: null,
  who_text: '',
  at: '2026-10-05T14:04:00Z',
  subject: null,
  body: 'Great. Gate code is 4471.',
  optout_line: null,
  back_on: null,
  back_by: null,
  duration_seconds: null,
  summary: null,
  transcript: null,
  ...over,
})

beforeEach(() => {
  db.queries.length = 0
  db.tables = {
    messages: [
      message('m-tied-in', {}),
      message('m-tied-out', { direction: 'out', who_user_id: 'u-luis', at: '2026-10-05T14:02:00Z', body: 'On our way.' }),
      message('m-untied', { jobs_ledger_id: null, at: '2026-10-08T01:30:00Z', body: 'See you Thursday.' }),
      message('m-untied-old', { jobs_ledger_id: null, at: '2026-09-01T12:00:00Z', body: 'Last summer.' }),
      message('m-untied-note', { jobs_ledger_id: null, channel: 'note', direction: 'team', who_text: 'Rosa', at: '2026-10-08T02:00:00Z', body: 'Texts after 5.' }),
      message('m-hector', { contact_id: 'c-hector', jobs_ledger_id: null, at: '2026-10-08T03:00:00Z', body: 'Trencher free Thursday.' }),
      message('m-other-job', { jobs_ledger_id: 'jl-1298', at: '2026-10-08T04:00:00Z', body: 'Water heater.' }),
    ],
    contact_jobs: [
      { contact_id: 'c-dana', jobs_ledger_id: 'jl-1312' },
      { contact_id: 'c-hector', jobs_ledger_id: 'jl-1312' },
    ],
    contacts: [
      { id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', goes_by: null },
      { id: 'c-hector', kind: 'trade', name: 'Hector Ruiz', goes_by: null },
    ],
    users: [{ id: 'u-luis', name: 'Luis' }],
  }
})

const job = { id: 'jl-1312', status: 'working', createdAt: '2026-10-01T12:00:00Z' }

describe('loadJobMessages (cut 10, J2)', () => {
  it('reads the job’s lines and the customer’s untied lines since it began, with our names', async () => {
    const lines = await loadJobMessages(job)
    expect(lines.map((m) => [m.id, m.who, m.tied])).toEqual([
      ['m-tied-out', 'Luis', true],
      ['m-tied-in', 'Dana', true],
      ['m-untied', 'Dana', false],
    ])
  })

  it('asks for the job’s lines by the job, and the untied ones by person, with no job, no team note, since the start', async () => {
    await loadJobMessages(job)
    const reads = db.queries.filter((q) => q.table === 'messages')
    expect(reads[0]?.ops.find(([op]) => op === 'eq')).toEqual(['eq', ['jobs_ledger_id', 'jl-1312']])
    expect(String(reads[0]?.ops.find(([op]) => op === 'select')?.[1][0])).toContain('duration_seconds, summary, transcript')
    const untied = reads[1]?.ops.filter(([op]) => op !== 'select' && op !== 'order' && op !== 'limit')
    expect(untied).toEqual([
      ['in', ['contact_id', ['c-dana']]],
      ['is', ['bid_id', null]],
      ['is', ['project_id', null]],
      ['is', ['jobs_ledger_id', null]],
      ['neq', ['direction', 'team']],
      ['gte', ['at', '2026-10-01T12:00:00Z']],
    ])
  })

  it('reads only the tied lines once the job is paid', async () => {
    const lines = await loadJobMessages({ ...job, status: 'paid' })
    expect(lines.map((m) => m.id)).toEqual(['m-tied-out', 'm-tied-in'])
    expect(db.queries.some((q) => q.table === 'contact_jobs')).toBe(false)
  })
})
