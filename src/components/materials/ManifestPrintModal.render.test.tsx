// @vitest-environment jsdom
/**
 * Render smoke for Print the manifest (punch list #209): one page per box picked, each with the two
 * dates, the items and the box's QR; a chip unpicks a box and the press names its new count; an empty box gets a
 * page of ruled lines; the press calls print with the pages picked.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import ManifestPrintModal from './ManifestPrintModal'
import { containerLines, type Container, type Movement } from '../../lib/materials/onSite'
import { MANIFEST_MIN_ROWS } from '../../lib/materials/containerManifest'

const A1 = '7d759246-8476-4a37-884f-ed1562d5663f'
const C3 = '5e6f7a8b-0000-4000-8000-000000000003'
const UNS = 'ffffffff-0000-4000-8000-00000000000f'

const container = (id: string, label: string, kind: Container['kind'], extra: Partial<Container> = {}): Container => ({ id, jobId: 'j1', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T12:00:00Z', ...extra })
const move = (id: string, partName: string, quantity: number, reason: Movement['reason'], from: string | null, to: string | null, at: string, byName = 'Jordan'): Movement => ({ id, jobId: 'j1', partId: null, partName, manufacturer: null, quantity, reason, fromContainerId: from, toContainerId: to, note: '', byUserId: null, byName, at, source: null, itemId: null })

const containers = [container(UNS, 'Unsorted', 'unsorted'), container(C3, 'C3', 'box', { locationId: 'p1' }), container(A1, 'A1', 'cage', { locationId: 'p1' })]
const places = [{ id: 'p1', name: 'Level 2' }]
const movements = [
  move('m1', '3/4" copper 90', 100, 'delivered', null, UNS, '2026-10-02T15:00:00Z', 'Office'),
  move('m2', '3/4" copper 90', 60, 'moved', UNS, A1, '2026-10-03T15:00:00Z', 'Mateo'),
  move('m3', '1/2" ball valve', 12, 'delivered', null, A1, '2026-10-05T15:00:00Z', 'Office'),
  move('m4', '3/4" copper 90', 10, 'used', A1, null, '2026-10-28T23:30:00Z', 'Jordan'),
]

function setup(only: string | null = null) {
  const print = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(<ManifestPrintModal jobLabel="Job 972 · Ridgeway School" site="400 Ridgeway Dr, Blanco, TX" containers={containers} lines={containerLines(movements)} movements={movements} places={places} only={only} onClose={onClose} print={print} />)
  return { print, onClose }
}

describe('ManifestPrintModal', () => {
  it('opens on every box with one page each, the two dates and the items as the ledger reads them', () => {
    setup()
    const pages = screen.getAllByTestId('manifest-page')
    expect(pages.map((p) => p.getAttribute('aria-label'))).toEqual(['Manifest for A1', 'Manifest for C3'])
    expect(screen.getByTestId('manifest-print').textContent).toBe('Print 2 manifests')
    expect(screen.getByTestId('manifest-pick-words').textContent).toBe('Every box on this job, 2 pages, one a box.')

    const a1 = pages[0]!
    expect(a1.textContent).toContain('Job 972 · Ridgeway School')
    expect(a1.textContent).toContain('400 Ridgeway Dr, Blanco, TX')
    expect(a1.textContent).toContain('cage · Level 2')
    expect(within(a1).getByTestId('manifest-printed-on').textContent).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/)
    expect(within(a1).getByTestId('manifest-last-recorded').textContent).toBe('October 28, 2026 by Jordan')
    expect(within(a1).getAllByTestId('manifest-item').map((r) => r.textContent)).toEqual(['1/2" ball valve12', '3/4" copper 9050'])
    const qr = within(a1).getByTestId('manifest-qr')
    expect(qr.querySelector('svg')).toBeTruthy()
    // v2.6796: the code reads for a person with its dash; the QR's value stays the bare address.
    expect(qr.textContent).toBe('7D75-9246')
    expect(a1.textContent).toContain('go to prts.co/b/7D75-9246')
    expect(within(a1).getAllByTestId('manifest-blank-row')).toHaveLength(MANIFEST_MIN_ROWS - 2)
    expect(within(a1).getByTestId('manifest-added').textContent).toContain('Item')
    expect(a1.textContent).toContain('Added on site')
  })

  it('gives an empty box a page that says so, with a full block of ruled lines', () => {
    setup()
    const c3 = screen.getAllByTestId('manifest-page')[1]!
    expect(within(c3).getByTestId('manifest-last-recorded').textContent).toBe('Nothing recorded yet')
    expect(c3.textContent).toContain('Empty when printed. Write what goes in below.')
    expect(within(c3).queryAllByTestId('manifest-item')).toHaveLength(0)
    expect(within(c3).getAllByTestId('manifest-blank-row')).toHaveLength(MANIFEST_MIN_ROWS)
  })

  it('a chip unpicks a box, the press counts again, and None leaves the press dead', () => {
    const { print } = setup()
    fireEvent.click(screen.getByRole('button', { name: '✓ C3' }))
    expect(screen.getAllByTestId('manifest-page')).toHaveLength(1)
    expect(screen.getByTestId('manifest-print').textContent).toBe('Print 1 manifest')
    expect(screen.getByTestId('manifest-pick-words').textContent).toBe('1 of 2 boxes, one page each.')
    fireEvent.click(screen.getByTestId('manifest-print'))
    expect(print).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'None' }))
    expect(screen.queryAllByTestId('manifest-page')).toHaveLength(0)
    const press = screen.getByTestId('manifest-print') as HTMLButtonElement
    expect(press.textContent).toBe('Print manifests')
    expect(press.disabled).toBe(true)
    expect(screen.getByTestId('manifest-pick-words').textContent).toBe('Pick a box to print.')

    fireEvent.click(screen.getByRole('button', { name: 'Every box' }))
    expect(screen.getAllByTestId('manifest-page')).toHaveLength(2)
  })

  it('sits on <body> with the print rules that take the page behind out of the print layout (v2.6432)', () => {
    setup()
    const root = [...document.body.children].find((el) => el.classList.contains('on-site-manifest'))
    expect(root).toBeTruthy()
    const css = root!.querySelector('style')!.textContent ?? ''
    expect(css).toContain('body > *:not(.on-site-manifest) { display: none !important; }')
    expect(css).not.toContain('visibility: hidden')
  })

  it('opens on one box alone from the phone’s link', () => {
    setup(C3)
    expect(screen.getAllByTestId('manifest-page').map((p) => p.getAttribute('aria-label'))).toEqual(['Manifest for C3'])
    expect(screen.getByTestId('manifest-print').textContent).toBe('Print 1 manifest')
  })
})
