// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → the office's GC notices (O10): it loads off and says turning it on keeps today as its
 * day; on, it says since when; Preview lists today's notices as they would go; Email me a test says how many went.
 * O10c: both read as if the notices went on the day in *Count pay applications sent since*, which starts at the
 * switch's day while on and today while off, and refuses a later day.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const fetchGcOfficeNoticesSince = vi.fn(async (): Promise<string | null> => null)
const setGcOfficeNoticesOn = vi.fn(async (on: boolean) => (on ? '2026-10-15' : null))
vi.mock('../../lib/gc/officeNoticesSetting', () => ({
  fetchGcOfficeNoticesSince: () => fetchGcOfficeNoticesSince(),
  setGcOfficeNoticesOn: (on: boolean) => setGcOfficeNoticesOn(on),
}))
const previewOfficeNotices = vi.fn(async (since?: string) => ({
  since: since ?? '',
  notices: [
    { kind: 'bill_day', project: 'Oak Ridge Clinic', number: 4, to: 'Pat Controller', email: 'pm@x.test', subject: 'Bill day for Oak Ridge Clinic is Oct 25', text: '' },
    { kind: 'certify_reminder', project: 'Elm Street Office', number: 2, to: 'Hart Architects', email: '', subject: 'Pay application 2 for Elm Street Office waits on your certificate', text: '' },
  ],
}))
const sendOfficeNoticesTest = vi.fn(async (_since?: string) => 2)
vi.mock('../../lib/gc/gcIo', () => ({
  previewOfficeNotices: (since?: string) => previewOfficeNotices(since),
  sendOfficeNoticesTest: (since?: string) => sendOfficeNoticesTest(since),
}))

import GcOfficeNoticesSettingsBlock from './GcOfficeNoticesSettingsBlock'

const sinceField = () => screen.getByLabelText('Count pay applications sent since') as HTMLInputElement

describe('GcOfficeNoticesSettingsBlock', () => {
  beforeEach(() => {
    fetchGcOfficeNoticesSince.mockResolvedValue(null)
    previewOfficeNotices.mockClear()
    sendOfficeNoticesTest.mockClear()
  })

  it('loads off, says nothing old goes out, and turning it on shows the day it keeps', async () => {
    renderWithProviders(<GcOfficeNoticesSettingsBlock />)
    const box = screen.getByLabelText('Email the office’s GC notices') as HTMLInputElement
    await waitFor(() => expect(box.disabled).toBe(false))
    expect(box.checked).toBe(false)
    const block = screen.getByTestId('gc-office-notices-block')
    expect(block.textContent).toContain('Turning it on keeps today as its day. Only pay applications sent from then get notices, so nothing old goes out.')
    fireEvent.click(box)
    await waitFor(() => expect(setGcOfficeNoticesOn).toHaveBeenCalledWith(true))
    await waitFor(() => expect(box.checked).toBe(true))
    expect(block.textContent).toContain('On since Oct 15. Only pay applications sent from that day get notices.')
    expect(sinceField().value).toBe('2026-10-15')
  })

  it('Preview lists today’s notices with who hears each, and the test says how many went', async () => {
    renderWithProviders(<GcOfficeNoticesSettingsBlock />)
    await waitFor(() => expect(sinceField().disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Preview today’s notices' }))
    const list = await screen.findByTestId('gc-office-notices-preview')
    expect(list.textContent).toContain('Bill day for Oak Ridge Clinic is Oct 25 · to Pat Controller at pm@x.test')
    expect(list.textContent).toContain('waits on your certificate · to Hart Architects, no email on file')
    fireEvent.click(screen.getByRole('button', { name: 'Email me a test' }))
    await waitFor(() => expect(sendOfficeNoticesTest).toHaveBeenCalled())
  })

  it('off, the day starts at today; both presses read from the day picked, and Preview says it', async () => {
    renderWithProviders(<GcOfficeNoticesSettingsBlock />)
    await waitFor(() => expect(sinceField().disabled).toBe(false))
    expect(sinceField().value).toBe(todayYmdInAppTz())
    fireEvent.change(sinceField(), { target: { value: '2026-10-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview today’s notices' }))
    await waitFor(() => expect(previewOfficeNotices).toHaveBeenCalledWith('2026-10-05'))
    const list = await screen.findByTestId('gc-office-notices-preview')
    expect(list.textContent).toContain('As if the notices went on Oct 5.')
    fireEvent.click(screen.getByRole('button', { name: 'Email me a test' }))
    await waitFor(() => expect(sendOfficeNoticesTest).toHaveBeenCalledWith('2026-10-05'))
  })

  it('on, the day starts at the switch’s day', async () => {
    fetchGcOfficeNoticesSince.mockResolvedValue('2026-10-08')
    renderWithProviders(<GcOfficeNoticesSettingsBlock />)
    await waitFor(() => expect(sinceField().value).toBe('2026-10-08'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview today’s notices' }))
    await waitFor(() => expect(previewOfficeNotices).toHaveBeenCalledWith('2026-10-08'))
  })

  it('refuses a day after today: neither press goes, and it says to pick an earlier day', async () => {
    renderWithProviders(<GcOfficeNoticesSettingsBlock />)
    await waitFor(() => expect(sinceField().disabled).toBe(false))
    fireEvent.change(sinceField(), { target: { value: '2999-01-01' } })
    expect((screen.getByRole('button', { name: 'Preview today’s notices' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Email me a test' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('gc-office-notices-block').textContent).toContain('Pick today or an earlier day.')
  })
})
