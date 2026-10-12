// @vitest-environment jsdom
/**
 * Render smoke for the trade partner's first page (Messages cut 8c): the home opens on *Where you are with Click
 * Construction* from the sample `gc-trade-portal` answer's flow. Your jobs and Asked to bid leave the home, and Needs
 * you keeps only what the page does not show as theirs. A job's name and a press on its step open the job, and a
 * certificate that ran out opens its form in Paperwork.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NO_FLOW_EXTRA, tradeFlowRowsOf } from '../../supabase/functions/_shared/gcTradeFlow'
import { gcTradePortalSampleFlow, gcTradePortalSampleRows, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import { tradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
let answer: unknown = null

beforeEach(() => {
  const rows = gcTradePortalSampleRows(TODAY)
  answer = { today: TODAY, slice: tradePortalSlice(rows, ID.company), flow: gcTradePortalSampleFlow(TODAY), sample: true }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => answer })),
  )
})
afterEach(() => vi.unstubAllGlobals())

const open = () =>
  render(
    <MemoryRouter initialEntries={['/t/sample']}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )

const region = (name: RegExp | string) => within(screen.getByRole('region', { name }))
const steps = (name: string) => within(screen.getByRole('list', { name }))

describe('the trade partner’s first page', () => {
  it('opens on Where you are, with its own papers and each job it is asked on', async () => {
    open()
    const where = within(await screen.findByRole('region', { name: 'Where you are with Click Construction' }))
    expect(steps('Getting set up').getByText('MSA signed')).toBeTruthy()
    const shell = steps('Sample Retail Shell')
    expect(shell.getByText('Asked to quote')).toBeTruthy()
    expect(shell.getByText('· due Mon Oct 12')).toBeTruthy()
    expect(shell.getByRole('button', { name: 'Enter your quote' })).toBeTruthy()
    expect(shell.getByText('Later. If we carry your quote.')).toBeTruthy()
    expect(steps('Sample Dental Office').getByText('Sat Sep 5')).toBeTruthy()
    // The ask it passed on ended its job's lane: Before keeps it, the page leaves it off.
    expect(where.queryByText('Sample Clinic Finish Out')).toBeNull()
    expect(region('Before').getByText(/Sample Clinic Finish Out · Electrical · you passed/)).toBeTruthy()
    expect(where.getByText('Questions: text or call (512) 360-0599.')).toBeTruthy()
  })

  it('takes Your jobs and Asked to bid off the home, and keeps in Needs you what the page does not carry', async () => {
    open()
    await screen.findByRole('region', { name: 'Where you are with Click Construction' })
    expect(screen.queryByRole('region', { name: /^Your jobs/ })).toBeNull()
    expect(screen.queryByRole('region', { name: /^Asked to quote/ })).toBeNull()
    const needs = region(/^Needs you/)
    expect(needs.queryByText(/Send your Electrical quote for Sample Retail Shell/)).toBeNull()
    expect(needs.getByText('Click charged you $850 on Sample Dental Office. Agree or dispute it by Sun Oct 11.')).toBeTruthy()
    expect(needs.getByText('You can ask Click for $2,916 on Sample Dental Office.')).toBeTruthy()
  })

  it('opens the job from a press on its step and from its name', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Enter your quote' }))
    expect(await screen.findByText(/1 Sample Rd, Boerne · 9,600 sq ft retail shell, four bays/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '← Everything with Click' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sample Dental Office' }))
    expect(await screen.findByText(/3 Sample Ln, Fair Oaks Ranch/)).toBeTruthy()
  })

  it('opens the certificate’s form in Paperwork from a certificate that ran out', async () => {
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    const base = gcTradePortalSampleRows(TODAY)
    const rows = { ...base, papers: (base.papers ?? []).map((p) => (p.doc_type === 'coi' ? { ...p, expires_at: '2026-10-01' } : p)) }
    answer = { today: TODAY, slice: tradePortalSlice(rows, ID.company), flow: tradeFlowRowsOf(rows, NO_FLOW_EXTRA, ID.company), sample: true }
    open()
    const setUp = await screen.findByRole('list', { name: 'Getting set up' })
    expect(within(setUp).getByText('Your certificate of insurance ran out. Upload the new one here. A photo of it is fine.')).toBeTruthy()
    fireEvent.click(within(setUp).getByRole('button', { name: 'Upload your certificate' }))
    expect(scrolled).toHaveBeenCalled()
    expect(region('Your paperwork with Click').getByLabelText('The day the policy runs out')).toBeTruthy()
    // The certificate's to-do left Needs you: the page carries it.
    const needs = screen.queryByRole('region', { name: /^Needs you/ })
    expect(needs ? within(needs).queryByText(/Your insurance ran out/) : null).toBeNull()
  })
})
