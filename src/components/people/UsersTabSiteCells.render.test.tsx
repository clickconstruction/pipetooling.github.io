// @vitest-environment jsdom
/**
 * v2.8657: the Users tab's Sites lens. A dev reads each person's seat on CountTooling and on
 * TakeoffTooling beside their row. A site that cannot be read says why and never blanks the other.
 * Every person and address here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UsersSitesLensHeader, UsersSitesLensSummary, UsersTabSiteCells } from './UsersTabSiteCells'
import type { SiteAccount, SiteKey, SiteRead } from '../../lib/people/siteAccounts'
import type { SiteAccountsState } from '../../hooks/useSiteAccounts'

afterEach(cleanup)

const seat = (over: Partial<SiteAccount>): SiteAccount => ({ id: 'ct-1', email: 'zz.test.estimator@example.com', active: true, isTwin: false, roles: [], lastSignInAt: null, ...over })
const ready = (accounts: SiteAccount[]): SiteRead => ({ state: 'ready', accounts })
const reads = (count: SiteRead, takeoff: SiteRead): Record<SiteKey, SiteRead> => ({ count, takeoff })

describe('the Sites lens cells', () => {
  it('names both sites in its header', () => {
    render(<UsersSitesLensHeader />)
    expect(screen.getByText('CountTooling')).toBeTruthy()
    expect(screen.getByText('TakeoffTooling')).toBeTruthy()
  })

  it('says a seat is active on one site and missing on the other', () => {
    render(
      <UsersTabSiteCells
        person={{ email: 'zz.test.estimator@example.com', linkedId: 'ct-1' }}
        name="ZZ Test Estimator"
        reads={reads(ready([seat({ roles: ['overseer', 'admin'] })]), ready([]))}
      />,
    )
    expect(screen.getByLabelText('ZZ Test Estimator on CountTooling: active, overseer, admin')).toBeTruthy()
    expect(screen.getByLabelText('ZZ Test Estimator on TakeoffTooling: no seat')).toBeTruthy()
  })

  it('says a retired seat, and that it was matched by address', () => {
    render(
      <UsersTabSiteCells
        person={{ email: 'zz.test.estimator@example.com' }}
        name="ZZ Test Estimator"
        reads={reads(ready([]), ready([seat({ id: 'tt-9', active: false })]))}
      />,
    )
    expect(screen.getByLabelText('ZZ Test Estimator on TakeoffTooling: retired, by address')).toBeTruthy()
  })

  it('keeps one site readable while the other is still being read or failed', () => {
    render(
      <UsersTabSiteCells
        person={{ email: 'zz.test.estimator@example.com', linkedId: 'ct-1' }}
        name="ZZ Test Estimator"
        reads={reads(ready([seat({})]), { state: 'failed', reason: 'Unknown or missing verb' })}
      />,
    )
    expect(screen.getByLabelText('ZZ Test Estimator on CountTooling: active')).toBeTruthy()
    expect(screen.getByLabelText('ZZ Test Estimator on TakeoffTooling: not read')).toBeTruthy()
  })
})

describe('the Sites lens summary', () => {
  const people = { ok: true as const, rows: [{ email: 'zz.test.estimator@example.com', linkedId: 'ct-1' }], countLinkByUserId: new Map<string, string>() }

  it('counts the accounts that match nobody here, a site at a time', () => {
    const sites: SiteAccountsState = {
      reads: reads(ready([seat({}), seat({ id: 'ct-2', email: 'zz.test.stranger@example.com' })]), ready([seat({ id: 'tt-9' })])),
      people,
      refresh: vi.fn(),
    }
    render(<UsersSitesLensSummary sites={sites} />)
    const line = screen.getByTestId('users-sites-lens-summary')
    expect(line.textContent).toContain('1 CountTooling account matches nobody here.')
    expect(line.textContent).toContain('Every TakeoffTooling account matches a person here.')
    expect(screen.queryByRole('button', { name: 'Read again' })).toBeNull()
  })

  it('says why a site could not be read, and offers to read again', () => {
    const refresh = vi.fn()
    const sites: SiteAccountsState = { reads: reads(ready([seat({})]), { state: 'failed', reason: 'Unknown or missing verb' }), people, refresh }
    render(<UsersSitesLensSummary sites={sites} />)
    expect(screen.getByText('TakeoffTooling could not be read. Unknown or missing verb')).toBeTruthy()
    expect(screen.getByTestId('users-sites-lens-summary').textContent).toContain('Every CountTooling account matches a person here.')
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
