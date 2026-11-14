// @vitest-environment jsdom
/**
 * Render-smoke tests for the Dispatch row's presses on pay terms an estimator sent on their own
 * (punch list #323): the office opens the Pay calendar on the bid's job, filled in, and a save
 * closes the row; *Not a calendar payer* closes it with that answer; a reader who cannot set a
 * calendar gets neither press. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const { io, opener } = vi.hoisted(() => ({
  io: { loadJobAndPayerForBid: vi.fn() },
  opener: { openPayCalendar: vi.fn(), closePayCalendar: vi.fn() },
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/draftPayTermsIo', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/jobs/draftPayTermsIo')>()), loadJobAndPayerForBid: io.loadJobAndPayerForBid }))
vi.mock('../../contexts/PayCalendarModalContext', () => ({ usePayCalendarModal: () => opener }))

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import PayTermsRequestActions from './PayTermsRequestActions'
import type { PayCalendarOpenOptions } from '../../contexts/PayCalendarModalContext'

installDomShims()

const CAL = { cutoffDay: 25, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '§ 5.2', words: '' }
const FOUND = { job: { id: 'job-2', label: '1502 · Larkfield Medical Office', developmentId: null, developmentName: null }, payer: { id: 'payer-1', name: 'Larkfield Construction' } }

function draw(role: string) {
  const onCloseRequestWithNote = vi.fn()
  renderWithProviders(<PayTermsRequestActions requestId="req-1" bidId="bid-1" terms={{ scope: 'job', calendar: CAL }} from="Dana Whitfield" role={role} onCloseRequestWithNote={onCloseRequestWithNote} />)
  return { onCloseRequestWithNote }
}

beforeEach(() => {
  io.loadJobAndPayerForBid.mockReset().mockResolvedValue(FOUND)
  opener.openPayCalendar.mockReset()
})

describe('PayTermsRequestActions', () => {
  it('opens the pay calendar on the bid’s job, filled in, and a save closes the row', async () => {
    const { onCloseRequestWithNote } = draw('assistant')
    fireEvent.click(screen.getByRole('button', { name: 'Open the pay calendar' }))
    await waitFor(() => expect(opener.openPayCalendar).toHaveBeenCalled())
    const [payer, options] = opener.openPayCalendar.mock.calls[0]! as [unknown, PayCalendarOpenOptions]
    expect(payer).toEqual(FOUND.payer)
    expect(options.job).toEqual(FOUND.job)
    expect(options.initial).toEqual({ calendar: CAL, scope: 'job', from: 'Dana Whitfield’s read' })
    options.onSaved!()
    expect(onCloseRequestWithNote).toHaveBeenCalledWith('req-1', 'The pay calendar is set.')
  })

  it('Not a calendar payer closes the row with that answer', () => {
    const { onCloseRequestWithNote } = draw('controller')
    fireEvent.click(screen.getByRole('button', { name: 'Not a calendar payer' }))
    expect(onCloseRequestWithNote).toHaveBeenCalledWith('req-1', 'Not a calendar payer. No pay calendar was set.')
  })

  it('says what is missing when the bid has no job to set it on, and opens nothing', async () => {
    io.loadJobAndPayerForBid.mockResolvedValue(null)
    draw('dev')
    fireEvent.click(screen.getByRole('button', { name: 'Open the pay calendar' }))
    await waitFor(() => expect(io.loadJobAndPayerForBid).toHaveBeenCalled())
    expect(opener.openPayCalendar).not.toHaveBeenCalled()
  })

  it.each(['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'])('gives %s neither press', (role) => {
    draw(role)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each(['dev', 'master_technician', 'assistant', 'controller'])('gives %s both', (role) => {
    draw(role)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
