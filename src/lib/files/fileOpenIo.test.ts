import { beforeEach, describe, expect, it, vi } from 'vitest'

const fn = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { functions: fn } }))

import { fileTarget } from './fileOpenIo'

const JOB = '7d3c2a10-4b5e-4f60-9a7b-1c2d3e4f5a6b'
const DRIVE = '1AbC-dEf_GhIjKlMnOp'
const VIEW = `https://drive.google.com/file/d/${DRIVE}/view`
const refused = (status: number) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status } } })

beforeEach(() => fn.invoke.mockReset())

describe('fileTarget for a file in a job’s Drive folder (cut 7d)', () => {
  it('asks drive-link’s office door to open it with its job, and goes to Drive’s viewer', async () => {
    fn.invoke.mockResolvedValue({ data: { url: VIEW }, error: null })
    expect(await fileTarget({ source: 'drive', id: `project:${JOB}:${DRIVE}` })).toEqual({ url: VIEW })
    expect(fn.invoke).toHaveBeenCalledWith('drive-link', { body: { action: 'open', job: { project_id: JOB }, driveFileId: DRIVE } })
  })

  it('names the job the door takes for a bid and a Pipeline job', async () => {
    fn.invoke.mockResolvedValue({ data: { url: VIEW }, error: null })
    await fileTarget({ source: 'drive', id: `bid:${JOB}:${DRIVE}` })
    await fileTarget({ source: 'drive', id: `pipeline:${JOB}:${DRIVE}` })
    expect(fn.invoke.mock.calls.map((c) => (c[1] as { body: { job: unknown } }).body.job)).toEqual([{ bid_id: JOB }, { jobs_ledger_id: JOB }])
  })

  it('reads the door’s refusals as not yours, and anything else as not here', async () => {
    fn.invoke.mockResolvedValue(refused(403))
    expect(await fileTarget({ source: 'drive', id: `project:${JOB}:${DRIVE}` })).toEqual({ problem: 'notYours' })
    fn.invoke.mockResolvedValue(refused(401))
    expect(await fileTarget({ source: 'drive', id: `project:${JOB}:${DRIVE}` })).toEqual({ problem: 'notYours' })
    fn.invoke.mockResolvedValue(refused(409))
    expect(await fileTarget({ source: 'drive', id: `project:${JOB}:${DRIVE}` })).toEqual({ problem: 'notHere' })
    fn.invoke.mockResolvedValue({ data: { url: 'javascript:alert(1)' }, error: null })
    expect(await fileTarget({ source: 'drive', id: `project:${JOB}:${DRIVE}` })).toEqual({ problem: 'notHere' })
  })

  it('asks nothing for an id that is not a job and a file', async () => {
    expect(await fileTarget({ source: 'drive', id: DRIVE })).toEqual({ problem: 'notHere' })
    expect(fn.invoke).not.toHaveBeenCalled()
  })
})
