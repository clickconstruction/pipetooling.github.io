// @vitest-environment jsdom
/**
 * The Lien window's steps on a phone (v2.4398): one strip that says the next step, who we wait
 * on and any window that closed; a press drops the steps down, and the strip, the grey behind
 * them and Escape put them away. Wiring only: the words are lienTimelineFoldSummary's.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LienWindowFoldedSteps from './LienWindowFoldedSteps'
import { buildLienTimeline } from '../../lib/jobs/lienTimeline'

afterEach(() => cleanup())

const timeline = buildLienTimeline({
  todayYmd: '2026-10-02',
  isSub: true,
  propertyKind: 'commercial',
  lastMonth: '2026-09',
  lastMonthFromCreation: false,
  months: [
    { key: '2026-06', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '' },
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

const strip = () => document.querySelector('[data-lien-window-fold-strip]') as HTMLButtonElement
const panel = () => document.querySelector('[data-lien-window-fold-panel]') as HTMLElement | null

describe('LienWindowFoldedSteps', () => {
  it('folded: the strip says the next step, who we wait on and the closed window; no steps are drawn', () => {
    render(<LienWindowFoldedSteps timeline={timeline} foot={<button type="button">lientooling.com ↗</button>} />)
    expect(strip().getAttribute('aria-expanded')).toBe('false')
    expect(strip().textContent).toContain(timeline.next.words)
    expect(strip().textContent).toContain('waiting on us')
    expect(document.querySelector('[data-lien-window-fold-closed]')?.textContent).toBe('1 window closed')
    expect(panel()).toBeNull()
    expect(screen.queryByText('lientooling.com ↗')).toBeNull()
  })

  it('a press drops the steps and the foot; the sentence is not said twice', () => {
    render(<LienWindowFoldedSteps timeline={timeline} foot={<button type="button">lientooling.com ↗</button>} />)
    fireEvent.click(strip())
    expect(strip().getAttribute('aria-expanded')).toBe('true')
    expect(strip().getAttribute('aria-controls')).toBe(panel()!.id)
    expect(panel()!.querySelector('[data-lien-timeline]')?.getAttribute('data-layout')).toBe('list')
    expect(panel()!.textContent).toContain('§ 53.052')
    expect(panel()!.querySelector('[data-lien-timeline-next]')).toBeNull()
    expect(panel()!.querySelector('[data-lien-timeline-waiting]')).toBeNull()
    expect(screen.getByText('lientooling.com ↗')).toBeTruthy()
  })

  it('the strip, the grey behind the steps and Escape each put them away', () => {
    render(<LienWindowFoldedSteps timeline={timeline} />)
    fireEvent.click(strip())
    fireEvent.click(strip())
    expect(panel()).toBeNull()
    fireEvent.click(strip())
    fireEvent.click(document.querySelector('[data-lien-window-fold-scrim]')!)
    expect(panel()).toBeNull()
    fireEvent.click(strip())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(panel()).toBeNull()
  })
})
