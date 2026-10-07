// @vitest-environment jsdom
/**
 * § Rules as a window (v2.4655): the door opens the rules guide over the desk at the rule for
 * what is on screen, the find box marks and narrows, Enter walks the matches, Esc closes it alone.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderSmokeMocks'
import { LienRulesDoor } from './LienRulesDoor'
import { lienRulesJobFrom } from '../../lib/jobs/lienRulesDates'

afterEach(cleanup)

// The window is a lazy chunk (v2.4695) that carries every help guide; its first import can take
// longer than a findBy wait under a full CI run. Load it once here so React.lazy resolves from the
// module cache, and each test still goes through the door's lazy path.
beforeAll(async () => {
  await import('./LienRulesModal')
})

describe('LienRulesDoor', () => {
  it('opens the rules in a window at the rule for the surface, not a new page', async () => {
    render(<LienRulesDoor where="desk_notice" />)
    const door = screen.getByTestId('lien-rules-door')
    expect(door.tagName).toBe('BUTTON')
    expect(screen.queryByTestId('lien-rules-modal')).toBeNull()
    fireEvent.click(door)
    // The window is a lazy chunk (v2.4695): it arrives after the import resolves.
    expect(await screen.findByTestId('lien-rules-modal')).toBeTruthy()
    expect(screen.getByTestId('lien-rules-modal-at').textContent).toBe('What the notice is and where it goes')
    const body = screen.getByTestId('lien-rules-body')
    expect(body.textContent).toContain('Every lien deadline and every line in a demand letter comes from a rule in Texas law.')
    // The rule for the surface is marked open just after the window paints: wait for it, or a busy CI box
    // reads the body a tick early (the flake on #4775, #4838 and #4849).
    const opened = await waitFor(() => {
      const el = body.querySelector<HTMLElement>('[data-rule-opened="yes"]')
      expect(el).not.toBeNull()
      return el!
    })
    expect(opened.id).toBe('what-the-notice-is-and-where-it-goes')
    expect(opened.getAttribute('aria-expanded')).toBe('true')
    expect(opened.querySelector('[data-rule-cite]')?.textContent).toBe('§ 53.056(a-1) to (a-3), § 53.003')
    expect((screen.getByTestId('lien-rules-open-page') as HTMLAnchorElement).getAttribute('target')).toBe('_blank')
  })
  it('folds every other rule to its question and its lead; a press on the question unfolds it; the rail lists the groups and jumps (v2.4826)', async () => {
    render(<LienRulesDoor where="desk_notice" />)
    fireEvent.click(screen.getByTestId('lien-rules-door'))
    await screen.findByTestId('lien-rules-modal')
    const body = screen.getByTestId('lien-rules-body')
    const clock = body.querySelector<HTMLElement>('h3#when-each-date-falls')!
    expect(clock.getAttribute('aria-expanded')).toBe('false')
    const members = Array.from(body.querySelectorAll<HTMLElement>('[data-rule-of="when-each-date-falls"]'))
    expect(members.length).toBeGreaterThan(2)
    expect(members.filter((m) => m.getAttribute('data-folded') === 'no')).toHaveLength(1)
    fireEvent.click(clock)
    expect(clock.getAttribute('aria-expanded')).toBe('true')
    expect(members.every((m) => m.getAttribute('data-folded') === 'no')).toBe(true)
    // The counsel line stays out folded or not; the page's own sections are folded away.
    expect(body.querySelector('[data-rule-counsel]')?.getAttribute('data-folded')).toBe('no')
    expect(body.querySelector('h2#find-a-rule')?.hasAttribute('data-page-section')).toBe(true)
    const rail = screen.getByTestId('lien-rules-rail')
    expect(rail.textContent).toContain('The clock')
    expect(rail.textContent).not.toContain('Find a rule')
    const row = rail.querySelector<HTMLElement>('[data-rule-row="what-a-justice-court-can-hear"]')!
    fireEvent.click(row)
    expect(body.querySelector('h3#what-a-justice-court-can-hear')?.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByTestId('lien-rules-fold-all'))
    expect(body.querySelectorAll('h3[data-rule][aria-expanded="true"]')).toHaveLength(Array.from(body.querySelectorAll('h3[data-rule]')).length)
  })
  it('names the desk\'s job with its two dates and lights its row in the clock table; no job, no strip and live months around today', async () => {
    const months = [{ key: '2026-06' }, { key: '2026-07' }]
    const job = lienRulesJobFrom({ label: '804 · Summit GC- Auto Zone', propertyKind: 'non_residential', isSub: true, months, earliestDeadline: '2026-10-15' }, '2026-10-07')
    render(<LienRulesDoor where="desk_notice" job={job} todayYmd="2026-10-07" />)
    fireEvent.click(screen.getByTestId('lien-rules-door'))
    await screen.findByTestId('lien-rules-modal')
    const strip = screen.getByTestId('lien-rules-job')
    expect(strip.textContent).toContain('804 · Summit GC- Auto Zone')
    expect(screen.getByTestId('lien-rules-job-notice').textContent).toBe('Oct 15')
    expect(screen.getByTestId('lien-rules-job-lien').textContent).toBe('Nov 16')
    const body = screen.getByTestId('lien-rules-body')
    const lit = body.querySelector<HTMLElement>('table[data-live-dates] tr[data-lit="yes"]')!
    expect(lit.firstElementChild?.textContent).toBe('July')
    cleanup()
    render(<LienRulesDoor where="window_demand" todayYmd="2026-10-07" />)
    fireEvent.click(screen.getByTestId('lien-rules-door'))
    await screen.findByTestId('lien-rules-modal')
    expect(screen.queryByTestId('lien-rules-job')).toBeNull()
    const rows = Array.from(screen.getByTestId('lien-rules-body').querySelectorAll('table[data-live-dates] tbody tr'))
    expect(rows.map((r) => r.firstElementChild?.textContent)).toEqual(['June', 'July', 'August'])
    expect(rows.some((r) => r.getAttribute('data-lit') === 'yes')).toBe(false)
  })
  it('the find box marks and narrows, Show all brings the guide back, and Esc closes the window alone', async () => {
    render(<LienRulesDoor where="desk_affidavit" />)
    fireEvent.click(screen.getByTestId('lien-rules-door'))
    await screen.findByTestId('lien-rules-modal')
    vi.useFakeTimers()
    try {
      expect(screen.getByTestId('lien-rules-modal-at').textContent).toBe('What the affidavit needs before it can be filed')
      const body = screen.getByTestId('lien-rules-body')
      const all = body.children.length
      fireEvent.change(screen.getByTestId('lien-rules-find'), { target: { value: 'homestead' } })
      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      const marks = body.querySelectorAll('mark[data-find]')
      expect(marks.length).toBeGreaterThan(0)
      expect(screen.getByTestId('lien-rules-found').textContent).toMatch(/^\d+ matches in \d+ sections$/)
      const hidden = Array.from(body.children).filter((el) => (el as HTMLElement).hidden).length
      expect(hidden).toBeGreaterThan(0)
      expect(hidden).toBeLessThan(all)
      // A rule the find hit unfolds while the find lasts.
      expect(body.querySelector('h3#a-homestead-needs-one-more-statement')?.getAttribute('aria-expanded')).toBe('true')
      fireEvent.keyDown(screen.getByTestId('lien-rules-find'), { key: 'Enter' })
      expect(body.querySelectorAll('mark[data-find-at="yes"]')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      expect(body.querySelectorAll('mark[data-find]')).toHaveLength(0)
      expect(Array.from(body.children).filter((el) => (el as HTMLElement).hidden)).toHaveLength(0)
      expect(body.querySelector('h3#a-homestead-needs-one-more-statement')?.getAttribute('aria-expanded')).toBe('false')
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByTestId('lien-rules-modal')).toBeNull()
      expect(screen.getByTestId('lien-rules-door')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
