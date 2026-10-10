// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → the office's GC notices (O10): it loads off and says turning it on keeps today as its
 * day; on, it says since when; Preview lists today's notices as they would go; Email me a test says how many went.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const setGcOfficeNoticesOn = vi.fn(async (on: boolean) => (on ? '2026-10-15' : null))
vi.mock('../../lib/gc/officeNoticesSetting', () => ({
  fetchGcOfficeNoticesSince: async () => null,
  setGcOfficeNoticesOn: (on: boolean) => setGcOfficeNoticesOn(on),
}))
const sendOfficeNoticesTest = vi.fn(async () => 2)
vi.mock('../../lib/gc/gcIo', () => ({
  previewOfficeNotices: async () => ({
    since: '2026-10-15',
    notices: [
      { kind: 'bill_day', project: 'Oak Ridge Clinic', number: 4, to: 'Pat Controller', email: 'pm@x.test', subject: 'Bill day for Oak Ridge Clinic is Oct 25', text: '' },
      { kind: 'certify_reminder', project: 'Elm Street Office', number: 2, to: 'Hart Architects', email: '', subject: 'Pay application 2 for Elm Street Office waits on your certificate', text: '' },
    ],
  }),
  sendOfficeNoticesTest: () => sendOfficeNoticesTest(),
}))

import GcOfficeNoticesSettingsBlock from './GcOfficeNoticesSettingsBlock'

describe('GcOfficeNoticesSettingsBlock', () => {
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
  })

  it('Preview lists today’s notices with who hears each, and the test says how many went', async () => {
    renderWithProviders(<GcOfficeNoticesSettingsBlock />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview today’s notices' }))
    const list = await screen.findByTestId('gc-office-notices-preview')
    expect(list.textContent).toContain('Bill day for Oak Ridge Clinic is Oct 25 · to Pat Controller at pm@x.test')
    expect(list.textContent).toContain('waits on your certificate · to Hart Architects, no email on file')
    fireEvent.click(screen.getByRole('button', { name: 'Email me a test' }))
    await waitFor(() => expect(sendOfficeNoticesTest).toHaveBeenCalled())
  })
})
