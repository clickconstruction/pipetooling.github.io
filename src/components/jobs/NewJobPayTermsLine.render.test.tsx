// @vitest-environment jsdom
/**
 * Render-smoke tests for New Job's pay terms line (punch list #323): the terms a draft carried,
 * the press that opens the Pay calendar window filled in, *sets with the job* once the office
 * agreed for this job alone, and what is stored once it saved for the payer. Only the roles
 * that set a calendar see it. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const { io, auth, opener } = vi.hoisted(() => ({
  io: { loadPayerPayCalendars: vi.fn() },
  auth: { role: 'assistant' as string },
  opener: { openPayCalendar: vi.fn(), closePayCalendar: vi.fn() },
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role })
  return { useAuth: value, useOptionalAuth: value }
})
vi.mock('../../lib/jobs/payCalendarIo', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/jobs/payCalendarIo')>()), loadPayerPayCalendars: io.loadPayerPayCalendars }))
vi.mock('../../contexts/PayCalendarModalContext', () => ({ usePayCalendarModal: () => opener }))

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import NewJobPayTermsLine from './NewJobPayTermsLine'
import type { DraftPayTerms, NewJobPayTermsState } from '../../lib/jobs/draftPayTerms'
import type { PayCalendarOpenOptions } from '../../contexts/PayCalendarModalContext'

installDomShims()

const PAYER = { id: 'payer-1', name: 'Larkfield Construction' }
const CAL = { cutoffDay: 25, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '§ 5.2', words: '' }
const TERMS: DraftPayTerms = { scope: 'job', calendar: CAL }

function draw(over: { state?: NewJobPayTermsState; payer?: typeof PAYER | null; terms?: DraftPayTerms } = {}) {
  const onState = vi.fn()
  renderWithProviders(<NewJobPayTermsLine terms={over.terms ?? TERMS} from="Dana Whitfield" payer={over.payer === undefined ? PAYER : over.payer} jobLabel="Larkfield Medical Office" state={over.state ?? { kind: 'offered' }} onState={onState} />)
  return { onState }
}
const line = () => screen.getByTestId('new-job-pay-terms').textContent
const lastOptions = () => opener.openPayCalendar.mock.calls[0]![1] as PayCalendarOpenOptions

beforeEach(() => {
  auth.role = 'assistant'
  io.loadPayerPayCalendars.mockReset().mockResolvedValue([])
  opener.openPayCalendar.mockReset()
})

describe('NewJobPayTermsLine', () => {
  it('says the terms, whose they are, and offers the press', () => {
    draw()
    expect(line()).toBe('Pay terms from Dana Whitfield’s draft:In by the 25th, paid the 10thonly this jobCheck and use')
  })

  it('opens the window on the payer, filled in, for the job New Job is about to make', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Check and use' }))
    expect(opener.openPayCalendar).toHaveBeenCalledWith(PAYER, expect.objectContaining({ initial: { calendar: CAL, scope: 'job', from: 'Dana Whitfield’s draft' }, jobToBe: { label: 'Larkfield Medical Office', onUse: expect.any(Function) } }))
  })

  it('holds what the office agreed for this job until the job is created', () => {
    const { onState } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Check and use' }))
    lastOptions().jobToBe!.onUse({ ...CAL, payDay: 15 })
    expect(onState).toHaveBeenCalledWith({ kind: 'with-job', calendar: { ...CAL, payDay: 15 } })
  })

  it('reads sets with the job, with what was agreed, and Change opens it again as they left it', () => {
    draw({ state: { kind: 'with-job', calendar: { ...CAL, payDay: 15 } } })
    expect(line()).toBe('Pay terms from Dana Whitfield’s draft:In by the 25th, paid the 15thsets with the jobChange')
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(lastOptions().initial).toEqual({ calendar: { ...CAL, payDay: 15 }, scope: 'job', from: 'Dana Whitfield’s draft' })
  })

  it('says a job the office switched off has none', () => {
    draw({ state: { kind: 'with-job', calendar: { off: true } } })
    expect(line()).toContain('No pay calendar on this job')
  })

  it('after a save for the payer, reads what is stored and offers no second press', async () => {
    const { onState } = draw({ terms: { scope: 'payer', calendar: CAL } })
    fireEvent.click(screen.getByRole('button', { name: 'Check and use' }))
    io.loadPayerPayCalendars.mockResolvedValue([{ payerCustomerId: 'payer-1', jobId: null, off: false, calendar: CAL, setByName: null, setAt: null }])
    lastOptions().onSaved!()
    await waitFor(() => expect(onState).toHaveBeenCalledWith({ kind: 'payer-saved' }))
  })

  it('once saved for the payer, says so with no press', () => {
    draw({ state: { kind: 'payer-saved' }, terms: { scope: 'payer', calendar: CAL } })
    expect(line()).toBe('Pay terms from Dana Whitfield’s draft:In by the 25th, paid the 10thset for every job Larkfield Construction pays')
  })

  it('with nobody to bill yet, says what to do and offers no press', () => {
    draw({ payer: null })
    expect(line()).toContain('Pick who the bills go to, then check them.')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each(['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'])('draws nothing for %s, who cannot set a calendar', (role) => {
    auth.role = role
    draw()
    expect(screen.queryByTestId('new-job-pay-terms')).toBeNull()
  })

  it.each(['dev', 'master_technician', 'assistant', 'controller'])('draws for %s', (role) => {
    auth.role = role
    draw()
    expect(screen.getByTestId('new-job-pay-terms')).toBeTruthy()
  })
})
