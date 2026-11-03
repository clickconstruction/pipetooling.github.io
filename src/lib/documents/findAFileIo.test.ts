/**
 * The io half of Find a file (v2.6369): both searches asked at once, the box hearing the index's hits before Drive has
 * answered, Drive's finds behind them, and either side refusing costing that side alone. Made-up names only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchJobFiles } from './findAFileIo'

const calls = vi.hoisted(() => ({
  index: vi.fn(),
  drive: vi.fn(),
}))

// From PR 4 the index answers through the function too (`search_index`), and Drive's search is its `search`.
vi.mock('../supabase', () => ({
  supabase: { functions: { invoke: (_fn: string, opts: { body: { action: string } }) => (opts.body.action === 'search_index' ? calls.index() : calls.drive()) } },
}))

const indexRow = (id: string) => ({ drive_file_id: id, name: `${id}.pdf`, mime: 'application/pdf', bytes: 10, modified_at: '2026-10-14T15:00:00Z', path: '', headline: 'the <mark>rock</mark> clause' })
const driveHit = (id: string) => ({ id, name: `${id}.pdf`, mimeType: 'application/pdf', size: '10', modifiedTime: '2026-10-14T15:00:00Z', webViewLink: `https://drive.google.com/file/d/${id}/view`, home: null, path: '' })

const indexAnswer = (rows: unknown[]) => ({ data: { rows, meaning: false, note: null }, error: null })

beforeEach(() => {
  calls.index.mockReset()
  calls.drive.mockReset()
})

describe('searchJobFiles', () => {
  it('asks Drive at once, tells the box the index’s hits before Drive answers, then answers both with the index’s first', async () => {
    calls.index.mockResolvedValue(indexAnswer([indexRow('in-index')]))
    let answerDrive: (v: unknown) => void = () => {}
    calls.drive.mockReturnValue(new Promise((resolve) => {
      answerDrive = resolve
    }))
    const first = vi.fn()
    const answer = searchJobFiles('rock clause', first)
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(1))
    expect(calls.drive).toHaveBeenCalledTimes(1)
    expect(first.mock.calls[0]![0].hits.map((h: { id: string }) => h.id)).toEqual(['in-index'])
    answerDrive({ data: { hits: [driveHit('in-index'), driveHit('in-drive')], more: true, noRoot: false }, error: null })
    const read = await answer
    expect(read.hits.map((h) => h.id)).toEqual(['in-index', 'in-drive'])
    expect(read).toMatchObject({ source: 'index', more: true })
  })

  it('an index with nothing tells the box nothing first, and Drive’s finds are the answer', async () => {
    calls.index.mockResolvedValue(indexAnswer([]))
    calls.drive.mockResolvedValue({ data: { hits: [driveHit('in-drive')], more: false, noRoot: false }, error: null })
    const first = vi.fn()
    const read = await searchJobFiles('rock clause', first)
    expect(first).not.toHaveBeenCalled()
    expect(read.source).toBe('drive')
    expect(read.hits.map((h) => h.id)).toEqual(['in-drive'])
  })

  it('Drive refusing costs the floor alone while the index answered; with nothing from either, the refusal is the answer', async () => {
    calls.index.mockResolvedValue(indexAnswer([indexRow('in-index')]))
    calls.drive.mockResolvedValue({ data: { error: 'Office only.' }, error: null })
    const read = await searchJobFiles('rock clause')
    expect(read.hits.map((h) => h.id)).toEqual(['in-index'])
    calls.index.mockResolvedValue({ data: { error: 'The index did not answer.' }, error: null })
    await expect(searchJobFiles('rock clause')).rejects.toThrow()
  })

  it('hits by meaning alone go to the box first and then behind Drive’s finds, which a loose match must never hide (PR 4)', async () => {
    calls.index.mockResolvedValue(indexAnswer([{ ...indexRow('by-meaning'), by: 'meaning', headline: null, chunk_text: 'The owner accepts the added cost.' }]))
    calls.drive.mockResolvedValue({ data: { hits: [driveHit('in-drive')], more: false, noRoot: false }, error: null })
    const first = vi.fn()
    const read = await searchJobFiles('extra rock', first)
    expect(first.mock.calls[0]![0].hits.map((h: { id: string }) => h.id)).toEqual(['by-meaning'])
    expect(read.hits.map((h) => h.id)).toEqual(['in-drive', 'by-meaning'])
  })
})
