// @vitest-environment jsdom
/**
 * Render smoke for Print future stickers (punch list #329, PR 2, v2.7272) through the browser's print window, where the
 * test's browser has no USB: the ask with its quick counts and Copies of each; a count out of range and a role that may
 * not mint each hold the press with the database's words; the press mints the run and the strips print once they are
 * on the page; a refusal is said and nothing prints; a run handed in prints and mints nothing. Since v2.7438
 * (Taunya's call of 2026-11-16) no strip and no line of the window carries a sticker's running number: a sticker with
 * no name prints its code larger in the name's place, and a run with no names is said by its count.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { SiteBox } from '../../lib/materials/boxName'
import type { MintedRun, StickerRunRequest } from '../../lib/materials/stickerRun'
import type { SiteStickerNames, StickerRunWithStickers } from '../../lib/materials/stickerRunsIo'

vi.mock('../../lib/materials/stickerRunsIo', () => ({
  mintStickerRun: vi.fn(),
  fetchStickerRuns: vi.fn(async () => []),
  fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: [] })),
}))
vi.mock('../../lib/materials/photoShare', () => ({ downloadFile: vi.fn() }))
import { downloadFile } from '../../lib/materials/photoShare'
import PrintStickersModal from './PrintStickersModal'

/** A made-up run for Juniper Ridge: whatever is asked, numbered from 0101. */
function mintedRun(request: StickerRunRequest): MintedRun {
  const stickers = Array.from({ length: request.count }, (_, i) => ({ id: `s-${101 + i}`, number: 101 + i, code: `4F2A9C${String(i).padStart(2, '0')}`, boxName: request.names?.[i] ?? null }))
  return { run: { id: 'run-1', jobId: request.jobId, count: request.count, firstNumber: 101, lastNumber: 100 + request.count, copies: request.copies, printedByName: 'Dana', printedAt: '2026-11-14T16:00:00Z', names: request.names ?? null }, stickers }
}

/** A made-up site: cages G1 to G77, and a retired G90, so the next free name is G91. */
const SITE_BOXES: SiteBox[] = [...Array.from({ length: 77 }, (_, i) => ({ id: `b-${i + 1}`, label: `G${i + 1}`, kind: 'cage', retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })), { id: 'b-90', label: 'G90', kind: 'cage', retiredAt: '2026-11-02T00:00:00Z', createdAt: '2026-11-01T00:00:00Z' }]

/** The site's names are read before the press goes live. */
async function ready() {
  await waitFor(() => expect(screen.queryByTestId('stickers-names-reading')).toBeNull())
}

/** A made-up run of the job as its page reads it: named from `first`, the first `onBoxes` of them on boxes already. */
function jobRun(id: string, first: number, count: number, onBoxes = 0, over: Partial<StickerRunWithStickers['run']> = {}): StickerRunWithStickers {
  const names = Array.from({ length: count }, (_, i) => `G${first + i}`)
  return {
    run: { id, jobId: 'job-juniper', count, firstNumber: first, lastNumber: first + count - 1, copies: 1, printedByName: 'Dana', printedAt: '2026-11-16T16:00:00Z', names, ...over },
    stickers: names.map((boxName, i) => ({ id: `${id}-${i}`, number: first + i, code: `7B3D${String(first + i).padStart(4, '0')}`, boxName, containerId: i < onBoxes ? `box-${i}` : null, lostAt: null })),
  }
}

function setup(over: { role?: string; mint?: (r: StickerRunRequest) => Promise<MintedRun>; runs?: () => Promise<StickerRunWithStickers[]>; site?: () => Promise<SiteStickerNames>; run?: MintedRun & { title: string; printing?: MintedRun['stickers'] } } = {}) {
  const print = vi.fn()
  const mint = vi.fn(over.mint ?? (async (r: StickerRunRequest) => mintedRun(r)))
  const onMinted = vi.fn()
  renderWithProviders(
    <PrintStickersModal jobId="job-juniper" jobLabel="JP1204 · Juniper Ridge" role={over.role ?? 'assistant'} run={over.run ? { run: over.run.run, stickers: over.run.stickers, title: over.run.title, printing: over.run.printing } : null} onClose={() => {}} onMinted={onMinted} mint={mint} jobRuns={over.runs ?? (async () => [])} siteNames={over.site ?? (async () => ({ boxes: [], blankNames: [] }))} print={print} />,
  )
  return { print, mint, onMinted }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.mocked(downloadFile).mockReset()
})

describe('PrintStickersModal · the ask', () => {
  it('opens on 200 with the quick counts, Copies of each, where new boxes go and the browser note, and no number', async () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Print future stickers' })).toBeTruthy()
    expect(screen.getAllByTestId('stickers-count-preset').map((b) => b.textContent)).toEqual(['30', '60', '100', '200'])
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('200 stickers, one strip each.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 future stickers')
    expect(screen.getByTestId('stickers-copies').textContent).toBe('1')
    await ready()
    expect(screen.getByTestId('stickers-goes-on').textContent).toBe('New boxes made from these stickers go on JP1204 · Juniper Ridge.')
    // what the press holds is said before it (v2.7484): a link of its own for each sticker, and nowhere the word blank
    expect(screen.getByTestId('stickers-reserve-words').textContent).toBe('Printing gives each sticker its own link and holds it for a box. You say which box it is on later.')
    expect(screen.queryByTestId('stickers-reserved-words')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Print future stickers' }).textContent).not.toMatch(/blank/i)
    // the window says no running number: not where the last run ended, not where this one starts
    expect(screen.queryByTestId('stickers-last-run')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Print future stickers' }).textContent).not.toMatch(/last run|numbers start|\b0\d{3}\b/)
    expect(screen.queryByTestId('stickers-blank-count')).toBeNull()
    // no USB in this browser: the way out is said, and the test strip and the setup steps are still offered
    expect(screen.getByTestId('stickers-no-usb')).toBeTruthy()
    expect(screen.getByTestId('stickers-tape-setup').textContent).toContain('First time on this computer')
    expect(screen.getByTestId('stickers-test-strip').textContent).toBe('Print 1 test strip')
    expect(screen.queryByTestId('stickers-csv')).toBeNull()
  })

  it('says how many of the job’s stickers are not yet on a box, before 200 more are printed over them (v2.7298)', async () => {
    setup({ runs: async () => [jobRun('r1', 101, 96)] })
    await waitFor(() => expect(screen.getByTestId('stickers-blank-count').textContent).toBe('This job has 96 stickers reserved and not on a box yet.'))
  })

  it('offers the reserved stickers a press under that line, which turns the window to their run and mints nothing (v2.7523)', async () => {
    const { print, mint } = setup({ runs: async () => [jobRun('r1', 1, 5, 1)] })
    const press = await screen.findByTestId('stickers-print-reserved-press')
    // it counts what it prints and names it: the four on no box yet, never the one that is on a box
    expect(press.textContent).toBe('Print the 4 reserved stickers, G2 to G5')
    expect(screen.getByTestId('stickers-print-reserved-note').textContent).toBe('This prints the same stickers with the same links. It reserves nothing new.')
    // the other press still reserves new ones
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 future stickers')
    fireEvent.click(press)
    expect(screen.getByRole('dialog', { name: 'Reserved stickers, G2 to G5' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Reserved stickers, G2 to G5 · JP1204 · Juniper Ridge')
    expect(screen.queryByTestId('stickers-ask')).toBeNull()
    expect(screen.getByTestId('stickers-again-words').textContent).toBe('Printing them again reserves nothing new. Each sticker keeps the link it has.')
    // the strips are the run's own, each with the link it was given
    expect(screen.getAllByTestId('stickers-tape')).toHaveLength(4)
    expect(screen.getAllByTestId('stickers-tape-name').map((n) => n.textContent)).toEqual(['G2', 'G3', 'G4', 'G5'])
    expect(screen.getAllByTestId('stickers-tape')[0]!.textContent).toContain('7B3D-0002')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 4 stickers, G2 to G5')
    // nothing prints until the press, and nothing is ever minted
    expect(print).not.toHaveBeenCalled()
    // the whole run is one pick away: From reaches the sticker that is on a box
    expect(within(screen.getByTestId('stickers-range-from')).getAllByRole('option').map((o) => o.textContent)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5'])
    expect((screen.getByTestId('stickers-range-from') as HTMLSelectElement).value).toBe('r1-1')
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(print).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByTestId('stickers-range-from'), { target: { value: 'r1-0' } })
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 5 stickers, G1 to G5')
    expect(mint).not.toHaveBeenCalled()
  })

  it('more than one run with reserved stickers offers each its own press, with who printed it and when', async () => {
    setup({ runs: async () => [jobRun('r2', 11, 3, 0, { printedByName: 'Marcus', printedAt: '2026-11-15T16:00:00Z' }), jobRun('r1', 1, 3)] })
    await waitFor(() => expect(screen.getAllByTestId('stickers-print-reserved-press').map((b) => b.textContent)).toEqual(['Print the 3 reserved stickers, G1 to G3', 'Print the 3 reserved stickers, G11 to G13']))
    expect(screen.getAllByTestId('stickers-print-reserved-by').map((b) => b.textContent)).toEqual(['Printed Nov 16 by Dana', 'Printed Nov 15 by Marcus'])
    fireEvent.click(screen.getAllByTestId('stickers-print-reserved-press')[1]!)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Reserved stickers, G11 to G13 · JP1204 · Juniper Ridge')
  })

  it('a role that may not print a run sees the reserved press dead with its reason, never missing', async () => {
    setup({ role: 'subcontractor', runs: async () => [jobRun('r1', 1, 3)] })
    const press = (await screen.findByTestId('stickers-print-reserved-press')) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.getAttribute('aria-label')).toBe('Print the 3 reserved stickers, G1 to G3. Only the office, a primary or a superintendent prints a run of stickers.')
    expect(screen.getByTestId('stickers-print-reserved-note').textContent).toBe('Only the office, a primary or a superintendent prints a run of stickers.')
    fireEvent.click(press)
    expect(screen.queryByTestId('stickers-ask')).not.toBeNull()
  })

  it('a quick count and Copies of each change the press to sets, and the device remembers the copies', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '60' }))
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 60 sets of future stickers')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('60 stickers, 2 strips each. 120 strips.')
    await ready()
    expect(localStorage.getItem('pt.labels.tapeCopies')).toBe('2')
  })

  it('a typed count out of range holds the press with the database’s words', () => {
    const { mint } = setup()
    fireEvent.change(screen.getByTestId('stickers-count-input'), { target: { value: '501' } })
    expect(screen.getByTestId('stickers-refusal').textContent).toBe('A run is 1 to 500 stickers.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print future stickers')
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(mint).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('stickers-count-input'), { target: { value: '45' } })
    expect(screen.queryByTestId('stickers-refusal')).toBeNull()
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 45 future stickers')
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
    // the test strip reads TEST, never a number a sticker could be taken for
    expect(strips[0]!.textContent).toContain('TEST')
    expect(strips[0]!.textContent).toContain('Test strip')
    expect(strips[0]!.textContent).not.toContain('0000')
  })
})

describe('PrintStickersModal · the run', () => {
  it('the press mints the run as asked, the strips go on the page and print once, and the CSV writes the run', async () => {
    const { print, mint, onMinted } = setup()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: '60' }))
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getAllByTestId('stickers-tape')).toHaveLength(60))
    expect(mint).toHaveBeenCalledWith({ jobId: 'job-juniper', count: 60, copies: 2 })
    expect(onMinted).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    // a run with no names is said by its count (v2.7438: no running number anywhere)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('60 stickers · JP1204 · Juniper Ridge')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('60 stickers, 2 strips each. 120 strips.')
    // a run that is made is reserved, and says so over its strips (v2.7484)
    expect(screen.getByTestId('stickers-reserved-words').textContent).toBe('These stickers are reserved. Each one holds its own link until you say which box it is on.')
    // every sticker prints twice: its copy is on the page for the paper and hidden on the screen
    expect(screen.getAllByTestId('stickers-tape-copy')).toHaveLength(60)
    const first = screen.getAllByTestId('stickers-tape')[0]!
    // no name and no number: the address on two lines, the code on the second drawn half again as large
    expect(within(first).queryByTestId('stickers-tape-name')).toBeNull()
    const lines = within(first).getAllByTestId('stickers-tape-address-line')
    expect(lines.map((el) => el.textContent)).toEqual(['PRTS.CO/B/', '4F2A-9C00'])
    expect(parseFloat(lines[1]!.style.fontSize)).toBeCloseTo(parseFloat(lines[0]!.style.fontSize) * 1.5, 3)
    expect(first.textContent).toBe('PRTS.CO/B/4F2A-9C00')
    expect(first.style.width).toBe('54mm')
    expect(first.style.height).toBe('24mm')
    // the ask is gone; the press prints the same run again, and the day is remembered
    expect(screen.queryByTestId('stickers-ask')).toBeNull()
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 60 sets')
    expect(localStorage.getItem('pt.labels.tapePrintedYmd')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    fireEvent.click(screen.getByTestId('stickers-csv'))
    expect(downloadFile).toHaveBeenCalledTimes(1)
    const file = vi.mocked(downloadFile).mock.calls[0]![0] as File
    expect(file.name).toMatch(/^stickers-60-\d{4}-\d{2}-\d{2}\.csv$/)
    // a header row and sixty rows of four cells; the words themselves are the kernel's test
    expect(file.size).toBeGreaterThan(60 * 40)
  })

  it('a refusal is said in the database’s words, the ask stays and nothing prints', async () => {
    const { print } = setup({ mint: async () => { throw { message: 'A run is 1 to 500 stickers.', code: 'P0001' } } })
    await ready()
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-slip').textContent).toBe('The run was not made. No sticker was reserved or printed: A run is 1 to 500 stickers.'))
    expect(screen.getByTestId('stickers-ask')).toBeTruthy()
    expect(print).not.toHaveBeenCalled()
    expect(screen.queryAllByTestId('stickers-tape')).toHaveLength(0)
  })

  it('a gate refusal reads as the app says every refusal of reach, and nothing prints', async () => {
    const { print } = setup({ mint: async () => { throw { message: 'That job is not one you can reach.', code: '42501' } } })
    await ready()
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getByTestId('stickers-slip').textContent).toContain('The run was not made. No sticker was reserved or printed.'))
    expect(screen.getByTestId('stickers-slip').textContent).toContain('access')
    expect(print).not.toHaveBeenCalled()
  })

  it('a run handed in with the stickers to start on prints those, and keeps the whole run within reach (v2.7523)', () => {
    const minted = mintedRun({ jobId: 'job-juniper', count: 4, copies: 1, names: ['G1', 'G2', 'G3', 'G4'] })
    const { print, mint } = setup({ run: { ...minted, title: 'Reserved stickers, G3 to G4', printing: minted.stickers.slice(2) } })
    expect(screen.getByRole('dialog', { name: 'Reserved stickers, G3 to G4' })).toBeTruthy()
    expect(screen.getAllByTestId('stickers-tape-name').map((n) => n.textContent)).toEqual(['G3', 'G4'])
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('2 of G1 to G4, one strip each.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 2 stickers, G3 to G4')
    expect(within(screen.getByTestId('stickers-range-from')).getAllByRole('option').map((o) => o.textContent)).toEqual(['G1', 'G2', 'G3', 'G4'])
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(mint).not.toHaveBeenCalled()
  })

  it('a run on the page has Copies of each: it opens on the run’s own count and changes this print alone (v2.7553)', () => {
    const minted = mintedRun({ jobId: 'job-juniper', count: 3, copies: 5, names: ['G93', 'G94', 'G95'] })
    const { print, mint } = setup({ run: { ...minted, title: 'Reserved stickers, G93 to G95' } })
    // it opens on the five the run was made with, and says each copy opens the same box
    expect(screen.getByTestId('stickers-copies').textContent).toBe('5')
    expect(screen.getByTestId('stickers-copies-note').textContent).toBe('Every copy opens the same box.')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('G93 to G95, 5 strips each. 15 strips.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 3 sets, G93 to G95')
    expect(screen.getAllByTestId('stickers-tape')).toHaveLength(3)
    expect(screen.getAllByTestId('stickers-tape-copy')).toHaveLength(12)
    // fewer: the head, the press and the strips on the page follow, and the note says what the run was made with
    fireEvent.click(screen.getByTestId('stickers-copies-less'))
    fireEvent.click(screen.getByTestId('stickers-copies-less'))
    expect(screen.getByTestId('stickers-copies').textContent).toBe('3')
    expect(screen.getByTestId('stickers-copies-note').textContent).toBe('The run was made with 5 of each. Every copy opens the same box.')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('G93 to G95, 3 strips each. 9 strips.')
    expect(screen.getAllByTestId('stickers-tape-copy')).toHaveLength(6)
    // down to one each: plain stickers, no copies on the page
    fireEvent.click(screen.getByTestId('stickers-copies-less'))
    fireEvent.click(screen.getByTestId('stickers-copies-less'))
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 3 stickers, G93 to G95')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('G93 to G95, one strip each.')
    expect(screen.queryAllByTestId('stickers-tape-copy')).toHaveLength(0)
    expect((screen.getByTestId('stickers-copies-less') as HTMLButtonElement).disabled).toBe(true)
    // the count is this print's alone: the device's remembered count is not written
    expect(localStorage.getItem('pt.labels.tapeCopies')).toBeNull()
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(mint).not.toHaveBeenCalled()
  })

  it('a run made with one of each can be printed five of each, and six is the most', () => {
    const minted = mintedRun({ jobId: 'job-juniper', count: 2, copies: 1, names: ['G93', 'G94'] })
    setup({ run: { ...minted, title: 'Run of 2 · G93 to G94' } })
    expect(screen.getByTestId('stickers-copies').textContent).toBe('1')
    expect(screen.getByTestId('stickers-copies-note').textContent).toBe('For a box with more than one side, print each sticker more than once.')
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByTestId('stickers-copies-more'))
    expect(screen.getByTestId('stickers-copies').textContent).toBe('5')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 2 sets, G93 to G94')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('G93 to G94, 5 strips each. 10 strips.')
    expect(screen.getByTestId('stickers-copies-note').textContent).toBe('The run was made with 1 of each. Every copy opens the same box.')
    expect(screen.getAllByTestId('stickers-tape-copy')).toHaveLength(8)
    fireEvent.click(screen.getByTestId('stickers-copies-more'))
    expect((screen.getByTestId('stickers-copies-more') as HTMLButtonElement).disabled).toBe(true)
  })

  it('a run handed in opens on its strips, mints nothing, and the press prints it again', () => {
    const minted = mintedRun({ jobId: 'job-juniper', count: 3, copies: 1 })
    const { print, mint } = setup({ run: { ...minted, title: 'Run of 3' } })
    expect(screen.getByRole('dialog', { name: 'Run of 3' })).toBeTruthy()
    expect(screen.queryByTestId('stickers-ask')).toBeNull()
    expect(screen.getAllByTestId('stickers-tape')).toHaveLength(3)
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 3 stickers')
    // the range picks a sticker with no name by its code, as the tape prints it
    expect(within(screen.getByTestId('stickers-range-from')).getAllByRole('option').map((o) => o.textContent)).toEqual(['4F2A-9C00', '4F2A-9C01', '4F2A-9C02'])
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(mint).not.toHaveBeenCalled()
  })
})

describe('PrintStickersModal · a run that names its boxes (design section 10, PR 8, v2.7391)', () => {
  const site = (blankNames: string[] = []) => async () => ({ boxes: SITE_BOXES, blankNames })
  const type = (text: string) => fireEvent.change(screen.getByTestId('stickers-names-input'), { target: { value: text } })

  it('waits for the site’s names, then opens on the next free name with How many saying how far', async () => {
    const { mint } = setup({ site: site() })
    // while the names are read the press is dead, so nobody prints a numbered run by being quick
    expect(screen.getByTestId('stickers-names-reading').textContent).toBe('Reading the site’s names…')
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(mint).not.toHaveBeenCalled()
    await ready()
    // one past the highest number any box carries, the retired G90 with them
    expect((screen.getByTestId('stickers-names-input') as HTMLInputElement).value).toBe('G91')
    expect(screen.getByTestId('stickers-names-read').textContent).toBe('G91 to G290 · 200 stickers. G91 is the site’s next free name. Type a range to set the end, like G91-190.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 future stickers, G91 to G290')
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('false')
    expect(screen.queryByTestId('stickers-names-live')).toBeNull()
    // How many still says how far while one name is typed
    fireEvent.click(screen.getByRole('button', { name: '30' }))
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 30 future stickers, G91 to G120')
  })

  it('opens past the names an earlier run reserved, so a second run starts after the first and meets no hold (v2.7487)', async () => {
    setup({ site: site(Array.from({ length: 10 }, (_, i) => `G${91 + i}`)) })
    await ready()
    expect((screen.getByTestId('stickers-names-input') as HTMLInputElement).value).toBe('G101')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 future stickers, G101 to G300')
    expect(screen.queryByTestId('stickers-names-blank')).toBeNull()
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('false')
  })

  it('a typed range sets the count: How many shows it, its presses rest, and the press names the range', async () => {
    setup({ site: site() })
    await ready()
    type('g78-300')
    expect(screen.getByTestId('stickers-names-read').textContent).toBe('G78 to G300 · 223 stickers. The number steps.')
    const count = screen.getByTestId('stickers-count-input') as HTMLInputElement
    expect(count.value).toBe('223')
    expect(count.readOnly).toBe(true)
    expect(screen.getAllByTestId('stickers-count-preset').every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true)
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('223 stickers, one strip each.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 223 future stickers, G78 to G300')
    expect(screen.getByTestId('stickers-reserve-words').textContent).toBe('Printing reserves each name and gives each sticker its own link. You say which box it is on later.')
    // the range gone, How many is the typed 200 again
    type('G78')
    expect(count.value).toBe('200')
    expect(count.readOnly).toBe(false)
    expect(screen.getAllByTestId('stickers-count-preset').every((b) => b.getAttribute('aria-disabled') === 'false')).toBe(true)
  })

  it('a range the rule refuses says why under the field, and the press is dead', async () => {
    const { mint } = setup({ site: site() })
    await ready()
    type('G300-78')
    const read = screen.getByTestId('stickers-names-read')
    expect(read.textContent).toBe('The range runs upward: G78 to G300.')
    expect(read.getAttribute('role')).toBe('note')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print future stickers')
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('true')
    expect(screen.queryByTestId('stickers-refusal')).toBeNull()
    fireEvent.click(screen.getByTestId('stickers-print'))
    expect(mint).not.toHaveBeenCalled()
    type('G1-600')
    expect(screen.getByTestId('stickers-names-read').textContent).toBe('A run is 1 to 500 stickers. G1 to G600 is 600.')
  })

  it('names that are boxes on the site already are a notice, and the press stays live', async () => {
    const { mint } = setup({ site: site() })
    await ready()
    type('G1-200')
    expect(screen.getByTestId('stickers-names-live').textContent).toBe('77 of these are boxes on this site already, G1 to G77. Their stickers go on those boxes.')
    expect(screen.queryByTestId('stickers-names-blank')).toBeNull()
    expect(screen.queryByTestId('stickers-print-anyway')).toBeNull()
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(mint).toHaveBeenCalledTimes(1))
    expect(mint.mock.calls[0]![0].names).toHaveLength(200)
  })

  it('names an earlier run printed and that are on no box hold the press until Print them anyway', async () => {
    const blank = Array.from({ length: 23 }, (_, i) => `G${178 + i}`)
    const { mint, print } = setup({ site: site(blank) })
    await ready()
    type('G150-200')
    expect(screen.getByTestId('stickers-names-blank').textContent).toBe('23 of these are reserved by an earlier run and are not on a box yet, G178 to G200. Printing them again makes two stickers for each name.')
    const press = screen.getByTestId('stickers-print')
    expect(press.textContent).toBe('Print 51 future stickers, G150 to G200')
    expect(press.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(press)
    expect(mint).not.toHaveBeenCalled()
    // a range clear of them has no hold
    type('G150-177')
    expect(screen.queryByTestId('stickers-names-blank')).toBeNull()
    expect(screen.queryByTestId('stickers-print-anyway')).toBeNull()
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('false')
    // back over them, the other press prints the run as asked
    type('G150-200')
    expect(screen.getByTestId('stickers-print-anyway').textContent).toBe('Print them anyway')
    fireEvent.click(screen.getByTestId('stickers-print-anyway'))
    await waitFor(() => expect(screen.getAllByTestId('stickers-tape')).toHaveLength(51))
    expect(mint).toHaveBeenCalledTimes(1)
    expect(mint.mock.calls[0]![0].names).toHaveLength(51)
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })

  it('the mint is sent the names, and each strip prints its name large over the address, with no number', async () => {
    const { mint, print } = setup({ site: site() })
    await ready()
    type('G78-80')
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getAllByTestId('stickers-tape')).toHaveLength(3))
    expect(mint).toHaveBeenCalledWith({ jobId: 'job-juniper', count: 3, copies: 1, names: ['G78', 'G79', 'G80'] })
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Stickers G78 to G80 · JP1204 · Juniper Ridge')
    expect(screen.getByTestId('stickers-count-words').textContent).toBe('G78 to G80, one strip each.')
    const first = screen.getAllByTestId('stickers-tape')[0]!
    expect(within(first).queryByTestId('stickers-tape-number')).toBeNull()
    const lines = within(first).getAllByTestId('stickers-tape-address-line')
    expect(lines.map((el) => el.textContent)).toEqual(['PRTS.CO/B/', '4F2A-9C00'])
    // under a name the code is the link's own size, as on a box label
    expect(lines[1]!.style.fontSize).toBe(lines[0]!.style.fontSize)
    expect(first.textContent).toBe('G78PRTS.CO/B/4F2A-9C00')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 3 stickers, G78 to G80')
    // the range of the run on the page is picked by name
    expect(within(screen.getByTestId('stickers-range-from')).getAllByRole('option').map((o) => o.textContent)).toEqual(['G78', 'G79', 'G80'])
    fireEvent.click(screen.getByTestId('stickers-csv'))
    const file = vi.mocked(downloadFile).mock.calls[0]![0] as File
    const text = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(file) })
    expect(text.split('\r\n').slice(0, 2)).toEqual(['Name,Code,Address,QR', 'G78,4F2A-9C00,prts.co/b/4F2A-9C00,HTTPS://PRTS.CO/B/4F2A9C00'])
    expect(file.name).toMatch(/^stickers-G78-G80-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('a long name prints at the smaller size, and the strip is cut for it', async () => {
    setup({ site: site() })
    await ready()
    type('ABC998Z-999Z')
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getAllByTestId('stickers-tape')).toHaveLength(2))
    const first = screen.getAllByTestId('stickers-tape')[0]!
    const name = within(first).getByTestId('stickers-tape-name')
    expect(name.textContent).toBe('ABC998Z')
    // five sevenths of the 9 mm stencil, and a strip as long as a five-character name's
    expect(parseFloat(name.style.fontSize)).toBeCloseTo((9 * 5) / 7, 3)
    expect(first.style.width).toBe('61mm')
  })

  it('cleared, the field prints a run with no names: each strip is its code, larger', async () => {
    const { mint } = setup({ site: site() })
    await ready()
    type('')
    expect(screen.getByTestId('stickers-names-read').textContent).toBe('Nothing typed: the stickers carry no name, only their code. A leftover works on any site.')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 future stickers')
    fireEvent.click(screen.getByRole('button', { name: '30' }))
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(screen.getAllByTestId('stickers-tape')).toHaveLength(30))
    expect(mint).toHaveBeenCalledWith({ jobId: 'job-juniper', count: 30, copies: 1 })
    expect(screen.getAllByTestId('stickers-tape')[0]!.textContent).toBe('PRTS.CO/B/4F2A-9C00')
    expect(screen.queryByTestId('stickers-tape-number')).toBeNull()
    expect(screen.queryByTestId('stickers-tape-name')).toBeNull()
  })

  it('a site with no named box opens the field empty, and typing first keeps what was typed', async () => {
    let land: (v: SiteStickerNames) => void = () => {}
    setup({ site: () => new Promise<SiteStickerNames>((resolve) => { land = resolve }) })
    type('R5')
    land({ boxes: SITE_BOXES, blankNames: [] })
    await ready()
    expect((screen.getByTestId('stickers-names-input') as HTMLInputElement).value).toBe('R5')
    cleanup()
    setup({ site: async () => ({ boxes: [], blankNames: [] }) })
    await ready()
    expect((screen.getByTestId('stickers-names-input') as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 200 future stickers')
  })

  it('a site that did not load says so, offers no name, and the run can still be typed or numbered', async () => {
    const { mint } = setup({ site: async () => { throw new Error('offline') } })
    await ready()
    expect(screen.getByTestId('stickers-names-unread').textContent).toBe('The site’s names did not load, so no name is offered and nothing is checked against the site.')
    expect((screen.getByTestId('stickers-names-input') as HTMLInputElement).value).toBe('')
    type('G78-79')
    fireEvent.click(screen.getByTestId('stickers-print'))
    await waitFor(() => expect(mint).toHaveBeenCalledWith({ jobId: 'job-juniper', count: 2, copies: 1, names: ['G78', 'G79'] }))
  })

  it('How many out of range still holds a run from one typed name', async () => {
    setup({ site: site() })
    await ready()
    fireEvent.change(screen.getByTestId('stickers-count-input'), { target: { value: '501' } })
    expect(screen.getByTestId('stickers-refusal').textContent).toBe('A run is 1 to 500 stickers.')
    expect(screen.getByTestId('stickers-print').getAttribute('aria-disabled')).toBe('true')
  })
})
