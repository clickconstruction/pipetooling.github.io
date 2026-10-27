// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ARCH_FLOW, ARCHITECTS, contextFor, CUSTOMER_FLOW, CUSTOMERS, TRADE_FLOW, TRADES } from '../../../lib/flows/boardFixtures'
import { installDomShims } from '../../../test/renderSmokeMocks'
import { GcBoardByCompany } from './GcBoardByCompany'

installDomShims()

const row = (contactId: string) => document.querySelector(`[data-board-company="${contactId}"]`) as HTMLElement

describe('GcBoardByCompany', () => {
  it('reads one row per company on the flow: the track, the step on now, a line per job and the Portal column', () => {
    render(<GcBoardByCompany ctx={contextFor(TRADE_FLOW)} companies={TRADES} portal={(id) => (id === 'tom' ? 'never' : 'opened')} onOpen={vi.fn()} />)
    expect(screen.getByRole('columnheader', { name: 'Once' })).toBeTruthy()
    expect(within(row('greg')).getByText('Sitework · Greg Paulk')).toBeTruthy()
    expect(within(row('greg')).getByText('Papers in · insurance expired')).toBeTruthy()
    expect(within(row('greg')).getByText('Boerne Retail Shell · Asked to quote · late 2 days')).toBeTruthy()
    expect(within(row('greg')).getByLabelText('Papers in: lapsed')).toBeTruthy()
    expect(within(row('bill')).getByText('ours · 3 d · over usual')).toBeTruthy()
    expect(within(row('bill')).getByText('Stone Oak Pharmacy · not started')).toBeTruthy()
    expect(within(row('tom')).getByText('never')).toBeTruthy()
    expect(row('g6')).toBeNull()
  })

  it('opens a company at the step it is on now', () => {
    const onOpen = vi.fn()
    render(<GcBoardByCompany ctx={contextFor(TRADE_FLOW)} companies={TRADES} portal={() => 'opened'} onOpen={onOpen} />)
    fireEvent.click(within(row('bill')).getByRole('button', { name: 'Open' }))
    expect(onOpen).toHaveBeenCalledWith('bill', 'compare')
  })

  it('draws no track for a flow with no Once lane, and says when nobody is on the flow', () => {
    const { unmount } = render(<GcBoardByCompany ctx={contextFor(ARCH_FLOW)} companies={ARCHITECTS} portal={() => 'never'} onOpen={vi.fn()} />)
    expect(screen.queryByRole('columnheader', { name: 'Once' })).toBeNull()
    unmount()
    const onList = vi.fn()
    const { unmount: unmountEmpty } = render(<GcBoardByCompany ctx={contextFor(CUSTOMER_FLOW)} companies={CUSTOMERS.filter((c) => c.off)} portal={() => 'never'} onOpen={vi.fn()} onList={onList} />)
    // The empty table offers the views row's List (punch list #184), and says the words alone without it.
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('Nobody is on this flow yet. List shows everyone we work with.')
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(onList).toHaveBeenCalledTimes(1)
    unmountEmpty()
    render(<GcBoardByCompany ctx={contextFor(CUSTOMER_FLOW)} companies={CUSTOMERS.filter((c) => c.off)} portal={() => 'never'} onOpen={vi.fn()} />)
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('Nobody is on this flow yet.')
  })
})
