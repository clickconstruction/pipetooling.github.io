// @vitest-environment jsdom
/**
 * Render smoke for the GC's "Ask for other dates" (v2.2934): the form opens,
 * refuses a backwards span, and in sample mode records the ask locally.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PortalStageAsk } from './PortalStageAsk'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SAMPLE_TOKEN_GC as SAMPLE_PORTAL_TOKEN } from '../../lib/customerSample'

const entry = { id: 'w-1', bundle: false, name: 'Top-out', window: { start: '2026-09-22', end: '2026-10-02' }, who: null, when: null, pct: null, state: 'window' as const, asked: null, rescheduling: false }

describe('PortalStageAsk', () => {
  it('opens, validates, and records a sample-mode ask', async () => {
    renderWithProviders(<PortalStageAsk entry={entry} token={SAMPLE_PORTAL_TOKEN} todayYmd="2026-09-05" />)
    fireEvent.click(screen.getByText('Ask for other dates'))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByText('Ask'))
    await waitFor(() => expect(screen.getByText('The end comes before the start.')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-09' } })
    fireEvent.click(screen.getByText('Ask'))
    await waitFor(() => expect(screen.getByText(/waiting on the office/)).toBeTruthy())
  })

  it('shows re-scheduling and the office answer', () => {
    renderWithProviders(<PortalStageAsk entry={{ ...entry, rescheduling: true, asked: { start: '2026-09-22', end: '2026-10-02', note: null, answer: 'proposed', answerNote: 'crew on 1009' } }} token={SAMPLE_PORTAL_TOKEN} todayYmd="2026-09-05" />)
    expect(screen.getByText(/Re-scheduling/)).toBeTruthy()
    expect(screen.getByText(/the office answered/)).toBeTruthy()
    expect(screen.getByText(/crew on 1009/)).toBeTruthy()
  })
})
