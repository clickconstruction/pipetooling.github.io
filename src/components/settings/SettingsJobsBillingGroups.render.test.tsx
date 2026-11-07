// @vitest-environment jsdom
/**
 * Render smoke for Settings → Jobs & billing drawn by heading (punch list #261): the headings in order for the
 * role, the strip at two headings or more, every card folded (the switches too since PR 2), and every anchor landing:
 * announcing a card's anchor (what the deep-link effect and the search pick do) opens the card and the id holds
 * its element; a child anchor opens the card that holds it; the fold header is a counted press. Since PR 3 a money
 * card's live value stands on its folded row, the static line comes back while it is open, and a fold reads again.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SettingsJobsBillingGroups, type JobsBillingCardElements } from './SettingsJobsBillingGroups'
import { JOBS_BILLING_CARDS, JOBS_BILLING_CHILD_ANCHORS, jobsBillingGroupsFor } from '../../lib/settings/jobsBillingGroups'
import { announceSettingsTarget } from '../../lib/settingsTarget'

function stubs(): JobsBillingCardElements {
  const out: JobsBillingCardElements = {}
  for (const c of JOBS_BILLING_CARDS) {
    out[c.slug] = (
      <div data-stub={c.slug}>
        {c.slug === 'rates' ? <div id="who-counts-as-what">the list</div> : null}
        body of {c.slug}
      </div>
    )
  }
  return out
}

describe('SettingsJobsBillingGroups (punch list #261)', () => {
  it('draws the six headings for a dev with the strip, every card folded', () => {
    const { container } = renderWithProviders(<SettingsJobsBillingGroups role="dev" cards={stubs()} />)
    const headings = [...container.querySelectorAll('[data-settings-jobs-group]')].map((el) => el.getAttribute('data-settings-jobs-group'))
    expect(headings).toEqual(['money', 'record', 'bill', 'liens', 'notices', 'repairs'])
    expect(screen.getByRole('navigation', { name: 'Jobs and billing headings' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Jump to / })).toHaveLength(6)
    for (const c of JOBS_BILLING_CARDS) {
      const el = document.getElementById(c.anchor)
      expect(el, c.anchor).toBeTruthy()
      expect(el?.getAttribute('data-open')).toBe('no')
      expect(container.querySelector(`[data-stub="${c.slug}"]`)).toBeNull()
    }
    expect(container.querySelectorAll('[data-stub]')).toHaveLength(0)
  })

  it('every anchor lands: announcing a card opens it; a child anchor opens the card that holds it', () => {
    const { container } = renderWithProviders(<SettingsJobsBillingGroups role="dev" cards={stubs()} />)
    for (const c of JOBS_BILLING_CARDS) {
      act(() => announceSettingsTarget(c.anchor))
      expect(document.getElementById(c.anchor)?.getAttribute('data-open'), c.anchor).toBe('yes')
      expect(container.querySelector(`[data-stub="${c.slug}"]`), c.anchor).toBeTruthy()
    }
    expect(container.querySelectorAll('[data-stub]')).toHaveLength(27)
  })

  it('a child anchor opens its card alone', () => {
    const { container } = renderWithProviders(<SettingsJobsBillingGroups role="dev" cards={stubs()} />)
    for (const [child, anchor] of Object.entries(JOBS_BILLING_CHILD_ANCHORS)) {
      act(() => announceSettingsTarget(child))
      expect(document.getElementById(anchor)?.getAttribute('data-open')).toBe('yes')
      expect(document.getElementById(child)).toBeTruthy()
    }
    expect(container.querySelectorAll('[data-stub]')).toHaveLength(Object.keys(JOBS_BILLING_CHILD_ANCHORS).length)
  })

  it('a card the address opens stays open whatever its fold, and a fold header is a counted press', () => {
    renderWithProviders(<SettingsJobsBillingGroups role="dev" cards={stubs()} forceOpen={{ 'invoice-issuer': true }} />)
    expect(document.getElementById('settings-jobs-invoice-issuer')?.getAttribute('data-open')).toBe('yes')
    const head = screen.getByRole('button', { name: /^Rates charged by crew/ })
    expect(head.getAttribute('data-nav')).toBe('rates')
    expect(head.closest('[data-navtrack="settings-jobs"][data-navbuttons]')).toBeTruthy()
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('false')
  })

  it('a master sees four headings and ten cards, the office two headings and no strip below two', () => {
    const master = renderWithProviders(<SettingsJobsBillingGroups role="master_technician" cards={stubs()} />)
    expect([...master.container.querySelectorAll('[data-settings-jobs-group]')]).toHaveLength(4)
    expect(master.container.querySelectorAll('[data-settings-card]')).toHaveLength(11)
    expect(master.container.querySelector('[data-settings-jobs-strip]')).toBeTruthy()
    master.unmount()
    const office = renderWithProviders(<SettingsJobsBillingGroups role="assistant" cards={stubs()} />)
    expect([...office.container.querySelectorAll('[data-settings-jobs-group]')]).toHaveLength(2)
    expect(office.container.querySelector('[data-settings-jobs-strip]')).toBeTruthy()
    expect(jobsBillingGroupsFor('assistant').flatMap((g) => g.cards)).toHaveLength(5)
    office.unmount()
    const tech = renderWithProviders(<SettingsJobsBillingGroups role="helpers" cards={stubs()} />)
    expect(tech.container.querySelectorAll('[data-settings-card]')).toHaveLength(0)
    expect(tech.container.querySelector('[data-settings-jobs-strip]')).toBeNull()
  })

  it('a card the page did not build is not drawn, so a dev-only card never mounts for the office', () => {
    const cards = stubs()
    delete cards.rates
    const { container } = renderWithProviders(<SettingsJobsBillingGroups role="dev" cards={cards} />)
    expect(document.getElementById('settings-jobs-rates')).toBeNull()
    expect(container.querySelectorAll('[data-settings-card]')).toHaveLength(26)
  })

  it('a money card draws its live value on the folded row, the static line while open or until the value is read, and a fold reads again (PR 3)', () => {
    const onCardFold = vi.fn()
    renderWithProviders(
      <SettingsJobsBillingGroups role="dev" cards={stubs()} valueLines={{ rates: '$285 master with a helper · $185 a tech alone', 'gc-card': 'On' }} onCardFold={onCardFold} />,
    )
    const rates = screen.getByRole('button', { name: /^Rates charged by crew/ })
    const ratesLine = rates.querySelector('[data-fold-line]')!
    expect(ratesLine.getAttribute('data-fold-line')).toBe('value')
    expect(ratesLine.textContent).toBe('$285 master with a helper · $185 a tech alone')
    expect(screen.getByRole('button', { name: /^GC jobs · pay by card/ }).querySelector('[data-fold-line]')?.textContent).toBe('On')
    // A card whose value is not in hand keeps its static line.
    const markup = screen.getByRole('button', { name: /^Markup on materials/ })
    expect(markup.querySelector('[data-fold-line]')?.getAttribute('data-fold-line')).toBe('static')
    expect(markup.querySelector('[data-fold-line]')?.textContent).toBe('percent over cost')
    // Open: the static line again, and no read; fold: the value again, and one read naming the card.
    fireEvent.click(rates)
    expect(ratesLine.getAttribute('data-fold-line')).toBe('static')
    expect(ratesLine.textContent).toBe('the rate card by who was out, and who counts as what')
    expect(onCardFold).not.toHaveBeenCalled()
    fireEvent.click(rates)
    expect(ratesLine.getAttribute('data-fold-line')).toBe('value')
    expect(onCardFold).toHaveBeenCalledTimes(1)
    expect(onCardFold).toHaveBeenCalledWith('rates')
  })
})
