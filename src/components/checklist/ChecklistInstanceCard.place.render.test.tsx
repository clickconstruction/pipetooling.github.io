// @vitest-environment jsdom
/**
 * The task card and its place (punch list #328, PR 3): a card with a place wears its name, opens
 * onto the place's block, and a card with no place is the card it was.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { settle } from '../../test/renderSmokeMocks'
import type { TaskPlace } from '../../lib/tasks/taskPlace'

vi.mock('../materials/OnSiteMap', () => ({ default: () => <div data-testid="still-map" /> }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyFix: () => {} }))

import { ChecklistInstanceCard } from './ChecklistInstanceCard'

const PLACE: TaskPlace = { name: 'Pump house', lat: 29.5512, lng: -98.2874, accuracyM: 6, setBy: 'lead-1', setAt: '2026-11-03T18:00:00Z' }

function renderCard(overrides: Partial<Parameters<typeof ChecklistInstanceCard>[0]> = {}) {
  return render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null }}
        title="Grease the pump bearings"
        events={[]}
        nameById={{ 'lead-1': 'Rosa' }}
        currentUserId="me-1"
        onToggleComplete={() => {}}
        onPostComment={() => Promise.resolve(true)}
        {...overrides}
      />
    </ul>,
  )
}

afterEach(cleanup)

describe('ChecklistInstanceCard place', () => {
  it('a card with no place draws no place line and no block, closed or open', async () => {
    renderCard()
    await settle()
    expect(document.querySelector('[data-task-place-line]')).toBeNull()
    fireEvent.click(screen.getByText(/Add a note/))
    expect(document.querySelector('[data-task-place-block]')).toBeNull()
  })

  it('a card with a place wears its name, and the block only once the card is opened', async () => {
    renderCard({ place: PLACE })
    await settle()
    expect(document.querySelector('[data-task-place-line]')?.textContent).toBe('Pump house')
    expect(document.querySelector('[data-task-place-block]')).toBeNull()
    fireEvent.click(screen.getByText(/Add a note/))
    expect(document.querySelector('[data-task-place-block]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Directions' })).toBeTruthy()
    expect(screen.getByText('Placed by Rosa on Nov 3. Your location stays on this phone.')).toBeTruthy()
  })

  it('the dot wears the task\'s number when the list hands one in', async () => {
    renderCard({ place: PLACE, placeNumber: 2 })
    await settle()
    expect(document.querySelector('[data-task-place-line]')?.textContent).toBe('2Pump house')
  })

  it('the desk row variant is unchanged: no place line', async () => {
    renderCard({ place: PLACE, variant: 'row' })
    await settle()
    expect(document.querySelector('[data-task-place-line]')).toBeNull()
  })
})
