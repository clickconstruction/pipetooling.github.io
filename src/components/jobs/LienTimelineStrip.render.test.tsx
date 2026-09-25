// @vitest-environment jsdom
/**
 * Steps · Windows (v2.3815, punch list #42): the strip opens on Steps — today's rail plus the
 * green first-day line — and the corner switch draws the same path as windows, remembered in
 * this browser. The mini row has no switch.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LienTimelineStrip from './LienTimelineStrip'
import { buildLienTimeline } from '../../lib/jobs/lienTimeline'
import { setLienTimelineView } from '../../hooks/useLienTimelineView'

const timeline = buildLienTimeline({
  todayYmd: '2026-09-24',
  isSub: true,
  propertyKind: '',
  lastMonth: '2026-08',
  lastMonthFromCreation: false,
  months: [
    { key: '2026-03', deadline: '2026-06-15', fromCreation: false, outcome: 'missed', at: '' },
    { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
    { key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' },
  ],
  noticeState: 'needs_owner',
  retainage: null,
  affidavit: null,
  originalContractCompletedOn: null,
  releasedAt: null,
  paid: false,
})

describe('LienTimelineStrip — Steps · Windows', () => {
  it('opens on Steps with the first-day line, then switches to Windows and remembers it', () => {
    setLienTimelineView('steps')
    const { container } = render(<LienTimelineStrip timeline={timeline} layout="row" />)
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    expect(screen.getByText('open since Aug 1')).toBeTruthy()
    expect(screen.getByText('opens when the notice is mailed')).toBeTruthy()
    expect(container.querySelector('[data-lien-timeline-windows-aside]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Windows' }))
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('windows')
    expect(container.querySelector('[data-lien-timeline-window="notice:2026-07"]')?.textContent).toContain('Aug 1 → Oct 15 · 21 of 75 days left')
    expect(container.querySelector('[data-lien-timeline-window="affidavit"]')?.textContent).toContain('opens when the notice is mailed · by Dec 15')
    expect(container.querySelector('[data-lien-timeline-windows-closed]')?.textContent).toContain('Mar closed Jun 15 — it was open Apr 1 → Jun 15')
    expect(container.querySelector('[data-lien-timeline-windows-aside]')?.textContent).toContain('the lien can be filed any day until Dec 15')
    expect(window.localStorage.getItem('lienTimelineView')).toBe('windows')

    fireEvent.click(screen.getByRole('button', { name: 'Steps' }))
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    expect(window.localStorage.getItem('lienTimelineView')).toBe('steps')
  })

  it('the mini row never changes and has no switch', () => {
    setLienTimelineView('windows')
    const { container } = render(<LienTimelineStrip timeline={timeline} layout="mini" withNext={false} />)
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    expect(screen.queryByRole('button', { name: 'Windows' })).toBeNull()
    expect(container.querySelector('[data-lien-timeline-opens]')).toBeNull()
    setLienTimelineView('steps')
  })
})
