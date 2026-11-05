// @vitest-environment jsdom
/**
 * Render smoke for the material location report (punch list #268): the window reads the site's
 * rows once, draws the paper by job with the head, the counts, the sections, the closing block and
 * the foot; By location regroups the same boxes; Print calls print; the device remembers the view;
 * an empty site says so; a read that fails draws the retry panel; Escape closes it unless a window
 * sits over it; a long Last recorded wraps (the paper lost the words at the margin, v2.6536).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'
import SiteMaterialsReportModal from './SiteMaterialsReportModal'
import { readReportView } from '../../lib/materials/siteMaterialsReportPrefs'
import { registerModal, unregisterModal } from '../../lib/modalStack'
import type { Container, Movement, Place } from '../../lib/materials/onSite'
import type { SiteMaterialsRows } from '../../lib/materials/siteMaterialsReport'

// The retry panel reads the signed-in person for its telemetry; the smoke signs in a dev.
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue({ role: 'dev' }),
  useOptionalAuth: () => makeUseAuthValue({ role: 'dev' }),
}))

const A1 = '7d759246-8476-4a37-884f-ed1562d5663f'
const G1 = 'b4b0e605-17ae-440b-a064-f523bb4b0b12'
const C3 = '833c8327-3e32-4934-a0e8-1e013ba153cc'

const place = (id: string, jobId: string, name: string): Place => ({ id, jobId, name, createdAt: '2026-10-01T12:00:00Z' })
const container = (id: string, jobId: string, label: string, kind: Container['kind'], extra: Partial<Container> = {}): Container => ({ id, jobId, label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T12:00:00Z', ...extra })
const move = (id: string, jobId: string, partName: string, quantity: number, reason: Movement['reason'], from: string | null, to: string | null, at: string, byName = 'Jordan', note = ''): Movement => ({ id, jobId, partId: null, partName, manufacturer: null, quantity, reason, fromContainerId: from, toContainerId: to, note, byUserId: null, byName, at, source: null, itemId: null })

const rows: SiteMaterialsRows = {
  places: [place('p1', 'j1', 'Arena'), place('p2', 'j2', 'Arena')],
  containers: [container(A1, 'j1', 'A1', 'cage', { locationId: 'p1', where: 'by the gate' }), container(C3, 'j1', 'C3', 'box'), container(G1, 'j2', 'G1', 'cage', { locationId: 'p2' })],
  movements: [
    move('m1', 'j1', '3/4" copper 90', 48, 'delivered', null, A1, '2026-11-02T15:00:00Z', 'Office', 'ea'),
    move('m2', 'j2', 'Gas valve 3/4"', 14, 'delivered', null, G1, '2026-10-27T15:00:00Z', 'Reyes', 'added on site'),
  ],
}
const site = { name: 'Harlow Ranch', customer: 'Ridgeway Builders', address: '4100 Harlow Ranch Rd, Blanco, TX' }
const jobs = [
  { id: 'j1', label: 'J1042', name: 'Lodge rough-in' },
  { id: 'j2', label: 'J1047', name: 'Bunkhouse gas line' },
  { id: 'j3', label: 'J1051', name: 'Water wells' },
]

function setup(read: (ids: ReadonlyArray<string>) => Promise<SiteMaterialsRows> = () => Promise.resolve(rows)) {
  const print = vi.fn()
  const onClose = vi.fn()
  const reader = vi.fn(read)
  renderWithProviders(<SiteMaterialsReportModal site={site} jobs={jobs} printedBy="Dana Example" onClose={onClose} print={print} read={reader} />)
  return { print, onClose, reader }
}

afterEach(() => {
  window.localStorage.clear()
})

describe('SiteMaterialsReportModal', () => {
  it('reads the site once, then draws the paper by job: the head, the counts, the sections, the closing block, the foot', async () => {
    const { reader } = setup()
    expect(screen.getByTestId('report-reading')).toBeTruthy()
    const paper = await screen.findByTestId('report-paper')
    expect(reader).toHaveBeenCalledTimes(1)
    expect(reader).toHaveBeenCalledWith(['j1', 'j2', 'j3'])
    expect(paper.textContent).toContain('Harlow Ranch')
    expect(paper.textContent).toContain('Ridgeway Builders · 4100 Harlow Ranch Rd, Blanco, TX')
    expect(within(paper).getByTestId('report-printed').textContent).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}printed by Dana Example$/)
    expect(within(paper).getByTestId('report-counts').textContent).toBe('3 jobs on the site · 2 with material · 2 places · 3 cages and boxes · 2 lines on hand')
    const sections = within(paper).getAllByTestId('report-section')
    expect(sections.map((s) => s.querySelector('b')!.textContent)).toEqual(['J1042 · Lodge rough-in', 'J1047 · Bunkhouse gas line'])
    expect(within(sections[0]!).getAllByTestId('report-group').map((g) => g.firstElementChild!.textContent)).toEqual(['Arena', 'No place yet'])
    const boxes = within(sections[0]!).getAllByTestId('report-box')
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['A1 · cage', 'C3 · box'])
    expect(boxes[0]!.textContent).toContain('by the gate')
    expect(boxes[0]!.textContent).toContain('7D759246')
    expect(within(boxes[0]!).getAllByTestId('report-line').map((r) => r.textContent)).toEqual(['3/4" copper 9048eaNov 2 · Office'])
    expect(within(boxes[1]!).getByTestId('report-box-empty').textContent).toBe('Empty')
    const nothing = within(paper).getByTestId('report-nothing')
    expect(nothing.textContent).toContain('Nothing on site · 1 job')
    expect(within(nothing).getAllByTestId('report-nothing-line').map((l) => l.textContent)).toEqual(['J1051 · Water wells: no cages or boxes on this job yet.'])
    expect(within(paper).getByTestId('report-foot').textContent).toMatch(/^Read from the Materials on site ledger, every press on the phone and in the office summed to what is on hand\. Printed [A-Z][a-z]+ \d{1,2}, \d{4} by Dana Example\.$/)
  })

  it('By location regroups the same boxes under one Arena with a group per job, remembers the pick, and Print prints', async () => {
    const { print } = setup()
    const paper = await screen.findByTestId('report-paper')
    expect(screen.getByTestId('report-view-job').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('report-view-location'))
    expect(screen.getByTestId('report-view-location').getAttribute('aria-pressed')).toBe('true')
    expect(readReportView()).toBe('location')
    const sections = within(paper).getAllByTestId('report-section')
    expect(sections.map((s) => s.querySelector('b')!.textContent)).toEqual(['Arena', 'No place yet'])
    expect(within(sections[0]!).getAllByTestId('report-group').map((g) => g.firstElementChild!.textContent)).toEqual(['J1042 · Lodge rough-in', 'J1047 · Bunkhouse gas line'])
    // Under No place yet the box names its job on its own line.
    expect(within(sections[1]!).getByTestId('report-box').textContent).toContain('C3 · box · J1042 · Lodge rough-in')
    const press = screen.getByTestId('report-print') as HTMLButtonElement
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('an empty site says what fills it, and the press still prints the head', async () => {
    setup(() => Promise.resolve({ places: [], containers: [], movements: [] }))
    const paper = await screen.findByTestId('report-paper')
    expect(within(paper).getByTestId('report-empty').textContent).toBe('Nothing on site yet. A job’s Materials page is where a cage or box is added, and the crew’s phone is where parts are counted into it.')
    expect(within(paper).queryAllByTestId('report-section')).toHaveLength(0)
    expect(within(paper).getByTestId('report-nothing').textContent).toContain('Nothing on site · 3 jobs')
  })

  it('a lost signal draws the retry panel and Retry reads again; a refusal shows its reason with no Retry', async () => {
    let calls = 0
    const { reader } = setup(() => (calls++ === 0 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(rows)))
    await waitFor(() => expect(screen.queryByTestId('report-reading')).toBeNull())
    const press = screen.getByTestId('report-print') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await screen.findByTestId('report-paper')
    expect(reader).toHaveBeenCalledTimes(2)
  })

  it('a refusal shows its reason and offers no Retry', async () => {
    setup(() => Promise.reject(new Error('the ledger did not answer')))
    await waitFor(() => expect(screen.queryByTestId('report-reading')).toBeNull())
    expect(document.body.textContent).toContain('the ledger did not answer')
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
    expect(screen.queryByTestId('report-paper')).toBeNull()
  })

  it('Escape closes the window, and a window opened over it keeps the press', async () => {
    const { onClose } = setup()
    await screen.findByTestId('report-paper')
    const over = registerModal()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    unregisterModal(over)
    fireEvent.keyDown(window, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a long Last recorded and a part with no spaces wrap inside their cells: every word stays on the paper (v2.6536)', async () => {
    const stamp = 'Cowork agent · MCP as Robert'
    const unbroken = 'A'.repeat(120)
    const long: SiteMaterialsRows = { ...rows, movements: [move('m1', 'j1', unbroken, 4, 'delivered', null, A1, '2026-11-02T15:00:00Z', stamp, 'ea')] }
    setup(() => Promise.resolve(long))
    const paper = await screen.findByTestId('report-paper')
    const cell = within(paper).getByTestId('report-line-recorded')
    expect(cell.textContent).toBe(`Nov 2 · ${stamp}`)
    // The cell may take a second line: a cell that stays on one line runs past the box, and the printed page cuts it at the margin.
    expect(cell.style.whiteSpace).not.toBe('nowrap')
    expect(cell.style.overflowWrap).toBe('anywhere')
    const part = within(paper).getByTestId('report-line').firstElementChild as HTMLElement
    expect(part.textContent).toBe(unbroken)
    expect(part.style.whiteSpace).not.toBe('nowrap')
    expect(part.style.overflowWrap).toBe('anywhere')
  })

  it('sits on <body> with the print rules that take the page behind out of the print layout, and the foot in the page’s margin boxes', async () => {
    setup()
    await screen.findByTestId('report-paper')
    const root = [...document.body.children].find((el) => el.classList.contains('site-materials-report'))
    expect(root).toBeTruthy()
    const css = root!.querySelector('style')!.textContent ?? ''
    expect(css).toContain('body > *:not(.site-materials-report) { display: none !important; }')
    expect(css).toContain('@bottom-left { content: "Read from the Materials on site ledger')
    expect(css).toContain('counter(pages)')
    expect(css).toContain('.site-materials-report-foot { display: none !important; }')
    // A phone stacks a line, a screen rule alone: the paper keeps its four columns at every width.
    const phone = css.slice(css.indexOf('@media screen'))
    expect(phone).toContain('.site-materials-report-lines td:nth-child(4) { grid-column: 1 / -1;')
    expect(css.slice(0, css.indexOf('@media screen'))).not.toContain('grid-column')
    expect(css).not.toContain('visibility: hidden')
  })
})
