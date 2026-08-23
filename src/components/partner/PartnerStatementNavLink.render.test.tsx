// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PartnerStatementNavLink } from './PartnerStatementNavLink'

const style = ({ isActive }: { isActive: boolean }) => ({ fontWeight: isActive ? 600 : undefined })

describe('PartnerStatementNavLink', () => {
  it('icon variant links to /my-statement and marks a waiting sign-off', () => {
    render(
      <MemoryRouter>
        <PartnerStatementNavLink variant="icon" awaitingSignOff style={style} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Statement' })
    expect(link.getAttribute('href')).toBe('/my-statement')
    expect(link.getAttribute('title')).toBe('Statement — sign-off waiting')
    expect(screen.getByTestId('statement-nav-dot')).toBeTruthy()
  })
  it('row variant carries the label and the tag; no dot or tag when nothing is waiting', () => {
    const { rerender } = render(
      <MemoryRouter>
        <PartnerStatementNavLink variant="row" awaitingSignOff style={style} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Statement')).toBeTruthy()
    expect(screen.getByText('sign-off waiting')).toBeTruthy()
    rerender(
      <MemoryRouter>
        <PartnerStatementNavLink variant="row" awaitingSignOff={false} style={style} />
      </MemoryRouter>,
    )
    expect(screen.queryByText('sign-off waiting')).toBeNull()
    expect(screen.queryByTestId('statement-nav-dot')).toBeNull()
  })
})
