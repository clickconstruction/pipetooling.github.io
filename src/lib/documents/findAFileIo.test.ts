/**
 * The io half of Find a file (v2.6369): both searches asked at once, the box hearing the index's hits before Drive has
 * answered, Drive's finds behind them, and either side refusing costing that side alone. Made-up names only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchJobFiles } from './findAFileIo'

const calls = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: { rpc: calls.rpc, functions: { invoke: calls.invoke } },
}))

const indexRow = (id: string) => ({ drive_file_id: id, name: `${id}.pdf`, mime: 'application/pdf', bytes: 10, modified_at: '2026-10-14T15:00:00Z', path: '', headline: 'the <mark>rock</mark> clause' })
const driveHit = (id: string) => ({ id, name: `${id}.pdf`, mimeType: 'application/pdf', size: '10', modifiedTime: '2026-10-14T15:00:00Z', webViewLink: `https://drive.google.com/file/d/${id}/view`, home: null, path: '' })

beforeEach(() => {
  calls.rpc.mockReset()
  calls.invoke.mockReset()
})

describe('searchJobFiles', () => {
  it('asks Drive at once, tells the box the index’s hits before Drive answers, then answers both with the index’s first', async () => {
    calls.rpc.mockResolvedValue({ data: [indexRow('in-index')], error: null })
    let answerDrive: (v: unknown) => void = () => {}
    calls.invoke.mockReturnValue(new Promise((resolve) => {
      answerDrive = resolve
    }))
    const first = vi.fn()
    const answer = searchJobFiles('rock clause', first)
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(1))
    expect(calls.invoke).toHaveBeenCalledTimes(1)
    expect(first.mock.calls[0]![0].hits.map((h: { id: string }) => h.id)).toEqual(['in-index'])
    answerDrive({ data: { hits: [driveHit('in-index'), driveHit('in-drive')], more: true, noRoot: false }, error: null })
    const read = await answer
    expect(read.hits.map((h) => h.id)).toEqual(['in-index', 'in-drive'])
    expect(read).toMatchObject({ source: 'index', more: true })
  })

  it('an index with nothing tells the box nothing first, and Drive’s finds are the answer', async () => {
    calls.rpc.mockResolvedValue({ data: [], error: null })
    calls.invoke.mockResolvedValue({ data: { hits: [driveHit('in-drive')], more: false, noRoot: false }, error: null })
    const first = vi.fn()
    const read = await searchJobFiles('rock clause', first)
    expect(first).not.toHaveBeenCalled()
    expect(read.source).toBe('drive')
    expect(read.hits.map((h) => h.id)).toEqual(['in-drive'])
  })

  it('Drive refusing costs the floor alone while the index answered; with nothing from either, the refusal is the answer', async () => {
    calls.rpc.mockResolvedValue({ data: [indexRow('in-index')], error: null })
    calls.invoke.mockResolvedValue({ data: { error: 'Office only.' }, error: null })
    const read = await searchJobFiles('rock clause')
    expect(read.hits.map((h) => h.id)).toEqual(['in-index'])
    calls.rpc.mockResolvedValue({ data: null, error: { message: 'no such function' } })
    await expect(searchJobFiles('rock clause')).rejects.toThrow()
  })
})
