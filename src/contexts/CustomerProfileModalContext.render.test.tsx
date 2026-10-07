// @vitest-environment jsdom
/**
 * Render smokes for the Customer profile window's opener (punch list #97, PR 3): a
 * `?customerTimeline=<id>` link opens that customer's timeline once and leaves the address
 * without it; a link that holds no customer id is stripped and opens nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('../components/customers/CustomerProfileModal', () => ({
  default: ({ customerId, initialView }: { customerId: string; initialView?: string }) => <div data-testid="customer-window">{`${customerId}:${initialView ?? 'remembered'}`}</div>,
}))

import { CustomerProfileModalProvider } from './CustomerProfileModalContext'

const ID = '11111111-2222-4333-8444-555555555555'
function Where() {
  const loc = useLocation()
  return <div data-testid="where">{`${loc.pathname}${loc.search}`}</div>
}
const mount = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CustomerProfileModalProvider>
        <Where />
      </CustomerProfileModalProvider>
    </MemoryRouter>,
  )

afterEach(cleanup)

describe('the customer timeline link', () => {
  it('opens the customer’s timeline and leaves the address as it was without the link', async () => {
    mount(`/jobs?tab=stages&customerTimeline=${ID}`)
    expect((await screen.findByTestId('customer-window')).textContent).toBe(`${ID}:timeline`)
    expect(screen.getByTestId('where').textContent).toBe('/jobs?tab=stages')
  })

  it('strips a link that holds no customer id and opens nothing', async () => {
    mount('/customers?customerTimeline=nope')
    expect((await screen.findByTestId('where')).textContent).toBe('/customers')
    expect(screen.queryByTestId('customer-window')).toBeNull()
  })
})
