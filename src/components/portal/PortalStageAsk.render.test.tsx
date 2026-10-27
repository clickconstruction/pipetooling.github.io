// @vitest-environment jsdom
/**
 * Render smoke for the GC's "Need other dates?" (v2.2934; Stage Plan PR 5):
 * the form opens, refuses a backwards span, and in sample mode records the
 * ask locally; an answered ask reads back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PortalStageAsk } from './PortalStageAsk'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SAMPLE_TOKEN_GC as SAMPLE_PORTAL_TOKEN } from '../../lib/customerSample'

const target = { windowId: 'w-1', window: { start: '2026-09-22', end: '2026-10-02' }, asked: null }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PortalStageAsk', () => {
  it('opens, validates, and records a sample-mode ask', async () => {
    renderWithProviders(<PortalStageAsk target={target} token={SAMPLE_PORTAL_TOKEN} todayYmd="2026-09-05" />)
    fireEvent.click(screen.getByText('Need other dates?'))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByText('Ask'))
    await waitFor(() => expect(screen.getByText('The end comes before the start.')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-09' } })
    fireEvent.click(screen.getByText('Ask'))
    await waitFor(() => expect(screen.getByText(/we'll confirm here/)).toBeTruthy())
  })

  it('reads the office answer back and offers Ask again', () => {
    renderWithProviders(<PortalStageAsk target={{ ...target, asked: { start: '2026-09-22', end: '2026-10-02', note: null, answer: 'proposed', answerNote: 'crew on 1009' } }} token={SAMPLE_PORTAL_TOKEN} todayYmd="2026-09-05" />)
    expect(screen.getByText(/the office answered/)).toBeTruthy()
    expect(screen.getByText(/crew on 1009/)).toBeTruthy()
    expect(screen.getByText('Ask again')).toBeTruthy()
  })

  it('a refused ask asks them to call, with the number; a lost signal offers Try again (v2.5965)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'Bad request' }) })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<PortalStageAsk target={target} token="tok-1234567890abcdef" todayYmd="2026-09-05" phone="(512) 360-0599" />)
    fireEvent.click(screen.getByText('Need other dates?'))
    fireEvent.click(screen.getByText('Ask'))
    await waitFor(() => expect(screen.getByText("We couldn't record that. Please call the office.")).toBeTruthy())
    expect(screen.queryByText('Bad request')).toBeNull()
    expect(screen.getByRole('link', { name: 'Call the office' })).toBeTruthy()
    fireEvent.click(screen.getByText('Ask'))
    await waitFor(() => expect(screen.getByText('No connection. Nothing was sent. Check your signal and try again.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText(/we'll confirm here/)).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
