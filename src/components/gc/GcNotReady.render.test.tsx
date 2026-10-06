// @vitest-environment jsdom
/**
 * Render smoke for a trade not ready to start (G-77): Pecan Valley's Site lighting on Fair Oaks D
 * says its insurance ran out, and Ask for it opens the company's window on that paper's send. A bar
 * whose trade is ready says nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcNotReady } from './GcNotReady'
import { GcCompanyOpenerContext, type CompanyOpener } from './gcCompanyOpener'
import { initialGcState } from '../../lib/gcMode/gcFixture'

afterEach(cleanup)

const state = initialGcState()
const project = state.projects.find((p) => p.id === 'fairoaksd')!

function withOpener(lineId: string) {
  const opener: CompanyOpener = { openPartner: vi.fn(), openCustomer: vi.fn() }
  const view = render(
    <GcCompanyOpenerContext.Provider value={opener}>
      <GcNotReady state={state} project={project} lineId={lineId} />
    </GcCompanyOpenerContext.Provider>,
  )
  return { opener, view }
}

describe('a trade not ready to start, on the opened activity', () => {
  it('says what is not in, and opens the paper’s send', () => {
    const { opener } = withOpener('felec-5')
    expect(screen.getByText('Pecan Valley Electric is not ready to start this on Mon Oct 19.')).toBeTruthy()
    expect(screen.getByText('Insurance ran out Tue Sep 15.')).toBeTruthy()
    expect(screen.getByText('The bar stays held until it is in.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ask for it' }))
    expect(opener.openPartner).toHaveBeenCalledWith('pecanvalley', { tab: 'documents', doc: 'insurance', send: true })
  })

  it('says nothing on a bar whose trade is ready, or one under way', () => {
    // Cool Breeze has every paper in for Controls; Pecan Valley's Lighting is under way.
    for (const lineId of ['fhvac-3', 'felec-3']) {
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
})
