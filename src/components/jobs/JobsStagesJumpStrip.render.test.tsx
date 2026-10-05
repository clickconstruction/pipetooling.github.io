// @vitest-environment jsdom
/**
 * Render smoke for the Pipeline stage bar (the jump strip of Stages tab decomposition PR 4,
 * pinned and colored in v2.4512): four sections always, Collections only while it has rows,
 * the aria-label nouns, the count and dollars under each name, an empty section greyed in
 * place, the section being scrolled through lit, and the click → section key.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { JobsStagesJumpStrip, StagesLienDeskShortcut, StagesSectionBandTitle } from './JobsStagesJumpStrip'

const counts = { waiting: '21', working: '33', readyToBill: '0', billed: '66', collections: '0' }
const totals = { waiting: '257.3k', working: '391.8k', readyToBill: '0', billed: '348.8k', collections: '0' }
const sectionElementId = (key: string) => `section-${key}`

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('JobsStagesJumpStrip', () => {
  it('renders the four fixed sections with counts, dollars and the right nouns, and hides an empty Collections', () => {
    const onFocusSection = vi.fn()
    render(<JobsStagesJumpStrip counts={counts} totals={totals} onFocusSection={onFocusSection} sectionElementId={sectionElementId} />)
    expect(screen.getByLabelText('Jump to Waiting, 21 jobs').textContent).toBe('Waiting21 · $257.3k')
    expect(screen.getByLabelText('Jump to Working, 33 jobs')).toBeTruthy()
    const rtb = screen.getByLabelText('Jump to Ready to Bill, 0 rows')
    expect(rtb.className).toContain('isEmpty')
    expect(screen.getByLabelText('Jump to Billed Awaiting Payment, 66 rows').textContent).toContain('66 · $348.8k')
    expect(screen.queryByLabelText(/Jump to Collections/)).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Pipeline stages' }).querySelectorAll('button').length).toBe(4)
    // v2.4519: an arrow between neighbours, none before the first or after the last.
    const nav = screen.getByRole('navigation', { name: 'Pipeline stages' })
    expect([...nav.children].map((c) => (c.tagName === 'BUTTON' ? 'stage' : c.textContent?.trim()))).toEqual(['stage', '→', 'stage', '→', 'stage', '→', 'stage'])
    expect(nav.querySelectorAll('.stagesStageArrow[aria-hidden]').length).toBe(3)
    fireEvent.click(screen.getByLabelText('Jump to Billed Awaiting Payment, 66 rows'))
    expect(onFocusSection).toHaveBeenCalledWith('billed')
  })

  it('shows Collections in its red once it has rows, and reports "…" as given', () => {
    const onFocusSection = vi.fn()
    render(
      <JobsStagesJumpStrip
        counts={{ ...counts, billed: '…', collections: '8' }}
        totals={{ ...totals, billed: '…', collections: '24.6k' }}
        onFocusSection={onFocusSection}
        sectionElementId={sectionElementId}
      />,
    )
    const collections = screen.getByLabelText('Jump to Collections, 8 rows')
    expect(collections.style.getPropertyValue('--stage-color')).toBe('#dc2626')
    expect(screen.getByLabelText('Jump to Billed Awaiting Payment, … rows').textContent).toContain('… · $…')
    // The arrow beside Collections points back: a job leaves Collections, it does not move on to it.
    expect([...screen.getByRole('navigation', { name: 'Pipeline stages' }).querySelectorAll('.stagesStageArrow')].map((a) => a.textContent?.trim())).toEqual(['→', '→', '→', '←'])
    fireEvent.click(collections)
    expect(onFocusSection).toHaveBeenCalledWith('collections')
  })

  it('lights the section whose header has reached the bar, follows the scroll, and tells the headers where to land', async () => {
    const header = (key: string, top: number) => {
      const el = document.createElement('div')
      el.id = sectionElementId(key)
      el.getBoundingClientRect = () => ({ top, bottom: top + 40, left: 0, right: 0, width: 0, height: 40, x: 0, y: top, toJSON: () => ({}) })
      document.body.appendChild(el)
      return el
    }
    const waiting = header('waiting', 400)
    const working = header('working', 900)
    render(<JobsStagesJumpStrip counts={counts} totals={totals} onFocusSection={vi.fn()} sectionElementId={sectionElementId} leading={<span>tools</span>} />)
    const lit = () => [...document.querySelectorAll('[aria-current="location"]')].map((b) => b.getAttribute('aria-label'))
    // The top of the page: no header has reached the bar.
    expect(lit()).toEqual([])
    expect(document.documentElement.style.getPropertyValue('--stages-jump-offset')).toBe('8px')
    expect(screen.getByText('tools')).toBeTruthy()

    waiting.getBoundingClientRect = () => ({ top: -300, bottom: -260, left: 0, right: 0, width: 0, height: 40, x: 0, y: -300, toJSON: () => ({}) })
    working.getBoundingClientRect = () => ({ top: 10, bottom: 50, left: 0, right: 0, width: 0, height: 40, x: 0, y: 10, toJSON: () => ({}) })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
    })
    expect(lit()).toEqual(['Jump to Working, 33 jobs'])
  })
})

describe('the Lien desk shortcut (v2.4520)', () => {
  it('rides beside the last stage, shows the count while there is one, and opens the desk', () => {
    const onOpen = vi.fn()
    const view = render(
      <JobsStagesJumpStrip
        counts={{ ...counts, collections: '7' }}
        totals={{ ...totals, collections: '19.3k' }}
        onFocusSection={vi.fn()}
        sectionElementId={sectionElementId}
        tail={<StagesLienDeskShortcut count={23} onOpen={onOpen} />}
      />,
    )
    const gavel = screen.getByRole('button', { name: 'Open the Lien desk, 23 to work' })
    expect(gavel.textContent).toBe('23')
    const group = gavel.parentElement!
    expect(group.className).toContain('stagesStageSegTail')
    expect(group.firstElementChild).toBe(screen.getByLabelText('Jump to Collections, 7 rows'))
    fireEvent.click(gavel)
    expect(onOpen).toHaveBeenCalledTimes(1)

    // Collections empty: the shortcut moves beside Billed Awaiting Payment, the last stage drawn.
    view.rerender(
      <JobsStagesJumpStrip counts={counts} totals={totals} onFocusSection={vi.fn()} sectionElementId={sectionElementId} tail={<StagesLienDeskShortcut count={0} onOpen={onOpen} />} />,
    )
    const quiet = screen.getByRole('button', { name: 'Open the Lien desk' })
    expect(quiet.textContent).toBe('')
    expect(quiet.parentElement!.firstElementChild).toBe(screen.getByLabelText('Jump to Billed Awaiting Payment, 66 rows'))
    expect(quiet.parentElement!.className).toContain('isWide')
  })

  it('draws no group when no shortcut is handed in', () => {
    const { container } = render(<JobsStagesJumpStrip counts={counts} totals={totals} onFocusSection={vi.fn()} sectionElementId={sectionElementId} />)
    expect(container.querySelector('.stagesStageSegTail')).toBeNull()
  })
})

describe('StagesSectionBandTitle', () => {
  it('draws the name, the count in its pill and the dollars; no dollars when none are given', () => {
    const { container, rerender } = render(<StagesSectionBandTitle label="Working" count="29" total="391.8k" />)
    expect(container.textContent).toBe('Working 29 $391.8k')
    expect(container.querySelector('.stagesBandCount')?.textContent).toBe('29')
    expect(container.querySelector('.stagesMoney')?.textContent).toBe('$391.8k')
    rerender(<StagesSectionBandTitle label="Working" count="…" />)
    expect(container.querySelector('.stagesMoney')).toBeNull()
  })
})
