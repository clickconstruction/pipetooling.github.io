// @vitest-environment jsdom
/**
 * Render smoke for Print blank stickers (punch list #329, PR 2, v2.7272) through the browser's print window, where the
 * test's browser has no USB: the ask with its quick counts and Copies of each; a count out of range and a role that may
 * not mint each hold the press with the database's words; the press mints the run and the strips print once they are
 * on the page; a refusal is said and nothing prints; a run handed in prints and mints nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { MintedRun, StickerRunRequest } from '../../lib/materials/stickerRun'

vi.mock('../../lib/materials/stickerRunsIo', () => ({
  mintStickerRun: vi.fn(),
  fetchLastStickerNumber: vi.fn(async () => 100),
  fetchStickerRuns: vi.fn(async () => []),
}))
vi.mock('../../lib/materials/photoShare', () => ({ downloadFile: vi.fn() }))
import { downloadFile } from '../../lib/materials/photoShare'
import PrintStickersModal from './PrintStickersModal'

/** A made-up run for Juniper Ridge: whatever is asked, numbered from 0101. */
function mintedRun(request: StickerRunRequest): MintedRun {
  const stickers = Array.from({ length: request.count }, (_, i) => ({ id: `s-${101 + i}`, number: 101 + i, code: `4F2A9C${String(i).padStart(2, '0')}` }))
  return { run: { id: 'run-1', jobId: request.jobId, count: request.count, firstNumber: 101, lastNumber: 100 + request.count, copies: request.copies, printedByName: 'Dana', printedAt: '2026-11-14T16:00:00Z' }, stickers }
}

function setup(over: { role?: string; mint?: (r: StickerRunRequest) => Promise<MintedRun>; last?: () => Promise<number | null>; run?: MintedRun & { title: string } } = {}) {
  const print = vi.fn()
  const mint = vi.fn(over.mint ?? (async (r: StickerRunRequest) => mintedRun(r)))
  const onMinted = vi.fn()
  renderWithProviders(
    <PrintStickersModal jobId="job-juniper" jobLabel="JP1204 · Juniper Ridge" role={over.role ?? 'assistant'} run={over.run ? { run: over.run.run, stickers: over.run.stickers, title: over.run.title } : null} onClose={() => {}} onMinted={onMinted} mint={mint} lastNumber={over.last ?? (async () => 100)} print={print} />,
  )
  return { print, mint, onMinted }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.mocked(downloadFile).mockReset()
})

describe('PrintStickersModal · the ask', () => {
  it('opens on 200 with the quick counts, Copies of each, the last run and the browser note', async () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Print blank stickers' })).toBeTruthy()
    expect(screen.getAllByTestId('stickers-count-preset').map((b) => b.textContent)).toEqual(['30', '60', '100', '200'])
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('200 stickers, one strip each.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 stickers')
    expect(screen.getByTestId('stickers-copies').textContent).toBe('1')
    await waitFor(() => expect(screen.getByTestId('stickers-last-run').textContent).toContain('The last run ended at 0100.'))
    expect(screen.getByTestId('stickers-last-run').textContent).toContain('go on JP1204 · Juniper Ridge')
    // no USB in this browser: the way out is said, and the test strip and the setup steps are still offered
    expect(screen.getByTestId('stickers-no-usb')).toBeTruthy()
    expect(screen.getByTestId('stickers-tape-setup').textContent).toContain('First time on this computer')
    expect(screen.getByTestId('stickers-test-strip').textContent).toBe('Print 1 test strip')
    expect(screen.queryByTestId('stickers-csv')).toBeNull()
  })

  it('a quick count and Copies of each change the press to sets, and the first run says so', async () => {
    setup({ last: async () => null })
    fireEvent.click(screen.getByRole('button', { name: '60' }))
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 60 sets')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('60 stickers, 2 strips each. 120 strips.')
    await waitFor(() => expect(screen.getByTestId('stickers-last-run').textContent).toContain('This is the first run. The numbers start at 0001.'))
    expect(localStorage.getItem('pt.labels.tapeCopies')).toBe('2')
  })

  it('a typed count out of range holds the press with the database’s words', () => {
    const { mint } = setup()
    fireEvent.change(screen.getByTestId('stickers-count-input'), { target: { value: '501' } })
    expect(screen.getByTestId('stickers-refusal').textContent).toBe('A run is 1 to 500 stickers.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print stickers')
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(mint).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('stickers-count-input'), { target: { value: '45' } })
    expect(screen.queryByTestId('stickers-refusal')).toBeNull()
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 45 stickers')
  })

  it('a role that may not mint reads why, and the press is dead', () => {
    const { mint } = setup({ role: 'estimator' })
    expect(screen.getByTestId('stickers-refusal').textContent).toBe('Only the office, a primary or a superintendent prints a run of stickers.')
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(mint).not.toHaveBeenCalled()
  })

  it('the test strip prints one strip that is not a sticker, and mints nothing', () => {
    const { print, mint } = setup()
    fireEvent.click(screen.getByTestId('stickers-test-strip'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(mint).not.toHaveBeenCalled()
    const strips = screen.getAllByTestId('stickers-tape')
    expect(strips).toHaveLength(1)
    expect(strips[0]!.textContent).toContain('0000')
    expect(strips[0]!.textContent).toContain('Test strip')
  })
})

describe('PrintStickersModal · the run', () => {
  it('the press mints the run as asked, the strips go on the page and print once, and the CSV writes the run', async () => {
    const { print, mint, onMinted } = setup()
    fireEvent.click(screen.getByRole('button', { name: '60' }))
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getAllByTestId('stickers-tape')).toHaveLength(60))
    expect(mint).toHaveBeenCalledWith({ jobId: 'job-juniper', count: 60, copies: 2 })
    expect(onMinted).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Stickers 0101 to 0160 · JP1204 · Juniper Ridge')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('0101 to 0160, 2 strips each. 120 strips.')
    // every sticker prints twice: its copy is on the page for the paper and hidden on the screen
    expect(screen.getAllByTestId('stickers-tape-copy')).toHaveLength(60)
    const first = screen.getAllByTestId('stickers-tape')[0]!
    expect(first.textContent).toContain('0101')
    expect(first.textContent).toContain('PRTS.CO/B/4F2A-9C00')
    expect(first.textContent).toContain('Scan for what is inside')
    expect(first.style.width).toBe('72mm')
    expect(first.style.height).toBe('24mm')
    // the ask is gone; the press prints the same run again, and the day is remembered
    expect(screen.queryByTestId('stickers-ask')).toBeNull()
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 60 sets, 0101 to 0160')
    expect(localStorage.getItem('pt.labels.tapePrintedYmd')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    fireEvent.click(screen.getByTestId('stickers-csv'))
    expect(downloadFile).toHaveBeenCalledTimes(1)
    const file = vi.mocked(downloadFile).mock.calls[0]![0] as File
    expect(file.name).toMatch(/^stickers-0101-0160-\d{4}-\d{2}-\d{2}\.csv$/)
    // a header row and sixty rows of four cells; the words themselves are the kernel's test
    expect(file.size).toBeGreaterThan(60 * 40)
  })

  it('a refusal is said in the database’s words, the ask stays and nothing prints', async () => {
    const { print } = setup({ mint: async () => { throw { message: 'A run is 1 to 500 stickers.', code: 'P0001' } } })
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-slip').textContent).toBe('The run was not made. No sticker was printed: A run is 1 to 500 stickers.'))
    expect(screen.getByTestId('stickers-ask')).toBeTruthy()
    expect(print).not.toHaveBeenCalled()
    expect(screen.queryAllByTestId('stickers-tape')).toHaveLength(0)
  })

  it('a gate refusal reads as the app says every refusal of reach, and nothing prints', async () => {
    const { print } = setup({ mint: async () => { throw { message: 'That job is not one you can reach.', code: '42501' } } })
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-slip').textContent).toContain('The run was not made. No sticker was printed.'))
    expect(screen.getByTestId('stickers-slip').textContent).toContain('access')
    expect(print).not.toHaveBeenCalled()
  })

  it('a run handed in opens on its strips, mints nothing, and the press prints it again', () => {
    const minted = mintedRun({ jobId: 'job-juniper', count: 3, copies: 1 })
    const { print, mint } = setup({ run: { ...minted, title: 'Run of 3 · 0101 to 0103' } })
    expect(screen.getByRole('dialog', { name: 'Run of 3 · 0101 to 0103' })).toBeTruthy()
    expect(screen.queryByTestId('stickers-ask')).toBeNull()
    expect(screen.getAllByTestId('stickers-tape')).toHaveLength(3)
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 3 stickers, 0101 to 0103')
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(mint).not.toHaveBeenCalled()
  })
})
