// @vitest-environment jsdom
/**
 * A stop's paper (v2.4793): the window from a stop's title — the paper on the left, the stop's facts
 * and act on the right, ‹ › and the arrows walking the stops, Esc closing this alone, and the
 * words that stand in for a page on a stop with no paper of ours.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderSmokeMocks'
import LienStopPaperWindow, { type LienStopPaper } from './LienStopPaperWindow'
import { buildLienTimeline } from '../../lib/jobs/lienTimeline'

const timeline = buildLienTimeline({
  todayYmd: '2026-10-07',
  isSub: true,
  propertyKind: 'non_residential',
  lastMonth: '2026-08',
  lastMonthFromCreation: false,
  months: [
    { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
    { key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' },
  ],
  noticeState: 'to_draft',
  retainage: null,
  affidavit: null,
  originalContractCompletedOn: null,
  releasedAt: null,
  paid: false,
})

const paperFor = (step: { kind: string }): LienStopPaper =>
  step.kind === 'notice'
    ? { pages: [{ key: 'notice', label: 'Page 1 of 1 · the notice', html: '<p>NOTICE OF CLAIM</p>' }], envelope: 'To JBI LIBERTY HILL LLC and Burd & Assoc. by certified mail', before: [{ key: 'owner', words: 'Owner of record: missing' }], record: null, act: { label: 'Go to the paper on the desk ▾', onPress: vi.fn() }, noticeMonths: ['2026-07', '2026-08'] }
    : { pages: [], envelope: null, before: [], record: null, act: null }

describe('LienStopPaperWindow', () => {
  it('opens on a notice stop with its pages, envelope, blanks, rule and act, names every month the draft carries, and walks the stops', () => {
    const onIndex = vi.fn()
    const onClose = vi.fn()
    const jul = timeline.steps.findIndex((s) => s.key === 'notice:2026-07')
    render(<LienStopPaperWindow steps={timeline.steps} index={jul} onIndex={onIndex} onClose={onClose} jobLabel="891 · Take 5- Liberty Hill" paperFor={paperFor} />)
    expect(screen.getByTestId('lien-stop-paper-eyebrow').textContent).toBe('§ 53.056 · Jul')
    expect(screen.getByTestId('lien-stop-paper-title').textContent).toBe('The July and August 2026 notice')
    expect(screen.getByTestId('lien-stop-paper-line').textContent).toContain('go on one notice')
    expect(screen.getByTestId('lien-stop-paper-count').textContent).toBe(`stop ${jul + 1} of ${timeline.steps.length} · 891 · Take 5- Liberty Hill`)
    expect(screen.getByTestId('lien-stop-paper-page').textContent).toContain('NOTICE OF CLAIM')
    expect(screen.getByTestId('lien-stop-paper-envelope').textContent).toContain('Burd & Assoc.')
    expect(screen.getByTestId('lien-stop-paper-before').textContent).toBe('Owner of record: missing')
    expect(screen.getByTestId('lien-stop-paper-rule').textContent).toBe('§ 53.056 · What the notice is and where it goes ›')
    expect(screen.getByTestId('lien-stop-paper-act').textContent).toBe('Go to the paper on the desk ▾')
    fireEvent.click(screen.getByRole('button', { name: 'Next stop' }))
    expect(onIndex).toHaveBeenCalledWith(jul + 1)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onIndex).toHaveBeenCalledWith(jul - 1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('a stop with no paper of ours shows the words instead of a page, and no envelope', () => {
    const last = timeline.steps.findIndex((s) => s.kind === 'last_work')
    render(<LienStopPaperWindow steps={timeline.steps} index={last} onIndex={() => {}} onClose={() => {}} jobLabel="891" paperFor={paperFor} />)
    expect(screen.getByTestId('lien-stop-paper-title').textContent).toBe('The last day of work')
    expect(screen.getByTestId('lien-stop-paper-none').textContent).toContain('Nothing goes out at this stop.')
    expect(screen.queryByTestId('lien-stop-paper-page')).toBeNull()
    expect(screen.queryByTestId('lien-stop-paper-envelope')).toBeNull()
    expect(screen.getByTestId('lien-stop-paper-rule').textContent).toBe('§ 53.003 · When each date falls ›')
    expect(screen.getByRole('button', { name: 'Previous stop' }).hasAttribute('disabled')).toBe(true)
    cleanup()
  })

  it('a done stop with a mailed packet shows the record and its document', () => {
    const jul = timeline.steps.findIndex((s) => s.key === 'notice:2026-07')
    const sent = (): LienStopPaper => ({ pages: [], envelope: 'To the owner', before: [], record: { words: 'Mailed Oct 3', href: 'https://example.test/packet.pdf' }, act: null })
    render(<LienStopPaperWindow steps={timeline.steps} index={jul} onIndex={() => {}} onClose={() => {}} jobLabel="891" paperFor={sent} />)
    expect(screen.getByTestId('lien-stop-paper-empty').textContent).toContain('Mailed Oct 3')
    expect(screen.getByRole('link', { name: 'Open the mailed packet ↗' }).getAttribute('href')).toBe('https://example.test/packet.pdf')
    cleanup()
  })

  it('with the timeline the footer carries the path folded to dots, opens on press and remembers it; a hold line says why the stop cannot go, with its door (v2.4806)', () => {
    try { window.localStorage.removeItem('lienStopPathOpen') } catch { /* no storage */ }
    const jul = timeline.steps.findIndex((s) => s.key === 'notice:2026-07')
    const onPress = vi.fn()
    render(<LienStopPaperWindow steps={timeline.steps} index={jul} onIndex={() => {}} onClose={() => {}} jobLabel="891" paperFor={paperFor} timeline={timeline} holdFor={(s) => (s.kind === 'notice' ? { words: "Don't send yet. Enter the owner of record and a mailing address on the property record first.", short: 'owner of record missing', act: { label: 'Go to gate 1 ▴', onPress } } : null)} />)
    expect(screen.getByTestId('lien-stop-paper-foot').getAttribute('data-hold')).toBe('yes')
    expect(screen.getByTestId('lien-stop-paper-hold').textContent).toBe("Don't send yet. Enter the owner of record and a mailing address on the property record first.")
    fireEvent.click(screen.getByTestId('lien-stop-paper-hold-act'))
    expect(onPress).toHaveBeenCalledTimes(1)
    // The header no longer counts the stops; the dots do, and the path is folded.
    expect(screen.getByTestId('lien-stop-paper-count').textContent).toBe('891')
    const dots = screen.getByTestId('lien-stop-paper-dots')
    expect(dots.textContent).toContain(`stop ${jul + 1} of ${timeline.steps.length}`)
    expect(dots.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('lien-stop-paper-path')).toBeNull()
    fireEvent.click(dots)
    expect(dots.getAttribute('aria-expanded')).toBe('true')
    const path = screen.getByTestId('lien-stop-paper-path')
    expect(path.querySelector('[data-lien-timeline-lit]')).toBeTruthy()
    expect(path.querySelector('[data-lien-timeline-step="notice:2026-07"] [data-lien-timeline-lit]')).toBeTruthy()
    expect(path.querySelector('[data-lien-timeline-blocked]')?.textContent).toBe('✗ owner of record missing')
    expect(window.localStorage.getItem('lienStopPathOpen')).toBe('yes')
    cleanup()
    // Remembered: the next window opens with the path showing; a stop that can go has the grey footer and no chip.
    render(<LienStopPaperWindow steps={timeline.steps} index={jul} onIndex={() => {}} onClose={() => {}} jobLabel="891" paperFor={paperFor} timeline={timeline} holdFor={() => null} />)
    expect(screen.getByTestId('lien-stop-paper-foot').getAttribute('data-hold')).toBe('no')
    expect(screen.getByTestId('lien-stop-paper-path').querySelector('[data-lien-timeline-blocked]')).toBeNull()
    expect(screen.queryByTestId('lien-stop-paper-hold')).toBeNull()
    try { window.localStorage.removeItem('lienStopPathOpen') } catch { /* no storage */ }
    cleanup()
  })
})
