// @vitest-environment jsdom
/**
 * Render smoke for a company's portal home: Hillside promised its Boerne quote by Sep 30 and none
 * came, so the bid's chip says it is late and names the day it gave (owner, 2026-10-04), in English
 * and in Spanish.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { initialGcState, type GcAction, type Partner } from '../../lib/gcMode/gcModel'
import { GcPortalHome } from './GcPortalHome'
import { PortalLangContext } from './gcPortalLang'

afterEach(cleanup)

const state = initialGcState()
const hillside = state.partners.find((p) => p.id === 'hillside') as Partner

function draw(lang: 'en' | 'es') {
  render(
    <PortalLangContext.Provider value={lang}>
      <GcPortalHome state={state} partner={hillside} dispatch={vi.fn<(a: GcAction) => void>()} onOpenProject={vi.fn()} onOpenPay={vi.fn()} onOpenPapers={vi.fn()} onOpenWeeks={vi.fn()} />
    </PortalLangContext.Provider>,
  )
}

describe('the late chip on a company home', () => {
  it('says late and the day they gave', () => {
    draw('en')
    expect(screen.getByText('late: you said Sep 30')).toBeTruthy()
    expect(screen.queryByText('your day passed')).toBeNull()
  })

  it('says it in Spanish', () => {
    draw('es')
    expect(screen.getByText('atrasado: dijo el 30 sep')).toBeTruthy()
  })
})
