// @vitest-environment jsdom
/**
 * The paper behind a Do now chip (v2.4632): the banner counts the blanks, the paper carries the
 * painted marks, the rail lists them with the row's button, the arrows walk the rows and Esc
 * closes the preview alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderSmokeMocks'
import LienPaperPreviewOverlay, { type LienPaperPreviewEntry } from './LienPaperPreviewOverlay'
import { lienPaperGaps, paintGaps, gapToken } from '../../lib/jobs/lienPaperGaps'

afterEach(cleanup)

const facts = { ownerName: '', ownerAddress: '', county: '', legalDescription: '', gcName: 'Loberg Contracting', contactPerson: 'Robert Douglas', claimantAddress: '5501 Balcones Dr' }
const noticeGaps = lienPaperGaps('notice', facts)
const affGaps = lienPaperGaps('affidavit', facts)
const entries: LienPaperPreviewEntry[] = [
  { key: 'a', title: '838 · Bruce Hall', kind: 'affidavit', deadline: 'File by Oct 15 · 10 days left', envelope: null, html: paintGaps(`<p>COUNTY OF ${gapToken(1)}</p><p>Legal: ${gapToken(2)}</p><p>Owner: ${gapToken(3)}</p>`, affGaps), gaps: affGaps, next: 'Draft affidavit', button: 'Fix the property' },
  { key: 'n', title: '804 · Summit GC- Auto Zone', kind: 'notice', deadline: 'In the mail by Oct 15 · 10 days left', envelope: { ownerHtml: paintGaps(gapToken(1), noticeGaps), gcHtml: 'Loberg Contracting' }, html: '<p>Notice of Claim</p>', gaps: noticeGaps, next: 'Draft notice', button: 'Find the owner' },
  { key: 'w', title: '878 · Take 5- Seguin', kind: 'notice', deadline: 'In the mail by Oct 15 · 10 days left', envelope: { ownerHtml: 'TC/JP SEGUIN 2019 LLC', gcHtml: 'Take 5' }, html: '<p>Notice of Claim</p>', gaps: [], next: 'Approve', button: null },
]

describe('LienPaperPreviewOverlay', () => {
  it('counts the blanks in the banner, paints them on the paper, lists them with the row’s button, and acts from the rail', () => {
    const onAct = vi.fn()
    const onClose = vi.fn()
    render(<LienPaperPreviewOverlay entries={entries} index={0} onIndex={() => {}} onClose={onClose} onAct={onAct} />)
    expect(screen.getByTestId('lien-paper-preview-title').textContent).toBe('838 · Bruce Hall · Affidavit')
    const banner = screen.getByTestId('lien-paper-preview-banner')
    expect(banner.getAttribute('data-tone')).toBe('red')
    expect(banner.textContent).toContain('3 details missing before this affidavit can be filed.')
    expect(screen.getByTestId('lien-paper-preview-paper').querySelectorAll('.lienPaperGap')).toHaveLength(3)
    expect(screen.queryByTestId('lien-paper-preview-envelope')).toBeNull()
    const rail = screen.getAllByTestId('lien-paper-preview-gap')
    expect(rail.map((el) => el.textContent?.slice(0, 20))).toEqual(['1CountyThe affidavit', '2Legal descriptionTh', '3Owner of recordThe '])
    fireEvent.click(screen.getAllByTestId('lien-paper-preview-fix')[0]!)
    expect(onAct).toHaveBeenCalledWith(0)
    expect(screen.getByTestId('lien-paper-preview-count').textContent).toBe('1 of 3')
  })
  it("a notice draws its envelope line with the owner gap painted there; the arrows and keys walk the rows; a whole paper's banner is green", () => {
    const onIndex = vi.fn()
    const view = render(<LienPaperPreviewOverlay entries={entries} index={1} onIndex={onIndex} onClose={() => {}} onAct={() => {}} />)
    expect(screen.getByTestId('lien-paper-preview-envelope').querySelector('.lienPaperGap')?.textContent).toBe('1Owner of record')
    expect(screen.getByTestId('lien-paper-preview-banner').textContent).toContain('1 detail missing before this notice can go.')
    expect(screen.getByTestId('lien-paper-preview-fix').textContent).toBe('Find the owner')
    fireEvent.click(screen.getByRole('button', { name: 'Next row' }))
    expect(onIndex).toHaveBeenCalledWith(2)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onIndex).toHaveBeenCalledWith(0)
    view.unmount()
    render(<LienPaperPreviewOverlay entries={entries} index={2} onIndex={() => {}} onClose={() => {}} onAct={() => {}} />)
    const banner = screen.getByTestId('lien-paper-preview-banner')
    expect(banner.getAttribute('data-tone')).toBe('green')
    expect(banner.textContent).toContain('Nothing missing. Ready for the next step: Approve.')
    expect(screen.queryByTestId('lien-paper-preview-gap')).toBeNull()
  })
  it('Esc closes the preview and nothing else', () => {
    const onClose = vi.fn()
    render(<LienPaperPreviewOverlay entries={entries} index={0} onIndex={() => {}} onClose={onClose} onAct={() => {}} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('with onFix, each blank opens its window from the paper; the paper pauses its keys while one is open; filled blanks come back green (v2.4719)', () => {
    const onFix = vi.fn()
    const onAct = vi.fn()
    const onClose = vi.fn()
    const gcFacts = { ...facts, gcName: '' }
    const gaps = lienPaperGaps('affidavit', gcFacts)
    const entry: LienPaperPreviewEntry = { ...entries[0]!, gaps, filled: [{ key: 'county', label: 'County', value: 'Guadalupe' }] }
    const view = render(<LienPaperPreviewOverlay entries={[entry]} index={0} onIndex={() => {}} onClose={onClose} onAct={onAct} onFix={onFix} />)
    expect(screen.getAllByTestId('lien-paper-preview-fix').map((b) => b.textContent)).toEqual(['Fix the property', 'Fix the property', 'Fix the property', 'Pick the GC'])
    fireEvent.click(screen.getAllByTestId('lien-paper-preview-fix')[3]!)
    expect(onFix).toHaveBeenCalledWith(0, expect.objectContaining({ key: 'gc' }))
    expect(onAct).not.toHaveBeenCalled()
    expect(screen.getByTestId('lien-paper-preview-filled').textContent).toBe('✓CountyGuadalupe')
    view.rerender(<LienPaperPreviewOverlay entries={[entry]} index={0} onIndex={() => {}} onClose={onClose} onAct={onAct} onFix={onFix} paused />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
