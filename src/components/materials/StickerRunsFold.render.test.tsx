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
    // runs with no names are said by their counts: no running number anywhere (Taunya's call of 2026-11-16)
    expect(rows[0]!.textContent).toContain('Run of 200 sets')
    expect(rows[0]!.textContent).toContain('Printed Nov 12 by Dana · 2 of each')
    expect(screen.getAllByTestId('sticker-run-counts')[0]!.textContent).toBe('103 of 200 stickers are on boxes · 96 stickers not used yet · 1 marked lost')
    expect(rows[1]!.textContent).toContain('Run of 100')
    expect(rows[1]!.textContent).toContain('Printed Oct 30')
    expect(screen.getAllByTestId('sticker-run-counts')[1]!.textContent).toBe('0 of 100 stickers are on boxes · 100 stickers not used yet')
    expect(screen.getByTestId('sticker-runs-fold').textContent).not.toMatch(/\b0\d{3}\b/)
    // the rest is its own press only where some are on boxes
    const rests = screen.getAllByTestId('sticker-run-rest')
    expect(rests).toHaveLength(1)
    expect(rests[0]!.textContent).toBe('Print the rest, 96 stickers')
    fireEvent.click(rests[0]!)
    expect(onPrint).toHaveBeenCalledTimes(1)
    expect(onPrint.mock.calls[0]![0].id).toBe('run-2')
    expect(onPrint.mock.calls[0]![1]).toHaveLength(96)
    expect(onPrint.mock.calls[0]![1][0].number).toBe(205)
    expect(onPrint.mock.calls[0]![2]).toBe('The rest, 96 stickers')
    const reprints = screen.getAllByTestId('sticker-run-reprint')
    expect(reprints.map((b) => b.textContent)).toEqual(['Reprint 200 stickers', 'Reprint 100 stickers'])
    fireEvent.click(reprints[1]!)
    expect(onPrint.mock.calls[1]![0].id).toBe('run-1')
    expect(onPrint.mock.calls[1]![1]).toHaveLength(100)
    expect(onPrint.mock.calls[1]![2]).toBe('Run of 100')
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

  it('titles a named run by its names, says which are not used by name, and hands the names back to print (section 10, v2.7391)', async () => {
    const names = ['G78', 'G79', 'G80', 'G81']
    const named: StickerRunWithStickers = {
      run: { id: 'run-3', jobId: 'job-juniper', count: 4, firstNumber: 301, lastNumber: 304, copies: 1, printedByName: 'Dana', printedAt: '2026-11-15T16:00:00Z', names },
      stickers: names.map((boxName, i) => ({ id: `n-${301 + i}`, number: 301 + i, code: `0F6A2B${String(i).padStart(2, '0')}`, boxName, containerId: i === 0 ? 'box-g78' : null, lostAt: null })),
    }
    const onPrint = vi.fn()
    renderWithProviders(<StickerRunsFold jobId="job-juniper" onPrint={onPrint} fetch={async () => [named]} />)
    await screen.findByTestId('sticker-runs-fold')
    const row = screen.getByTestId('sticker-run-row')
    expect(row.textContent).toContain('Run of 4 · G78 to G81')
    expect(row.textContent).toContain('Printed Nov 15 by Dana')
    expect(row.textContent).not.toMatch(/\b0\d{3}\b/)
    // the blank ones are said by name (v2.7438)
    expect(screen.getByTestId('sticker-run-counts').textContent).toBe('1 of 4 stickers are on boxes · 3 stickers not used yet, G79 to G81')
    expect(screen.getByTestId('sticker-run-rest').textContent).toBe('Print the rest, G79 to G81')
    fireEvent.click(screen.getByTestId('sticker-run-rest'))
    expect(onPrint.mock.calls[0]![1].map((s: { boxName?: string | null }) => s.boxName)).toEqual(['G79', 'G80', 'G81'])
    expect(onPrint.mock.calls[0]![2]).toBe('The rest, G79 to G81')
    fireEvent.click(screen.getByTestId('sticker-run-reprint'))
    expect(onPrint.mock.calls[1]![1].map((s: { boxName?: string | null }) => s.boxName)).toEqual(names)
    expect(onPrint.mock.calls[1]![2]).toBe('Run of 4 · G78 to G81')
  })

  it('a named run with stickers still blank offers These are on boxes, and hands its blank names up (section 10, PR 10)', async () => {
    const names = ['G78', 'G79', 'G80', 'G81']
    const named: StickerRunWithStickers = {
      run: { id: 'run-3', jobId: 'job-juniper', count: 4, firstNumber: 301, lastNumber: 304, copies: 1, printedByName: 'Dana', printedAt: '2026-11-15T16:00:00Z', names },
      stickers: names.map((boxName, i) => ({ id: `n-${301 + i}`, number: 301 + i, code: `0F6A2B${String(i).padStart(2, '0')}`, boxName, containerId: i === 0 ? 'box-g78' : null, lostAt: null })),
    }
    const onPlaceRange = vi.fn()
    renderWithProviders(<StickerRunsFold jobId="job-juniper" onPrint={() => {}} onPlaceRange={onPlaceRange} fetch={async () => [named, old]} />)
    await screen.findByTestId('sticker-runs-fold')
    // the numbered run has no names to place by, so only the named run has the press
    const presses = screen.getAllByTestId('sticker-run-on-boxes')
    expect(presses).toHaveLength(1)
    expect(presses[0]!.textContent).toBe('These are on boxes')
    fireEvent.click(presses[0]!)
    expect(onPlaceRange).toHaveBeenCalledTimes(1)
    expect(onPlaceRange.mock.calls[0]![0].id).toBe('run-3')
    expect(onPlaceRange.mock.calls[0]![1]).toEqual(['G79', 'G80', 'G81'])
  })

  it('a named run with every sticker on a box, or a page with no form for it, has no such press', async () => {
    const all: StickerRunWithStickers = {
      run: { id: 'run-4', jobId: 'job-juniper', count: 1, firstNumber: 305, lastNumber: 305, copies: 1, printedByName: 'Dana', printedAt: '2026-11-15T16:00:00Z', names: ['G82'] },
      stickers: [{ id: 'n-305', number: 305, code: '0F6A2B05', boxName: 'G82', containerId: 'box-g82', lostAt: null }],
    }
    renderWithProviders(<StickerRunsFold jobId="job-juniper" onPrint={() => {}} onPlaceRange={() => {}} fetch={async () => [all]} />)
    await screen.findByTestId('sticker-runs-fold')
    expect(screen.queryByTestId('sticker-run-on-boxes')).toBeNull()
    cleanup()
    const blank: StickerRunWithStickers = { ...all, stickers: [{ ...all.stickers[0]!, containerId: null }] }
    renderWithProviders(<StickerRunsFold jobId="job-juniper" onPrint={() => {}} fetch={async () => [blank]} />)
    await screen.findByTestId('sticker-runs-fold')
    expect(screen.queryByTestId('sticker-run-on-boxes')).toBeNull()
  })
})
