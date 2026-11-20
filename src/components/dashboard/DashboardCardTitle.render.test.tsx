// @vitest-environment jsdom
/**
 * Render smoke for the Dashboard's shared card head: the title is the card's one h2 inside the band, a
 * section with no card gets the band by itself, and the shared group card draws it folded and open.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DashboardCardHead, DashboardCardTitle } from './DashboardCardTitle'
import { DashboardGroupCard } from './DashboardGroupCard'

afterEach(cleanup)

describe('DashboardCardHead and DashboardCardTitle', () => {
  it('draws the title as the card’s one h2, inside the band, beside what shares its line', () => {
    render(
      <DashboardCardHead style={{ display: 'flex', gap: '0.5rem' }}>
        <DashboardCardTitle nowrap>My Schedule</DashboardCardTitle>
        <button type="button">Add job</button>
      </DashboardCardHead>,
    )
    const title = screen.getByRole('heading', { level: 2, name: 'My Schedule' })
    expect(title.style.whiteSpace).toBe('nowrap')
    const band = title.closest('[data-dashboard-card-head]') as HTMLElement
    expect(band).toBeTruthy()
    expect(band.style.background).toBe('var(--bg-muted)')
    expect(band.style.borderLeft).toBe('4px solid rgb(249, 115, 22)')
    // The press stays on the title's line, in the row the card laid out.
    const press = screen.getByRole('button', { name: 'Add job' })
    expect(press.parentElement).toBe(title.parentElement)
    expect((title.parentElement as HTMLElement).style.display).toBe('flex')
  })

  it('a section with no card gets the band standing by itself', () => {
    render(
      <DashboardCardHead card={null} below="0.5rem">
        <DashboardCardTitle>My crew</DashboardCardTitle>
      </DashboardCardHead>,
    )
    const band = screen.getByRole('heading', { level: 2, name: 'My crew' }).closest('[data-dashboard-card-head]') as HTMLElement
    expect(band.style.borderRadius).toBe('6px')
    expect(band.style.marginBottom).toBe('0.5rem')
    expect(band.style.borderLeft).toBe('4px solid rgb(249, 115, 22)')
  })

  it('the shared group card draws its title through the same head, folded or open', () => {
    window.localStorage.setItem('card-title-test-fold', 'true')
    const { unmount } = render(
      <DashboardGroupCard title="Assigned Jobs" collapseStorageKey="card-title-test-fold">
        <p>rows</p>
      </DashboardGroupCard>,
    )
    const folded = screen.getByRole('heading', { level: 2, name: 'Assigned Jobs' }).closest('[data-dashboard-card-head]') as HTMLElement
    // Folded, the band is the whole card: it reaches the bottom edge and every corner is rounded.
    expect(folded.style.marginBottom).toBe('-0.85rem')
    expect(folded.style.marginTop).toBe('-0.85rem')
    expect(screen.queryByText('rows')).toBeNull()
    unmount()
    window.localStorage.removeItem('card-title-test-fold')

    render(
      <DashboardGroupCard title="Teams Inbox">
        <p>rows</p>
      </DashboardGroupCard>,
    )
    const open = screen.getByRole('heading', { level: 2, name: 'Teams Inbox' }).closest('[data-dashboard-card-head]') as HTMLElement
    expect(open.style.marginTop).toBe('-0.85rem')
    expect(open.style.marginBottom).toBe('0.5rem')
    expect(screen.getByText('rows')).toBeTruthy()
  })
})
