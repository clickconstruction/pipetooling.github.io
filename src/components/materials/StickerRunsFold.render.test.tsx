// @vitest-environment jsdom
/**
 * Render smoke for the Runs fold (punch list #329, PR 2, v2.7272): each run with its range, its count, how many are on
 * boxes and not used, who printed and when; Reprint hands the whole run back and Print the rest the blank ones alone;
 * nothing drawn for a job with no run; a read that failed offers Retry.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { StickerRunWithStickers } from '../../lib/materials/stickerRunsIo'

vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchStickerRuns: vi.fn(async () => []) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
import StickerRunsFold from './StickerRunsFold'

/** Juniper Ridge: a run of 200 sets with 104 placed, one of them since marked lost, and an older run of 100 all blank. */
const big: StickerRunWithStickers = {
  run: { id: 'run-2', jobId: 'job-juniper', count: 200, firstNumber: 101, lastNumber: 300, copies: 2, printedByName: 'Dana', printedAt: '2026-11-12T16:00:00Z' },
  stickers: Array.from({ length: 200 }, (_, i) => ({ id: `s-${101 + i}`, number: 101 + i, code: `4F2A9C${String(i).padStart(2, '0')}`, containerId: i < 104 ? `box-${i}` : null, lostAt: i === 10 ? '2026-11-13T00:00:00Z' : null })),
}
const old: StickerRunWithStickers = {
  run: { id: 'run-1', jobId: 'job-juniper', count: 100, firstNumber: 1, lastNumber: 100, copies: 1, printedByName: '', printedAt: '2026-10-30T16:00:00Z' },
  stickers: Array.from({ length: 100 }, (_, i) => ({ id: `o-${1 + i}`, number: 1 + i, code: `9C184F${String(i).padStart(2, '0')}`, containerId: null, lostAt: null })),
}

afterEach(cleanup)

describe('StickerRunsFold', () => {
  it('lists each run with its words, and the presses hand back the whole run or the blank ones', async () => {
    const onPrint = vi.fn()
    renderWithProviders(<StickerRunsFold jobId="job-juniper" onPrint={onPrint} fetch={async () => [big, old]} />)
    const fold = await screen.findByTestId('sticker-runs-fold')
    expect(fold.textContent).toContain('2 runs of stickers')
    const rows = screen.getAllByTestId('sticker-run-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('Run of 200 sets · 0101 to 0300')
    expect(rows[0]!.textContent).toContain('Printed Nov 12 by Dana · 2 of each')
    expect(screen.getAllByTestId('sticker-run-counts')[0]!.textContent).toBe('103 of 200 stickers are on boxes · 96 stickers not used yet, 0205 to 0300 · 1 marked lost')
    expect(rows[1]!.textContent).toContain('Run of 100 · 0001 to 0100')
    expect(rows[1]!.textContent).toContain('Printed Oct 30')
    expect(screen.getAllByTestId('sticker-run-counts')[1]!.textContent).toBe('0 of 100 stickers are on boxes · 100 stickers not used yet, 0001 to 0100')
    // the rest is its own press only where some are on boxes
    const rests = screen.getAllByTestId('sticker-run-rest')
    expect(rests).toHaveLength(1)
    expect(rests[0]!.textContent).toBe('Print the rest, 0205 to 0300')
    fireEvent.click(rests[0]!)
    expect(onPrint).toHaveBeenCalledTimes(1)
    expect(onPrint.mock.calls[0]![0].id).toBe('run-2')
    expect(onPrint.mock.calls[0]![1]).toHaveLength(96)
    expect(onPrint.mock.calls[0]![1][0].number).toBe(205)
    expect(onPrint.mock.calls[0]![2]).toBe('The rest, 0205 to 0300')
    const reprints = screen.getAllByTestId('sticker-run-reprint')
    expect(reprints.map((b) => b.textContent)).toEqual(['Reprint 200 stickers', 'Reprint 100 stickers'])
    fireEvent.click(reprints[1]!)
    expect(onPrint.mock.calls[1]![0].id).toBe('run-1')
    expect(onPrint.mock.calls[1]![1]).toHaveLength(100)
    expect(onPrint.mock.calls[1]![2]).toBe('Run of 100 · 0001 to 0100')
  })

  it('draws nothing for a job with no run', async () => {
    const fetch = vi.fn(async () => [])
    const { container } = renderWithProviders(<StickerRunsFold jobId="job-bare" onPrint={() => {}} fetch={fetch} />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(container.querySelector('[data-testid="sticker-runs-fold"]')).toBeNull()
  })

  it('a read that failed says so with Retry, and reads again on the press', async () => {
    let fails = true
    // A lost signal is the one failure that offers Retry; a refusal shows its reason alone.
    const fetch = vi.fn(async () => { if (fails) throw new TypeError('Failed to fetch'); return [old] })
    renderWithProviders(<StickerRunsFold jobId="job-juniper" onPrint={() => {}} fetch={fetch} />)
    const retry = await screen.findByRole('button', { name: /retry/i })
    fails = false
    fireEvent.click(retry)
    await waitFor(() => expect(screen.getByTestId('sticker-runs-fold').textContent).toContain('1 run of stickers'))
  })

  it('opens when the page’s *not yet on a box* line is pressed (v2.7298)', async () => {
    const { rerender } = renderWithProviders(<StickerRunsFold jobId="job-juniper" onPrint={() => {}} fetch={async () => [old]} openKey={0} />)
    const fold = (await screen.findByTestId('sticker-runs-fold')) as HTMLDetailsElement
    expect(fold.open).toBe(false)
    rerender(<StickerRunsFold jobId="job-juniper" onPrint={() => {}} fetch={async () => [old]} openKey={1} />)
    await waitFor(() => expect((screen.getByTestId('sticker-runs-fold') as HTMLDetailsElement).open).toBe(true))
  })
})
