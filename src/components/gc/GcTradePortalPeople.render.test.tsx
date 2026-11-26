// @vitest-environment jsdom
/**
 * The trade's portal, *Who gets our emails* (punch list #205, finding 164): **Remove** on a person asks first, in the
 * row, and the second press names the person. Nothing is sent until that press, and **Keep** puts the row back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { billDayState } from '../../test/fixtures/billDayDemo'
import { installDomShims } from '../../test/renderSmokeMocks'
import type { PortalLang } from '../../lib/gc/portalI18n'
import type { Partner } from '../../lib/gc/types'
import { PortalLangContext } from './gcTradePortalLang'
import { PortalPressContext, type PortalPress } from './gcTradePortalPress'
import { GcTradePortalPeople } from './GcTradePortalPeople'

installDomShims()
afterEach(cleanup)

function block(lang: PortalLang = 'en') {
  const base = billDayState('2026-10-02').partners[0]
  if (!base) throw new Error('no partner in the demo')
  const partner: Partner = {
    ...base,
    people: [
      { id: 'zz-1', name: 'ZZ Test Bookkeeper', email: 'zz-bookkeeper@example.com', role: 'Bookkeeper', gets: ['pay'] },
      { id: 'zz-2', name: 'ZZ Test Estimator', email: 'zz-estimator@example.com', role: '', gets: ['quotes'] },
    ],
  }
  const send = vi.fn<PortalPress['send']>(async () => null)
  const press: PortalPress = {
    send,
    upload: async () => ({ problem: null, file: null }),
    openPaper: async () => null,
    lateWaiting: async () => [],
    preview: false,
  }
  render(
    <PortalLangContext.Provider value={lang}>
      <PortalPressContext.Provider value={press}>
        <GcTradePortalPeople partner={partner} />
      </PortalPressContext.Provider>
    </PortalLangContext.Provider>,
  )
  return send
}

const row = (id: string) => document.querySelector(`[data-portal-person="${id}"]`) as HTMLElement
const removeIn = (id: string, name: string) => Array.from(row(id).querySelectorAll('button')).find((b) => b.textContent === name)

describe('Remove on a portal person asks first', () => {
  it('sends nothing on the first press, and asks in the row with the person’s name', () => {
    const send = block()
    fireEvent.click(removeIn('zz-1', 'Remove') as HTMLElement)
    expect(send).not.toHaveBeenCalled()
    expect(document.querySelector('[data-portal-person-ask="zz-1"]')?.textContent).toContain('Remove ZZ Test Bookkeeper? They stop getting our emails.')
    expect(screen.getByRole('button', { name: 'Remove ZZ Test Bookkeeper' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep ZZ Test Bookkeeper' })).toBeTruthy()
    // The other row is as it was.
    expect(removeIn('zz-2', 'Remove')).toBeTruthy()
    expect(document.querySelector('[data-portal-person-ask="zz-2"]')).toBeNull()
  })

  it('removes on the press that names the person, and closes the ask', async () => {
    const send = block()
    fireEvent.click(removeIn('zz-1', 'Remove') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Remove ZZ Test Bookkeeper' }))
    await waitFor(() => expect(send).toHaveBeenCalledWith('remove_person', { personId: 'zz-1' }))
    expect(send).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.querySelector('[data-portal-person-ask="zz-1"]')).toBeNull())
  })

  it('Keep puts the row back and sends nothing', () => {
    const send = block()
    fireEvent.click(removeIn('zz-1', 'Remove') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Keep ZZ Test Bookkeeper' }))
    expect(send).not.toHaveBeenCalled()
    expect(document.querySelector('[data-portal-person-ask="zz-1"]')).toBeNull()
    expect(removeIn('zz-1', 'Remove')).toBeTruthy()
  })

  it('asks in Spanish on a Spanish portal', () => {
    block('es')
    fireEvent.click(removeIn('zz-2', 'Quitar') as HTMLElement)
    expect(document.querySelector('[data-portal-person-ask="zz-2"]')?.textContent).toContain('¿Quitar a ZZ Test Estimator? Dejará de recibir nuestros correos.')
    expect(screen.getByRole('button', { name: 'Quitar a ZZ Test Estimator' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dejar a ZZ Test Estimator' })).toBeTruthy()
  })
})
