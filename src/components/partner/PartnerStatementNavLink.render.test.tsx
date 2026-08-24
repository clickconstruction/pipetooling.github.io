// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PartnerStatementNavLink } from './PartnerStatementNavLink'

const style = ({ isActive }: { isActive: boolean }) => ({ fontWeight: isActive ? 600 : undefined })

describe('PartnerStatementNavLink', () => {
  it('icon variant links to /my-statement', () => {
    render(
      <MemoryRouter>
        <PartnerStatementNavLink variant="icon" style={style} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Statement' })
    expect(link.getAttribute('href')).toBe('/my-statement')
    expect(link.getAttribute('title')).toBe('Statement')
  })
  it('row variant carries the label', () => {
    render(
      <MemoryRouter>
        <PartnerStatementNavLink variant="row" style={style} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Statement')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Statement' }).getAttribute('href')).toBe('/my-statement')
  })
})
