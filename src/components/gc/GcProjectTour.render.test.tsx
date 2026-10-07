// @vitest-environment jsdom
/**
 * Render smoke for the walk's tabs (the tour's round five; mock-up
 * `to-dos/gc-mode/mockups/tour-round-five.md`): Walk me through this job opens the Schedule tab at
 * the chart's stops and the Daily log tab at the log's, lights each stop there instead of saying it
 * is missing, and Done or Skip tour puts back the tab the walk started from.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { GcProjectTour } from './GcProjectTour'
import type { GcStage } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})

type Tab = 'packages' | 'schedule' | 'log'

/** A stand-in for the project page: each tab draws only its own anchors, as the real tabs do. */
function Page({ stage }: { stage: GcStage }) {
  const [tab, setTab] = useState<Tab>('packages')
  const [open, setOpen] = useState(true)
  return (
    <>
      <span data-testid="tab">{tab}</span>
      <div data-tour="gc-project-header">One project</div>
      {tab === 'schedule' && (
        <>
          <div data-tour="gc-rough">rough</div>
          <div data-tour="gc-gantt-toolbar">chart</div>
          <div data-tour="gc-templates">templates</div>
        </>
      )}
      {tab === 'log' && <div data-tour="gc-morning-list">morning</div>}
      {open && <GcProjectTour stage={stage} from={tab} onTab={setTab} onClose={() => setOpen(false)} />}
    </>
  )
}

const tab = () => screen.getByTestId('tab').textContent
/** Next until the stop with this title shows. */
function walkTo(title: string) {
  for (let i = 0; i < 40 && !screen.queryByRole('dialog', { name: title }); i++) fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
  expect(screen.getByRole('dialog', { name: title })).toBeTruthy()
}

describe('Walk me through this job opens each stop’s tab', () => {
  it('the chart’s stops on the Schedule tab, the morning list on the Daily log tab, each lit; Skip tour puts the tab back', () => {
    renderWithProviders(<Page stage="building" />)
    expect(tab()).toBe('packages')
    walkTo('The chart')
    expect(tab()).toBe('schedule')
    expect(screen.queryByTestId('tour-missing')).toBeNull()
    walkTo('Save the job as a template')
    expect(tab()).toBe('schedule')
    expect(screen.queryByTestId('tour-missing')).toBeNull()
    walkTo('Who should be on site')
    expect(tab()).toBe('log')
    expect(screen.queryByTestId('tour-missing')).toBeNull()
    // Back onto the Schedule tab's last stop opens it again.
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(screen.getByRole('dialog', { name: 'Save the job as a template' })).toBeTruthy()
    expect(tab()).toBe('schedule')
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(tab()).toBe('packages')
  })

  it('Done at the last stop puts the tab back too', () => {
    renderWithProviders(<Page stage="building" />)
    walkTo('The trade’s own dates')
    expect(screen.getByText('30 of 30')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(tab()).toBe('packages')
  })

  it('a job still bidding walks its rough on the Schedule tab, and no chart', () => {
    renderWithProviders(<Page stage="pursuing" />)
    walkTo('A rough schedule while we bid')
    expect(tab()).toBe('schedule')
    expect(screen.queryByTestId('tour-missing')).toBeNull()
    expect(screen.getByText('11 of 16')).toBeTruthy()
  })
})
