// @vitest-environment jsdom
/**
 * Render smoke for Your weeks in the trade's portal (owner, 2026-10-05): Pecan Valley sees its four
 * weeks on Fair Oaks, the inspection this week, and a row opens the job's page. Spanish draws the
 * same page in its words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { initialGcState, type Partner } from '../../lib/gcMode/gcModel'
import { GcPortalWeeks } from './GcPortalWeeks'
import { PortalLangContext } from './gcPortalLang'

afterEach(cleanup)

const state = initialGcState()
const pecan = state.partners.find((p) => p.id === 'pecanvalley') as Partner

function draw(lang: 'en' | 'es' = 'en') {
  const onHome = vi.fn()
  const onOpenProject = vi.fn()
  render(
    <PortalLangContext.Provider value={lang}>
      <GcPortalWeeks state={state} partner={pecan} onHome={onHome} onOpenProject={onOpenProject} />
    </PortalLangContext.Provider>,
  )
  return { onHome, onOpenProject }
}

describe('Your weeks in the portal', () => {
  it('shows four weeks of work and opens a job from a row', () => {
    const { onOpenProject } = draw()
    expect(screen.getByText('Your weeks')).toBeTruthy()
    expect(screen.getByText('This week · Sep 28')).toBeTruthy()
    expect(screen.getByText('Week of Oct 19')).toBeTruthy()
    expect(screen.getByText('Fair Oaks Shops, Building D · Electrical service inspection, Fri Oct 2')).toBeTruthy()
    fireEvent.click(screen.getByText('Electrical · Panels and feeders'))
    expect(onOpenProject).toHaveBeenCalledWith('fairoaksd')
  })

  it('draws it in Spanish', () => {
    draw('es')
    expect(screen.getByText('Sus semanas')).toBeTruthy()
    expect(screen.getByText('Esta semana · 28 sep')).toBeTruthy()
  })
})
