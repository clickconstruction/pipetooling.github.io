// @vitest-environment jsdom
/**
 * GC mode (O7c): the customer of a GC job answers a change order and accepts the work in their portal. Each press
 * posts to submit-portal-request with its kind; a sample token only says thank you; a refusal shows the words the
 * function sends.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PortalGcJobs } from './PortalGcJobs'
import { SAMPLE_TOKEN_OWNER } from '../../lib/customerSample'
import type { PortalGcJob } from '../../lib/portal/portalPayload'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const JOB: PortalGcJob = {
  projectId: 'p-shell',
  name: 'Retail Shell',
  changeOrders: [
    { id: 'co-2', number: 2, description: 'Add a coffee bar cabinet', price: 1100, days: 3, sentOn: '2026-10-07' },
    { id: 'co-3', number: 3, description: 'Leave out the canopy', price: -500, days: 0, sentOn: '2026-10-08' },
  ],
  canAccept: true,
  accepted: null,
}
const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const sent = () => JSON.parse((fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![1] as { body: string }).body) as Record<string, unknown>

describe('PortalGcJobs', () => {
  it('says each change order in words, a credit too', () => {
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[JOB]} formatUsd={usd} />)
    expect(screen.getByText('Retail Shell')).toBeTruthy()
    expect(screen.getByTestId('portal-gc-co-2').textContent).toContain('Adds $1,100 and 3 working days. Sent Oct 7, 2026.')
    expect(screen.getByTestId('portal-gc-co-3').textContent).toContain('Takes $500 off. Sent Oct 8, 2026.')
  })

  it('signs a change order after asking once', async () => {
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[JOB]} formatUsd={usd} />)
    const row = screen.getByTestId('portal-gc-co-2')
    fireEvent.click(row.querySelector('button')!)
    expect(row.textContent).toContain('Sign change order 2?')
    fireEvent.click(screen.getByRole('button', { name: 'Yes, sign it' }))
    await waitFor(() => expect(screen.getByText('You signed change order 2. Thank you.')).toBeTruthy())
    expect(sent()).toEqual({ token: 'tok-1234567890abcdef', kind: 'gc_change_order_answer', changeOrderId: 'co-2', signed: true })
  })

  it('declines with a reason, trimmed, or with none', async () => {
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[JOB]} formatUsd={usd} />)
    const declines = screen.getAllByRole('button', { name: 'Decline' })
    fireEvent.click(declines[0]!)
    fireEvent.change(screen.getByLabelText('Why you are declining change order 2'), { target: { value: ' Over our budget this year ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Decline it' }))
    await waitFor(() => expect(screen.getByText('You declined change order 2. We will be in touch.')).toBeTruthy())
    expect(sent()).toEqual({ token: 'tok-1234567890abcdef', kind: 'gc_change_order_answer', changeOrderId: 'co-2', signed: false, note: 'Over our budget this year' })
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decline it' }))
    await waitFor(() => expect(screen.getByText('You declined change order 3. We will be in touch.')).toBeTruthy())
    expect(sent()).toEqual({ token: 'tok-1234567890abcdef', kind: 'gc_change_order_answer', changeOrderId: 'co-3', signed: false })
  })

  it('accepts the work once they type their name', async () => {
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[JOB]} formatUsd={usd} />)
    const accept = screen.getByRole('button', { name: 'Accept the work' }) as HTMLButtonElement
    expect(accept.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Your name, as the one who walked the job'), { target: { value: ' Elena Ruiz ' } })
    fireEvent.change(screen.getByLabelText('A note on the acceptance'), { target: { value: 'Walked it with the architect.' } })
    fireEvent.click(accept)
    await waitFor(() => expect(screen.getByText('You accepted the work. Thank you.')).toBeTruthy())
    expect(sent()).toEqual({ token: 'tok-1234567890abcdef', kind: 'gc_accept_work', projectId: 'p-shell', byName: 'Elena Ruiz', note: 'Walked it with the architect.' })
  })

  it('shows the function’s refusal in its words', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'That change order is already answered.' }) })
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[JOB]} formatUsd={usd} />)
    fireEvent.click(screen.getByTestId('portal-gc-co-2').querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, sign it' }))
    expect(await screen.findByText('That change order is already answered.')).toBeTruthy()
  })

  it('only says thank you on the sample, and says when the work was accepted', async () => {
    render(<PortalGcJobs token={SAMPLE_TOKEN_OWNER} jobs={[JOB, { projectId: 'p-clinic', name: 'Clinic', changeOrders: [], canAccept: false, accepted: { on: '2026-10-02', how: 'portal' } }]} formatUsd={usd} />)
    fireEvent.click(screen.getByTestId('portal-gc-co-2').querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, sign it' }))
    await waitFor(() => expect(screen.getByText('You signed change order 2. Thank you.')).toBeTruthy())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('The work was accepted on Oct 2, 2026.')).toBeTruthy()
  })

  it('draws nothing with no GC job', () => {
    const { container } = render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[]} formatUsd={usd} />)
    expect(container.textContent).toBe('')
  })

  it('our contract leads the job while it waits on them, and signing it posts its send, the name and the consent (B6-d-iii)', async () => {
    const job: PortalGcJob = {
      projectId: 'p-clinic',
      name: 'Hill Country Clinic',
      contract: { state: 'toSign', sendId: '00000000-0000-0000-0000-0000000000c5', signBy: '2026-10-16', total: 187000, fileName: 'Clinic contract.pdf', fileUrl: 'https://files.example/contract.pdf', retainagePct: 10, retainageStep: null, payDays: 30, lateInterestPctPerMonth: null, lateFinishPerDay: null },
      changeOrders: [],
      canAccept: false,
      accepted: null,
    }
    render(<PortalGcJobs token={"t".repeat(32)} jobs={[job]} formatUsd={usd} />)
    const block = screen.getByTestId('portal-gc-contract')
    expect(block.textContent).toContain('Your contract · to sign')
    expect(block.textContent).toContain('Our contract for Hill Country Clinic: $187,000.')
    expect(block.textContent).toContain('We bill once a month for the work done. Part of each bill, 10%, is held until the end. Each bill is due 30 days after the architect certifies it.')
    expect((screen.getByRole('link', { name: 'Read the contract (Clinic contract.pdf)' }) as HTMLAnchorElement).href).toBe('https://files.example/contract.pdf')
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Pat Oak' } })
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.click(screen.getByRole('button', { name: 'Sign the contract' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = sent()
    expect(body).toMatchObject({ kind: 'gc_owner_contract_sign', sendId: '00000000-0000-0000-0000-0000000000c5', printedName: 'Pat Oak' })
    expect((body.esignConsent as { audience?: string } | undefined)?.audience).toBe('customer')
    expect(await screen.findByText('You signed our contract. Thank you.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Read what you signed (Clinic contract.pdf)' })).toBeTruthy()
  })

  it('once signed here, it reads who signed and when, with what they signed a press away', () => {
    const job: PortalGcJob = { projectId: 'p-clinic', name: 'Hill Country Clinic', contract: { state: 'signed', signedOn: '2026-10-12', signer: 'Pat Oak', fileName: 'Clinic contract.pdf', fileUrl: 'https://files.example/contract.pdf' }, changeOrders: [], canAccept: false, accepted: null }
    render(<PortalGcJobs token={"t".repeat(32)} jobs={[job]} formatUsd={usd} />)
    expect(screen.getByTestId('portal-gc-contract').textContent).toMatch(/^You signed our contract on .+, as Pat Oak\.Read what you signed \(Clinic contract\.pdf\)$/)
  })

  it('a price that changed since the send shows no form to sign', () => {
    const job: PortalGcJob = {
      projectId: 'p-clinic',
      name: 'Hill Country Clinic',
      contract: { state: 'toSign', sendId: 's2', signBy: '2026-10-16', total: 187000, fileName: 'c.pdf', fileUrl: null, priceChanged: true, retainagePct: null, retainageStep: null, payDays: null, lateInterestPctPerMonth: null, lateFinishPerDay: null },
      changeOrders: [],
      canAccept: false,
      accepted: null,
    }
    render(<PortalGcJobs token={"t".repeat(32)} jobs={[job]} formatUsd={usd} />)
    expect(screen.getByText('Our price changed after we sent this. We will send you the new one.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign the contract' })).toBeNull()
  })
})
