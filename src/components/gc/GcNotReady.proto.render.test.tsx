// @vitest-environment jsdom
/**
 * Render smoke for a trade not ready to start (G-77): Pecan Valley's Site lighting on Fair Oaks D
 * says its insurance ran out, and Ask for it opens the company's window on that paper's send. A bar
 * whose trade is ready says nothing. And G-138: Pecan Valley's bars under way say it in red, on the
 * chart, its hover card, the print, and the opened bar with the draws' lock.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcNotReady } from './GcNotReady.proto'
import { GcCompanyOpenerContext, type CompanyOpener } from './gcCompanyOpener.proto'
import { GC_COMPANY, initialGcState } from '../../lib/gcMode/gcFixture'
import { GcGantt } from './GcGantt'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { chartHolds } from '../../lib/gcMode/gcChartHolds'
import { uninsuredNotes } from '../../lib/gcMode/gcNotReady'
import { customerDoneWords, customerSchedulePicture, customerStanding } from '../../lib/gcMode/gcCustomerSchedule'
import type { GanttPrintJob } from '../../lib/gcMode/gcGanttPrint'

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
    // Cool Breeze has every paper in for Controls; Summit's TPO membrane is under way, insured.
    // (Pecan Valley's Lighting is under way with its insurance run out: G-138 says that, below.)
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
})

describe('a trade at work with its insurance run out (G-138), on the chart and the opened bar', () => {
  function chart() {
    const m = scheduleMeasures(state, project)
    const job: GanttPrintJob = {
      name: project.name,
      place: project.address,
      company: GC_COMPANY.name,
      by: 'Robert Douglas',
      finishWords: 'The work runs 3 days behind the plan.',
      doneWords: customerDoneWords(customerStanding(state, project)),
      customer: customerSchedulePicture(state, project),
    }
    return render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={chartHolds(state, project)} today={state.today} building picked={null} onPick={vi.fn()} uninsured={uninsuredNotes(state, project)} print={job} />)
  }

  it('writes the red note beside both bars under way, and the hover card says it once', () => {
    const { container } = chart()
    expect(screen.getAllByText('insurance ran out Sep 15').length).toBe(2)
    fireEvent.mouseEnter(container.querySelector('[data-gantt-bar="felec-3"]')!, { clientX: 10, clientY: 10 })
    const card = screen.getByRole('tooltip').textContent ?? ''
    expect(card).toContain("InsurancePecan Valley Electric's insurance ran out Tue Sep 15. Nothing they do for us is covered.")
    expect(card).not.toContain('Note')
  })

  it('prints the same note beside Lighting: print reads barNote with the new map', () => {
    chart()
    fireEvent.click(screen.getByRole('button', { name: 'Print or PDF' }))
    const page = screen.getByRole('dialog', { name: 'Print the chart' }).querySelector('iframe')?.getAttribute('srcdoc') ?? ''
    expect(page).toContain('insurance ran out Sep 15')
  })

  it('opens Lighting on what to do, with the draws’ lock in a line', () => {
    const { opener } = withOpener('felec-3')
    expect(screen.getByText('Pecan Valley Electric is working on this without current insurance.')).toBeTruthy()
    expect(screen.getByText('On Draws, Approve stays locked until a current certificate is in.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ask for it' }))
    expect(opener.openPartner).toHaveBeenCalledWith('pecanvalley', { tab: 'documents', doc: 'insurance', send: true })
  })
})
