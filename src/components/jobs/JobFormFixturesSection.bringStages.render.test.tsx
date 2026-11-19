// @vitest-environment jsdom
/**
 * Render smoke for the offer of a bid's stages on ① Line Items (punch list #397, PR 4): the link
 * beside Multiple Segment Generator on a job still on one clean line, and the reason with its
 * door when the offer is held.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { renderWithProviders } from '../../test/renderSmokeMocks'

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
})

afterEach(() => cleanup())

const oneLine: FixtureRow[] = [{ id: 'a', name: 'Bid price', count: 1, line_unit_price: 48_000, line_description: '', invoice_id: null, stage_kind: 'any' }]

function renderSection(extra: Partial<Parameters<typeof JobFormFixturesSection>[0]> = {}) {
  return renderWithProviders(
    <JobFormFixturesSection
      fixtures={oneLine}
      fixtureScopeExpandedById={{}}
      setFixtureScopeExpandedById={() => {}}
      fixturesSectionHighlight={false}
      fixturesSectionHighlightRef={{ current: null }}
      updateFixtureRow={() => {}}
      addFixtureRow={() => {}}
      removeFixtureRow={() => {}}
      moveFixtureRow={() => {}}
      onOpenSegmentGenerator={() => {}}
      onOpenStripeFixturePreview={() => {}}
      jobTotalDollars={48_000}
      {...extra}
    />,
  )
}

describe('① Line Items, the bid’s stages on a job that exists', () => {
  it('draws neither the link nor a reason when there is nothing to offer', () => {
    renderSection()
    expect(screen.queryByTestId('bring-bid-stages')).toBeNull()
    expect(screen.queryByTestId('bring-bid-stages-held')).toBeNull()
    expect(screen.getByRole('button', { name: 'Multiple Segment Generator' })).toBeTruthy()
  })

  it('draws the link beside Multiple Segment Generator and presses through', () => {
    const onPress = vi.fn()
    renderSection({ bringStages: { label: 'Bring B482’s stages', onPress } })
    const link = screen.getByTestId('bring-bid-stages')
    expect(link.textContent).toBe('Bring B482’s stages')
    expect(link.parentElement).toBe(screen.getByRole('button', { name: 'Multiple Segment Generator' }).parentElement)
    fireEvent.click(link)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('says why the offer is held, with the door that still works, and draws no link', () => {
    renderSection({ bringStagesHeld: 'This line is on a bill, so it stays one line. Add a stage with + Add line item.' })
    expect(screen.getByTestId('bring-bid-stages-held').textContent).toBe('This line is on a bill, so it stays one line. Add a stage with + Add line item.')
    expect(screen.queryByTestId('bring-bid-stages')).toBeNull()
  })
})
