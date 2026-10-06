import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A paper signed by two, filed for several jobs (v2.4657): every covered row gets both frames,
 * a job added later copies the paper's second signature, and the Second signer box starts with
 * the one the anchor job's draft names. The writes run against a recording fake of supabase.
 */
type Step = { method: string; args: unknown[] }
type Call = { table: string; steps: Step[] }
const calls: Call[] = []
let rows: Array<Record<string, unknown>> = []

const stepArg = (steps: Step[], method: string) => steps.find((s) => s.method === method)?.args
function respond(table: string, steps: Step[]): unknown {
  if (table !== 'job_contracts') return null
  const insert = stepArg(steps, 'insert')?.[0] as Record<string, unknown> | undefined
  const update = stepArg(steps, 'update')?.[0] as Record<string, unknown> | undefined
  const single = steps.some((s) => s.method === 'single')
  if (insert && single) return { id: `new-${String(insert.job_id)}`, ...insert }
  if (update && single) {
    const id = steps.find((s) => s.method === 'eq' && s.args[0] === 'id')?.args[1]
    return { ...rows.find((r) => r.id === id), ...update }
  }
  if (update) return null
  const jobIds = steps.find((s) => s.method === 'in' && s.args[0] === 'job_id')?.args[1] as string[] | undefined
  return jobIds ? rows.filter((r) => jobIds.includes(String(r.job_id))) : []
}
function recorder(table: string) {
  const call: Call = { table, steps: [] }
  calls.push(call)
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: respond(table, call.steps), error: null })
        }
        return (...a: unknown[]) => {
          call.steps.push({ method: String(prop), args: a })
          return p
        }
      },
    },
  )
  return p
}
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => recorder(table),
    storage: { from: () => ({ copy: () => Promise.resolve({ error: null }), upload: () => Promise.resolve({ error: null }) }) },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))

import { addJobToPaper, anchorCoSignerName, fileContractForJobs } from './jobContractCoversWrite'
import type { CoversPaper } from './jobContractCovers'
import type { JobContractRow } from './jobContractLifecycle'

/** The payloads written to job_contracts by insert or update, in order. */
const writes = () =>
  calls
    .filter((c) => c.table === 'job_contracts')
    .map((c) => (stepArg(c.steps, 'insert') ?? stepArg(c.steps, 'update'))?.[0] as Record<string, unknown> | undefined)
    .filter((w): w is Record<string, unknown> => w != null)

const draftOn = (jobId: string, extra: Record<string, unknown> = {}) => ({ id: `d-${jobId}`, job_id: jobId, status: 'draft', voided_at: null, co_signer_name: null, ...extra })

beforeEach(() => {
  calls.length = 0
  rows = []
})

describe('fileContractForJobs — one paper, several jobs', () => {
  it('writes both frames on every job; a draft keeps the second signer it named', async () => {
    rows = [draftOn('j1', { co_signer_name: 'Alex Owner' })]
    const r = await fileContractForJobs({ jobIds: ['j1', 'j2'], signerName: 'Sam Owner', coSignerName: 'Alexandra Owner', signedOn: '2026-10-02', link: 'https://docs.google.com/document/d/abc', file: null, authUserId: 'u1' })
    expect(r.filed).toBe(2)
    const [onDraft, onNew] = writes()
    const second = { co_signer_printed_name: 'Alexandra Owner', co_signed_at: '2026-10-02T12:00:00Z', co_signer_mode: 'paper', co_signer_consented_at: null }
    expect(onDraft).toMatchObject({ status: 'signed', signer_printed_name: 'Sam Owner', signer_mode: 'paper', co_signer_name: 'Alex Owner', ...second })
    expect(onNew).toMatchObject({ job_id: 'j2', signer_printed_name: 'Sam Owner', co_signer_name: 'Alexandra Owner', ...second })
  })

  it('files one signer when the Second signer box is empty, as before', async () => {
    await fileContractForJobs({ jobIds: ['j1'], signerName: 'Sam Owner', coSignerName: '  ', signedOn: '', link: 'https://docs.google.com/document/d/abc', file: null, authUserId: 'u1' })
    const [w] = writes()
    expect(w).toMatchObject({ signer_printed_name: 'Sam Owner', signer_mode: 'paper' })
    expect(Object.keys(w!).filter((k) => k.startsWith('co_'))).toEqual([])
  })
})

describe('addJobToPaper — a job added to a paper on file', () => {
  const paperOf = (source: Record<string, unknown>): CoversPaper =>
    ({ key: 'g1', source, jobIds: ['j1'], signedAt: null, signerName: null, documentUrl: null, hasUpload: false }) as unknown as CoversPaper
  const source = {
    id: 'g1',
    job_id: 'j1',
    status: 'signed',
    voided_at: null,
    covers_group_id: 'g1',
    signer_mode: 'paper',
    signer_printed_name: 'Sam Owner',
    signed_at: '2026-09-30T12:00:00Z',
    paper_signed_on: '2026-09-30',
    signed_document_url: 'https://docs.google.com/document/d/abc',
    paper_upload_path: null,
    co_signer_name: 'Alex Owner',
    co_signer_printed_name: 'Alex Owner',
    co_signed_at: '2026-09-30T12:00:00Z',
    co_signer_mode: 'paper',
  }

  it("copies the paper's second signature, with its stamp", async () => {
    await addJobToPaper(paperOf(source), 'j5', 'u1')
    const [filed, stamped] = writes()
    expect(filed).toMatchObject({ job_id: 'j5', signer_printed_name: 'Sam Owner', co_signer_printed_name: 'Alex Owner', co_signer_mode: 'paper' })
    expect(stamped).toEqual({ covers_group_id: 'g1', signed_at: '2026-09-30T12:00:00Z', co_signed_at: '2026-09-30T12:00:00Z' })
  })

  it('leaves a second frame signed through a link with its own job', async () => {
    await addJobToPaper(paperOf({ ...source, co_signer_mode: 'draw' }), 'j5', 'u1')
    const [filed, stamped] = writes()
    expect(Object.keys(filed!).filter((k) => k.startsWith('co_'))).toEqual([])
    expect(stamped).toEqual({ covers_group_id: 'g1', signed_at: '2026-09-30T12:00:00Z' })
  })
})

describe('anchorCoSignerName — what the Second signer box starts with', () => {
  const asRows = (list: Array<Record<string, unknown>>) => list as unknown as JobContractRow[]

  it("names the second signer the anchor job's draft names", () => {
    expect(anchorCoSignerName(asRows([draftOn('j1', { co_signer_name: ' Alex Owner ' })]), 'j1')).toBe('Alex Owner')
    expect(anchorCoSignerName(asRows([draftOn('j1')]), 'j1')).toBe('')
  })

  it("reads a copy out on paper too, but not one already signed there, another job's, or a void", () => {
    const out = { id: 's1', job_id: 'j1', status: 'sent', sent_channel: 'pdf_email', voided_at: null, co_signer_name: 'Alex Owner', co_signed_at: null, co_signer_printed_name: null }
    expect(anchorCoSignerName(asRows([out]), 'j1')).toBe('Alex Owner')
    expect(anchorCoSignerName(asRows([{ ...out, co_signed_at: '2026-10-01T15:00:00Z', co_signer_printed_name: 'Alex Owner' }]), 'j1')).toBe('')
    expect(anchorCoSignerName(asRows([draftOn('j2', { co_signer_name: 'Alex Owner' })]), 'j1')).toBe('')
    expect(anchorCoSignerName(asRows([draftOn('j1', { co_signer_name: 'Alex Owner', voided_at: '2026-10-01T00:00:00Z' })]), 'j1')).toBe('')
    expect(anchorCoSignerName(asRows([draftOn('j1', { co_signer_name: 'Alex Owner' })]), null)).toBe('')
  })
})
