// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → the customer's notice before a bill is due (O12): its own switch, read and written by
 * its own key; it loads off and says turning it on keeps today as its day; on, it says since when; Preview lists the
 * customers who would hear today, and both presses ask for the customer's notices from the day in *Count bills
 * certified since*, which starts at the switch's day while on and today while off, and refuses a later day.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const fetchGcOfficeNoticesSince = vi.fn(async (_key?: string): Promise<string | null> => null)
const setGcOfficeNoticesOn = vi.fn(async (on: boolean, _key?: string) => (on ? '2026-10-15' : null))
vi.mock('../../lib/gc/officeNoticesSetting', () => ({
  fetchGcOfficeNoticesSince: (key?: string) => fetchGcOfficeNoticesSince(key),
  setGcOfficeNoticesOn: (on: boolean, key?: string) => setGcOfficeNoticesOn(on, key),
}))
const previewOfficeNotices = vi.fn(async (since?: string, _notices?: string) => ({
  since: since ?? '',
  notices: [
    { kind: 'pay_soon', project: 'Oak Ridge Clinic', number: 3, to: 'Oak Ridge Owner LLC', email: 'ap@oakridge.test', subject: 'Pay application 3 for Oak Ridge Clinic is due Oct 28', text: '' },
    { kind: 'pay_soon', project: 'Elm Street Office', number: 2, to: 'Elm Street Partners', email: '', subject: 'Pay application 2 for Elm Street Office is due Oct 29', text: '' },
  ],
}))
const sendOfficeNoticesTest = vi.fn(async (_since?: string, _notices?: string) => 2)
vi.mock('../../lib/gc/gcIo', () => ({
  previewOfficeNotices: (since?: string, notices?: string) => previewOfficeNotices(since, notices),
  sendOfficeNoticesTest: (since?: string, notices?: string) => sendOfficeNoticesTest(since, notices),
}))

import GcCustomerDueNoticesSettingsBlock from './GcCustomerDueNoticesSettingsBlock'
import { GC_CUSTOMER_DUE_NOTICES_SETTING_KEY } from '../../../supabase/functions/_shared/gcOfficeNotices'

const sinceField = () => screen.getByLabelText('Count bills certified since') as HTMLInputElement

describe('GcCustomerDueNoticesSettingsBlock', () => {
  beforeEach(() => {
    fetchGcOfficeNoticesSince.mockResolvedValue(null)
    previewOfficeNotices.mockClear()
    sendOfficeNoticesTest.mockClear()
  })

  it('loads off, says nothing old goes out, and turning it on shows the day it keeps', async () => {
    renderWithProviders(<GcCustomerDueNoticesSettingsBlock />)
    const box = screen.getByLabelText('Email GC customers 3 days before a bill is due') as HTMLInputElement
    await waitFor(() => expect(box.disabled).toBe(false))
    expect(box.checked).toBe(false)
    const block = screen.getByTestId('gc-customer-due-notices-block')
    expect(fetchGcOfficeNoticesSince).toHaveBeenCalledWith(GC_CUSTOMER_DUE_NOTICES_SETTING_KEY)
    expect(block.textContent).toContain('Turning it on keeps today as its day. Only bills certified from then get the notice, so nothing old goes out.')
    fireEvent.click(box)
    await waitFor(() => expect(setGcOfficeNoticesOn).toHaveBeenCalledWith(true, GC_CUSTOMER_DUE_NOTICES_SETTING_KEY))
    await waitFor(() => expect(box.checked).toBe(true))
    expect(block.textContent).toContain('On since Oct 15. Only bills certified from that day get the notice.')
    expect(sinceField().value).toBe('2026-10-15')
  })

  it('Preview lists the customers who would hear today, and the test asks for the customer’s notices', async () => {
    renderWithProviders(<GcCustomerDueNoticesSettingsBlock />)
    await waitFor(() => expect(sinceField().disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Preview today’s notices' }))
    const list = await screen.findByTestId('gc-customer-due-notices-preview')
    expect(list.textContent).toContain('Pay application 3 for Oak Ridge Clinic is due Oct 28 · to Oak Ridge Owner LLC at ap@oakridge.test')
    expect(list.textContent).toContain('is due Oct 29 · to Elm Street Partners, no email on file')
    fireEvent.click(screen.getByRole('button', { name: 'Email me a test' }))
    await waitFor(() => expect(sendOfficeNoticesTest).toHaveBeenCalledWith(todayYmdInAppTz(), 'customer'))
  })

  it('off, the day starts at today; both presses read from the day picked, and Preview says it', async () => {
    renderWithProviders(<GcCustomerDueNoticesSettingsBlock />)
    await waitFor(() => expect(sinceField().disabled).toBe(false))
    expect(sinceField().value).toBe(todayYmdInAppTz())
    fireEvent.change(sinceField(), { target: { value: '2026-10-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview today’s notices' }))
    await waitFor(() => expect(previewOfficeNotices).toHaveBeenCalledWith('2026-10-05', 'customer'))
    const list = await screen.findByTestId('gc-customer-due-notices-preview')
    expect(list.textContent).toContain('As if the notice went on Oct 5.')
    fireEvent.click(screen.getByRole('button', { name: 'Email me a test' }))
    await waitFor(() => expect(sendOfficeNoticesTest).toHaveBeenCalledWith('2026-10-05', 'customer'))
  })

  it('on, the day starts at the switch’s day', async () => {
    fetchGcOfficeNoticesSince.mockResolvedValue('2026-10-08')
    renderWithProviders(<GcCustomerDueNoticesSettingsBlock />)
    await waitFor(() => expect(sinceField().value).toBe('2026-10-08'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview today’s notices' }))
    await waitFor(() => expect(previewOfficeNotices).toHaveBeenCalledWith('2026-10-08', 'customer'))
  })

  it('refuses a day after today: neither press goes, and it says to pick an earlier day', async () => {
    renderWithProviders(<GcCustomerDueNoticesSettingsBlock />)
    await waitFor(() => expect(sinceField().disabled).toBe(false))
    fireEvent.change(sinceField(), { target: { value: '2999-01-01' } })
    expect((screen.getByRole('button', { name: 'Preview today’s notices' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Email me a test' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('gc-customer-due-notices-block').textContent).toContain('Pick today or an earlier day.')
  })
})
