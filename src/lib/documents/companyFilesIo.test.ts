import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The company folder's io over the answer supabase-js really hands back (v2.6315): a refusal is `{ data: null, error }`
 * whose `error.context` is the function's Response, and a Response's body can be read once. v2.6309 read it twice, once
 * for the words and once for the reason, so the reason was always lost and the Company tab drew *no folder yet* as a
 * failed read, in red, with no way to Where files go.
 */

const fn = vi.hoisted(() => ({ answer: null as unknown, asks: [] as unknown[] }))

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: async (_name: string, opts: { body: unknown }) => {
        fn.asks.push(opts.body)
        return fn.answer
      },
    },
  },
}))

/** What supabase-js returns for a non-2xx answer: the error carries the Response itself, readable once. */
function refusal(status: number, body: Record<string, unknown>) {
  return {
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    },
  }
}

const aFile = (name: string, bytes = 'pdf') =>
  ({ name, type: 'application/pdf', size: bytes.length, arrayBuffer: async () => new TextEncoder().encode(bytes).buffer }) as unknown as File

beforeEach(() => {
  fn.answer = null
  fn.asks = []
})

describe('the company folder io', () => {
  it('reads the files and the folder from a good answer', async () => {
    fn.answer = { data: { files: [{ id: 'a', name: 'W-9.pdf' }], capped: false, folder: { id: 'F', url: 'https://drive.google.com/drive/folders/F' } }, error: null }
    const { loadCompanyFiles } = await import('./companyFilesIo')
    const read = await loadCompanyFiles()
    expect(read.folder).toEqual({ id: 'F', url: 'https://drive.google.com/drive/folders/F' })
    expect(read.files.map((f) => f.name)).toEqual(['W-9.pdf'])
    expect(fn.asks).toEqual([{ action: 'list_company' }])
  })

  it('keeps both the words and the reason of a refusal, so no folder yet reads as the empty state', async () => {
    fn.answer = refusal(409, { error: 'No company folder yet. Set it on Documents → Where files go.', why: 'no_company_folder' })
    const { loadCompanyFiles, CompanyFolderRefused } = await import('./companyFilesIo')
    const e = await loadCompanyFiles().catch((x: unknown) => x)
    expect(e).toBeInstanceOf(CompanyFolderRefused)
    expect((e as InstanceType<typeof CompanyFolderRefused>).why).toBe('no_company_folder')
    expect((e as Error).message).toBe('No company folder yet. Set it on Documents → Where files go.')
  })

  it('keeps a put’s refusal words and reason, and the transport’s words when the body says nothing', async () => {
    fn.answer = refusal(403, { error: 'The office puts papers in the company folder.' })
    const { putCompanyFile, CompanyFolderRefused } = await import('./companyFilesIo')
    const e = await putCompanyFile(aFile('COI.pdf')).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(CompanyFolderRefused)
    expect((e as Error).message).toBe('The office puts papers in the company folder.')
    expect((e as InstanceType<typeof CompanyFolderRefused>).why).toBeNull()
    fn.answer = { data: null, error: { message: 'Failed to send a request to the Edge Function' } }
    const lost = await putCompanyFile(aFile('COI.pdf')).catch((x: unknown) => x)
    expect((lost as Error).message).toBe('Failed to send a request to the Edge Function')
  })

  it('puts a file as base64 and answers its Drive id and link', async () => {
    fn.answer = { data: { driveFileId: 'd1', url: 'https://drive.google.com/file/d/d1/view' }, error: null }
    const { putCompanyFile } = await import('./companyFilesIo')
    expect(await putCompanyFile(aFile('W-9 2026.pdf', 'abc'))).toEqual({ driveFileId: 'd1', url: 'https://drive.google.com/file/d/d1/view' })
    expect(fn.asks[0]).toEqual({ action: 'put_company', name: 'W-9 2026.pdf', mime: 'application/pdf', base64: 'YWJj' })
  })
})
