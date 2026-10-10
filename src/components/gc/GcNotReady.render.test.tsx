// @vitest-environment jsdom
/**
 * The schedule's PR 9d: a trade not ready to start (G-77), in the bar's form, ported from the prototype's test. Pecan
 * Valley's Site lighting on Fair Oaks D says its insurance ran out, and Ask for it opens the company's window. A bar whose
 * trade is ready says nothing. And G-138: Pecan Valley's Lighting under way says it works uninsured, with the draws' lock.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcNotReady } from './GcNotReady'
import { GcCompanyOpenerContext, type CompanyOpener } from './gcCompanyOpener'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { plainWordsFailures } from '../../lib/plainWords'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()
afterEach(cleanup)

const state = initialGcState()
const project = state.projects.find((p) => p.id === 'fairoaksd')!

function withOpener(lineId: string) {
  const opener: CompanyOpener = { openPartner: vi.fn() }
  const view = render(
    <GcCompanyOpenerContext.Provider value={opener}>
      <GcNotReady state={state} project={project} lineId={lineId} />
    </GcCompanyOpenerContext.Provider>,
  )
  return { opener, view }
}

describe('GcNotReady: a trade not ready to start, in the bar’s form', () => {
  it('says what is not in, and opens the company’s window', () => {
    const { opener } = withOpener('felec-5')
    expect(screen.getByText('Pecan Valley Electric is not ready to start this on Mon Oct 19.')).toBeTruthy()
    expect(screen.getByText('Insurance ran out Tue Sep 15.')).toBeTruthy()
    expect(screen.getByText('The bar stays held until it is in.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ask for it' }))
    expect(opener.openPartner).toHaveBeenCalledWith('pecanvalley')
  })

  it('says nothing on a bar whose trade is ready, or one under way insured', () => {
    // Cool Breeze has every paper in for Controls; Summit's TPO membrane is under way, insured.
    for (const lineId of ['fhvac-3', 'froof-1']) {
      const { view } = withOpener(lineId)
      expect(view.container.textContent).toBe('')
      cleanup()
    }
  })

  it('shows no button outside the page, where no company window can open', () => {
    render(<GcNotReady state={state} project={project} lineId="felec-5" />)
    expect(screen.getByText('Insurance ran out Tue Sep 15.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens Lighting, under way uninsured, on what to do with the draws’ lock in a line (G-138)', () => {
    const { opener } = withOpener('felec-3')
    expect(screen.getByText('Pecan Valley Electric is working on this without current insurance.')).toBeTruthy()
    expect(screen.getByText('On Draws, Approve stays locked until a current certificate is in.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ask for it' }))
    expect(opener.openPartner).toHaveBeenCalledWith('pecanvalley')
  })

  it('says it in plain words', () => {
    const { view } = withOpener('felec-5')
    const said = [...view.container.querySelectorAll('strong, div > div > div')].map((el) => el.textContent ?? '').filter((s) => s.trim() !== '')
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
