import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Each table's rows, each read's filters, and what `drive-link` answers. */
const db = vi.hoisted(() => ({
  rows: {} as Record<string, unknown>,
  errors: {} as Record<string, unknown>,
  reads: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
  drive: { data: null as unknown, error: null as unknown },
  invoked: [] as Array<[string, unknown]>,
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const read = { table, calls: [] as Array<[string, unknown[]]> }
    db.reads.push(read)
    const answer = () => ({ data: db.rows[table] ?? [], error: db.errors[table] ?? null })
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(answer()).then(resolve, reject)
          return (...args: unknown[]) => {
            read.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      functions: {
        invoke: (name: string, opts: { body: unknown }) => {
          db.invoked.push([name, opts.body])
          return Promise.resolve(db.drive)
        },
      },
    },
  }
})

import { appPapersFromRows, arrivedFromRows, driveJobOf, loadJobFileSources, loadJobFiles, sentFilesFromRows } from './jobFilesIo'

const KB = 1024
const callsOf = (table: string) => db.reads.filter((r) => r.table === table).flatMap((r) => r.calls)

beforeEach(() => {
  db.rows = {}
  db.errors = {}
  db.reads = []
  db.drive = { data: { files: [], capped: false }, error: null }
  db.invoked = []
})

describe('the rows as the one list takes them', () => {
  it('names the papers a GC project has, our contract the newest one sent', () => {
    expect(
      appPapersFromRows({
        contracts: [
          { id: 'cs-1', file_name: 'Helotes contract.pdf', sent_on: '2026-09-01' },
          { id: 'cs-2', file_name: 'Helotes contract, rev 2.pdf', sent_on: '2026-09-19' },
        ],
        payApps: [{ id: 'pa-3', number: 3, sent_on: '2026-10-01' }],
        changeOrders: [
          { id: 'co-2', number: 2, sent_on: '2026-09-28' },
          { id: 'co-3', number: 3, sent_on: null },
        ],
        packages: [
          { id: 'pk-site', trade: 'Sitework', ours: false, awarded_on: '2026-09-20' },
          { id: 'pk-plumb', trade: 'Plumbing', ours: true, awarded_on: '2026-09-20' },
          { id: 'pk-roof', trade: 'Roofing', ours: false, awarded_on: null },
        ],
        hasSchedule: true,
      }),
    ).toEqual([
      { id: 'cs-2', paper: 'contract', name: 'Helotes contract, rev 2.pdf', bytes: null, at: '2026-09-19' },
      { id: 'pa-3', paper: 'payapp', name: 'Pay application 3', bytes: null, at: '2026-10-01' },
      { id: 'co-2', paper: 'co', name: 'Change order 2', bytes: null, at: '2026-09-28' },
      { id: 'pk-site', paper: 'sow', name: 'Statement of work, Sitework', bytes: null, at: '2026-09-20' },
      { id: 'schedule', paper: 'schedule', name: 'Schedule', bytes: null, at: null },
    ])
  })

  it('has no papers for a project with nothing sent, awarded or scheduled', () => {
    expect(appPapersFromRows({ contracts: [], payApps: [], changeOrders: [{ id: 'co-1', number: 1, sent_on: null }], packages: [], hasSchedule: false })).toEqual([])
  })

  it('reads the files kept on a sent copy, and skips one named but not kept', () => {
    expect(
      sentFilesFromRows([
        {
          id: 'sd-1',
          sent_at: '2026-10-09T21:42:00Z',
          attachments: [
            { name: 'Bid tab, Sitework.pdf', path: 'sd-1/bid-tab.pdf', type: 'application/pdf', bytes: 96 * KB },
            { name: 'Too big.zip', path: '', type: 'application/zip' },
            'not a file',
          ],
        },
        { id: 'sd-2', sent_at: '2026-10-10T15:00:00Z', attachments: null },
        { id: 'sd-3', sent_at: '2026-10-11T15:00:00Z', attachments: [{ path: 'sd-3/a', bytes: -1 }] },
      ]),
    ).toEqual([
      { sentId: 'sd-1', name: 'Bid tab, Sitework.pdf', path: 'sd-1/bid-tab.pdf', type: 'application/pdf', bytes: 96 * KB, sent_at: '2026-10-09T21:42:00Z' },
      { sentId: 'sd-3', name: 'Attachment', path: 'sd-3/a', type: '', bytes: null, sent_at: '2026-10-11T15:00:00Z' },
    ])
  })

  it('reads a file that came in with its type and the time of its line', () => {
    expect(
      arrivedFromRows([{ id: 'att-1', name: 'Hillside COI 2027.pdf', mime: 'application/pdf', size_bytes: 380 * KB, drive_file_id: null, messages: { at: '2026-10-12T14:12:00Z' } }]),
    ).toEqual([{ id: 'att-1', name: 'Hillside COI 2027.pdf', bytes: 380 * KB, mime: 'application/pdf', drive_file_id: null, at: '2026-10-12T14:12:00Z' }])
  })

  it('asks drive-link for a job by the one of its three ids', () => {
    expect(driveJobOf({ kind: 'bid', id: 'b482' })).toEqual({ bid_id: 'b482' })
    expect(driveJobOf({ kind: 'project', id: 'p47' })).toEqual({ project_id: 'p47' })
    expect(driveJobOf({ kind: 'pipeline', id: 'j1077' })).toEqual({ jobs_ledger_id: 'j1077' })
  })
})

describe('the reads', () => {
  it('reads all six of a GC project’s sources, and the list shows a file saved to Drive once', async () => {
    db.rows = {
      gc_owner_contract_sends: [{ id: 'cs-1', file_name: 'Our contract.pdf', sent_on: '2026-09-19' }],
      gc_owner_pay_apps: [],
      gc_change_orders: [],
      gc_trade_packages: [],
      gc_schedule_activities: [{ id: 'act-1' }],
      gc_plan_sets: [{ id: 'set-2', label: 'Helotes plans, rev 2', drive_url: 'https://drive.google.com/drive/folders/helotes-rev-2', issued_on: '2026-10-02' }],
      gc_trade_files: [],
      gc_projects: { billing_job_id: 'j-helotes' },
      sent_documents: [{ id: 'sd-1', sent_at: '2026-10-09T21:42:00Z', attachments: [{ name: 'Rock clause.pdf', path: 'sd-1/rock.pdf', type: 'application/pdf', bytes: 640 * KB }] }],
      message_attachments: [
        { id: 'att-1', name: 'Hillside COI 2027.pdf', mime: 'application/pdf', size_bytes: 380 * KB, drive_file_id: 'drv-coi-2027', messages: { at: '2026-10-12T14:12:00Z' } },
      ],
    }
    db.drive = {
      data: { files: [{ id: 'drv-coi-2027', name: 'Hillside COI 2027.pdf', bytes: 380 * KB, mime: 'application/pdf', half: 'team_only', url: 'https://drive.google.com/file/d/drv-coi-2027/view', modified: '2026-10-12T15:00:00Z' }], capped: false },
      error: null,
    }

    const read = await loadJobFileSources({ kind: 'project', id: 'p47' })
    expect(read.driveFailed).toBe(false)
    expect(db.invoked).toEqual([['drive-link', { action: 'list', job: { project_id: 'p47' } }]])
    expect(read.sources.papers?.map((p) => p.name)).toEqual(['Our contract.pdf', 'Schedule'])
    expect(read.sources.planSets).toHaveLength(1)
    expect(read.sources.sent?.map((s) => s.name)).toEqual(['Rock clause.pdf'])
    // What we sent about the project is found by its billing job.
    expect(callsOf('sent_documents')).toContainEqual(['contains', ['job_ids', ['j-helotes']]])
    // Only a kept file that came in: never a link, never one we sent, never one left in Gmail.
    expect(callsOf('message_attachments')).toEqual(
      expect.arrayContaining([
        ['eq', ['messages.project_id', 'p47']],
        ['eq', ['kind', 'file']],
        ['is', ['sent_as', null]],
        ['or', ['bucket_path.not.is.null,drive_file_id.not.is.null']],
      ]),
    )

    const { files } = await loadJobFiles({ kind: 'project', id: 'p47' })
    expect(files.filter((f) => f.name === 'Hillside COI 2027.pdf')).toEqual([expect.objectContaining({ key: 'drive:drv-coi-2027', source: 'arrived', home: 'team_only' })])
  })

  it('keeps the database’s files when Drive does not answer, and says so', async () => {
    db.rows = { sent_documents: [{ id: 'sd-1', sent_at: '2026-10-09T21:42:00Z', attachments: [{ name: 'Bid tab.pdf', path: 'sd-1/tab.pdf', type: 'application/pdf', bytes: 96 * KB }] }] }
    db.drive = { data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { json: () => Promise.resolve({ error: 'That job has no Drive folder yet.' }) } } }
    const read = await loadJobFiles({ kind: 'bid', id: 'b482' })
    expect(read.driveFailed).toBe(true)
    expect(read.files.map((f) => f.name)).toEqual(['Bid tab.pdf'])
  })

  it('reads a bid’s sent copies by the bid, and a bid has no papers, plan sets or trades’ files', async () => {
    await loadJobFileSources({ kind: 'bid', id: 'b482' })
    expect(callsOf('sent_documents')).toContainEqual(['eq', ['bid_id', 'b482']])
    expect(callsOf('message_attachments')).toContainEqual(['eq', ['messages.bid_id', 'b482']])
    expect(db.reads.map((r) => r.table)).not.toEqual(expect.arrayContaining(['gc_plan_sets']))
    expect(db.reads.map((r) => r.table)).not.toEqual(expect.arrayContaining(['gc_trade_files']))
    expect(db.reads.map((r) => r.table)).not.toEqual(expect.arrayContaining(['gc_owner_pay_apps']))
  })

  it('reads a Pipeline job’s sent copies by the job, and a project with no billing job has sent nothing', async () => {
    await loadJobFileSources({ kind: 'pipeline', id: 'j1077' })
    expect(callsOf('sent_documents')).toContainEqual(['contains', ['job_ids', ['j1077']]])
    expect(callsOf('message_attachments')).toContainEqual(['eq', ['messages.jobs_ledger_id', 'j1077']])

    db.reads = []
    db.rows = { gc_projects: { billing_job_id: null } }
    const read = await loadJobFileSources({ kind: 'project', id: 'p42' })
    expect(read.sources.sent).toEqual([])
    expect(db.reads.map((r) => r.table)).not.toContain('sent_documents')
  })

  it('a table that refuses fails the read in words', async () => {
    db.errors = { gc_plan_sets: { message: 'permission denied for table gc_plan_sets', code: '42501' } }
    await expect(loadJobFileSources({ kind: 'project', id: 'p47' })).rejects.toThrow()
  })
})
