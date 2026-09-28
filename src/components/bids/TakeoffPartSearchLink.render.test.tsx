// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PartNameWithSearch, TakeoffPartSearchLink } from './TakeoffPartSearchLink'

describe('TakeoffPartSearchLink', () => {
  it('is a real link to a Google search for the name as written, opening in a new tab', () => {
    render(<TakeoffPartSearchLink name="MCGUIR 2165LK CP 1/2IPSX3/8OD LAV SUPPLY L PN: LF2165LK" />)
    const a = screen.getByRole('link', { name: 'Search Google for MCGUIR 2165LK CP 1/2IPSX3/8OD LAV SUPPLY L PN: LF2165LK' })
    expect(a.getAttribute('href')).toBe(
      'https://www.google.com/search?q=MCGUIR+2165LK+CP+1%2F2IPSX3%2F8OD+LAV+SUPPLY+L+PN%3A+LF2165LK',
    )
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
  })

  it('renders nothing when there is no name to search', () => {
    const { container } = render(<TakeoffPartSearchLink name="   " />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PartNameWithSearch', () => {
  it('keeps the icon on the same line as the last word', () => {
    const { container } = render(<PartNameWithSearch name="ADV TABCO 7-PS-66 SS HAND SINK" />)
    expect(container.textContent).toBe('ADV TABCO 7-PS-66 SS HAND SINK')
    const link = screen.getByTestId('takeoff-part-search')
    const tail = link.parentElement as HTMLElement
    expect(tail.style.whiteSpace).toBe('nowrap')
    expect(tail.textContent).toBe('SINK')
  })
})
