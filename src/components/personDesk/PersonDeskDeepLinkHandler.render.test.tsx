// @vitest-environment jsdom
/**
 * Render smoke for which `?person=` the Person Desk's link handler takes (v2.8321, punch list #315).
 * The handler is mounted on every page. It used to strip any `person` from the address, its own or not,
 * so People → HR's link (`?tab=hr&person=<people.id>`) lost its person before the HR tab had mounted.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'

const desk = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('../../contexts/PersonDeskContext', () => ({ usePersonDeskContext: () => desk }))

import { PersonDeskDeepLinkHandler } from './PersonDeskDeepLinkHandler'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const ID = 'c0ffee00-0000-4000-8000-000000000002'

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname + l.search}</output>
}

async function openAt(route: string): Promise<string> {
  renderWithProviders(
    <>
      <PersonDeskDeepLinkHandler />
      <Where />
    </>,
    { route },
  )
  await settle()
  return screen.getByTestId('where').textContent ?? ''
}

afterEach(() => {
  cleanup()
  desk.open.mockClear()
})

describe('PersonDeskDeepLinkHandler', () => {
  it('opens the desk on its own link and takes the link out of the address', async () => {
    expect(await openAt(`/people?tab=users&person=p:${ID}&section=paperwork`)).toBe('/people?tab=users')
    expect(desk.open).toHaveBeenCalledWith({ personId: ID, section: 'paperwork', flow: null })
  })

  it('takes a login the same way', async () => {
    expect(await openAt(`/dashboard?person=u:${ID}`)).toBe('/dashboard')
    expect(desk.open).toHaveBeenCalledWith({ userId: ID, section: null, flow: null })
  })

  it('leaves a person that is another screen’s: the HR tab’s bare people.id stays in the address', async () => {
    expect(await openAt(`/people?tab=hr&person=${ID}`)).toBe(`/people?tab=hr&person=${ID}`)
    expect(desk.open).not.toHaveBeenCalled()
  })

  it('leaves the pay ledger’s person, a name, and the page’s own section with it', async () => {
    expect(await openAt('/people?tab=payroll&view=ledger&person=Sample+Hand&section=rejected')).toBe('/people?tab=payroll&view=ledger&person=Sample+Hand&section=rejected')
    expect(desk.open).not.toHaveBeenCalled()
  })
})
