// @vitest-environment jsdom
/**
 * Render smoke for the dispatch Subs lanes (v2.2929): one row per sub, a
 * chip per covered day with the right kind, a chip opens its job, nothing
 * rendered with no lanes.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { HubSubsLanes } from './HubSubsLanes'
import { buildSubLanes, type SubDispatchOrder } from '../../lib/subs/subDispatch'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const DAYS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
const order: SubDispatchOrder = {
  id: 'c1', personId: 'p1', personName: 'Behar Kraja', jobId: 'j-1004', jobLabel: '#1004 · 2210 Goforth Rd', status: 'accepted',
  pickedStart: '2026-09-09', pickedEnd: '2026-09-10', proposedStart: null, proposedEnd: null, windowStart: '2026-09-08', windowEnd: '2026-09-19', stageName: 'Rough-in', recordId: null,
}

describe('HubSubsLanes', () => {
  it('renders a lane with picked chips that open the job', () => {
    const onOpenJob = vi.fn()
    renderWithProviders(<HubSubsLanes lanes={buildSubLanes([order], DAYS)} visibleDayKeys={DAYS} scheduleTodayYmd="2026-09-09" onOpenJob={onOpenJob} />)
    expect(screen.getAllByTestId('hub-subs-lane')).toHaveLength(1)
    expect(screen.getByText('Behar Kraja')).toBeTruthy()
    const chips = screen.getAllByTitle(/Rough-in · #1004/)
    expect(chips).toHaveLength(2)
    fireEvent.click(chips[0]!)
    expect(onOpenJob).toHaveBeenCalledWith('j-1004')
  })

  it('renders nothing without lanes', () => {
    const { container } = renderWithProviders(<HubSubsLanes lanes={[]} visibleDayKeys={DAYS} scheduleTodayYmd="2026-09-09" onOpenJob={() => {}} />)
    expect(container.querySelector('[data-testid="hub-subs-lanes"]')).toBeNull()
  })
})
