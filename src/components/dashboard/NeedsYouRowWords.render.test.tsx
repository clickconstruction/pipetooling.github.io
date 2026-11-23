// @vitest-environment jsdom
/**
 * A Needs you row's words (punch list #424): a plain row draws its title and its sentence as it always did, and a
 * row that carries `shown` draws its values apart from its words, in the Needs you card as well as by itself.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NeedsYouItem } from '../../lib/dashboardNeedsYou'
import { DashboardNeedsYouCard } from './DashboardNeedsYouCard'
import { NeedsYouRowWords } from './NeedsYouRowWords'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

afterEach(cleanup)

const SENDS: NeedsYouItem = {
  key: 'todays-sends',
  severity: 'amber',
  kicker: 'Texts to customers',
  title: '2 texts to send',
  detail: 'Dana Whitfield · Sam Ortiz · 1 · Tue 9:00 AM · 1 held · no number',
  figure: '2',
  actionLabel: 'Read them',
  shown: {
    title: '⟪n|2⟫ texts to send',
    names: '⟪who|Dana Whitfield⟫ · ⟪who|Sam Ortiz⟫',
    peek: null,
    chips: [
      { kind: 'timed', text: '⟪n|1⟫ · ⟪when|Tue 9:00 AM⟫' },
      { kind: 'held', text: '⟪n|1⟫ held · ⟪why|no number⟫' },
    ],
  },
}
const PLAIN: NeedsYouItem = { key: 'customer-messages', severity: 'amber', kicker: 'Messages', title: 'Customers', detail: '3 need a reply, 2 to sort.', figure: '5', actionLabel: 'Messages' }
const valuesIn = (el: Element | null) => [...(el?.querySelectorAll('[data-value="worked-out"]') ?? [])].map((v) => v.textContent)

describe('NeedsYouRowWords', () => {
  it('a plain row is its title and its sentence, with no values drawn apart', () => {
    const { container } = render(<NeedsYouRowWords item={PLAIN} />)
    expect(container.textContent).toBe('Customers3 need a reply, 2 to sort.')
    expect(container.querySelector('[data-needs-you-shown]')).toBeNull()
  })

  it('a row that shows its values draws the count, the names and each chip’s values apart from the fixed words', () => {
    const { container } = render(<NeedsYouRowWords item={SENDS} />)
    const shown = container.querySelector('[data-needs-you-shown]')!
    // No marker reaches the screen.
    expect(shown.textContent).not.toMatch(/[⟪⟫]/)
    expect(shown.textContent).toContain('2 texts to send')
    expect(valuesIn(shown.querySelector('[data-needs-you-names]'))).toEqual(['Dana Whitfield', 'Sam Ortiz'])
    const chips = [...shown.querySelectorAll('[data-needs-you-chip]')]
    expect(chips.map((c) => `${c.getAttribute('data-needs-you-chip')}: ${c.textContent}`)).toEqual(['timed: 1 · Tue 9:00 AM', 'held: 1 held · no number'])
    expect(valuesIn(chips[1]!)).toEqual(['1', 'no number'])
    // The plain sentence is not drawn a second time.
    expect(shown.textContent).not.toContain('Dana Whitfield · Sam Ortiz · 1 ·')
    expect(shown.querySelector('[data-needs-you-peek]')).toBeNull()
  })

  it('one text is shown as itself, above who it goes to', () => {
    const { container } = render(<NeedsYouRowWords item={{ title: '1 text to send', detail: 'Dana Whitfield · Approved', shown: { title: '⟪n|1⟫ text to send', names: '⟪who|Dana Whitfield⟫ · Approved', peek: 'Dana, any word on the estimate?', chips: [] } }} />)
    expect(container.querySelector('[data-needs-you-peek]')!.textContent).toBe('Dana, any word on the estimate?')
    expect(container.querySelector('[data-needs-you-names]')!.textContent).toBe('Dana Whitfield · Approved')
  })

  it('the Needs you card draws the row that way, and its press says what it does', () => {
    const onAction = vi.fn()
    render(<DashboardNeedsYouCard userId="u-1" role="assistant" items={[SENDS, PLAIN]} onAction={onAction} />)
    expect(document.querySelectorAll('[data-needs-you-shown]')).toHaveLength(1)
    expect(screen.getByText('Customers')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Read them' }))
    expect(onAction).toHaveBeenCalledWith(SENDS)
  })
})
