// @vitest-environment jsdom
/**
 * The certificate check on a job's insurance sheet (punch list #404, step 6): where each trade's certificate stands,
 * the check list, Mark it good and Send it back. Every name and amount here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'dev', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CertRow } from '../../lib/documentBuilder/certificates'
import type { SendParty } from '../../lib/documentBuilder/send'
import { sheetAsks, type ResolvedSheet } from '../../lib/documentBuilder/sheet'
import { SheetCertificatesCard, type SheetCertificatesIo } from './SheetCertificatesCard'

/** A made-up published sheet. Every name and amount is invented. */
const PAGE = { insured: ['Pecan Ridge Holdings'], place: '410 Sample Street', hName: 'Acme Plumbing', cover: [{ label: 'General liability', limit: 'a made-up amount' }], foot: 'A made-up foot line.' } as ResolvedSheet
const ASKS = sheetAsks(PAGE)
const TODAY = '2026-11-21'

const party = (id: string, name: string): SendParty => ({ id, name, page: { state: 'on' }, contacts: [], send: null })
const cert = (over: Partial<CertRow> = {}): CertRow => ({
  id: 'c1',
  companyId: 'capped',
  status: 'received',
  expiresOn: '2027-03-03',
  sentAt: '2026-11-18T15:00:00Z',
  sentOn: '2026-11-18',
  createdAt: '2026-11-18T15:00:00Z',
  url: 'https://example.test/c1.pdf',
  sheetProjectId: null,
  sheetRevision: null,
  sheetAsks: null,
  checkedAt: null,
  sentBackAt: null,
  sentBackOn: null,
  missing: null,
  ...over,
})

function show(opts: { certs?: CertRow[]; parties?: SendParty[]; revision?: number; page?: ResolvedSheet | null; io?: Partial<SheetCertificatesIo> } = {}) {
  const io = {
    readParties: vi.fn(async () => opts.parties ?? [party('capped', 'Capped Concrete'), party('far', 'Far Field Framing')]),
    readCertificates: vi.fn(async () => opts.certs ?? [cert()]),
    markGood: vi.fn(async () => ({ ok: true as const, value: true as const })),
    sendBack: vi.fn(async () => ({ ok: true as const, value: { emailed: true, emailWords: '' } })),
    ...opts.io,
  }
  render(
    <SheetCertificatesCard projectId="cedar" job="Cedar Park Medical Office" sheetId="sheet-cedar" revision={opts.revision ?? 2} page={opts.page === undefined ? PAGE : opts.page} today={TODAY} io={io as unknown as SheetCertificatesIo} />,
  )
  return io
}

afterEach(cleanup)

const row = (id: string) => document.querySelector(`[data-certificate-row="${id}"]`) as HTMLElement

describe('SheetCertificatesCard (Documents → Document builder → a job\'s sheet)', () => {
  it('says where each trade\'s certificate stands, and counts them', async () => {
    const io = show()
    await waitFor(() => expect(row('capped')).toBeTruthy())
    expect(io.readCertificates).toHaveBeenCalledWith(['capped', 'far'])
    expect(within(row('capped')).getByText('Certificate came in Nov 18')).toBeTruthy()
    expect(within(row('far')).getByText('No certificate yet')).toBeTruthy()
    expect(screen.getByTestId('certificate-counts').textContent).toBe('1 certificate to check. 1 trade has no good certificate.')
    // Only the one that waits for a look has a press.
    expect(within(row('capped')).getByRole('button', { name: 'Check it against the sheet, Capped Concrete' })).toBeTruthy()
    expect(within(row('far')).queryByRole('button')).toBeNull()
  })

  it('marks one good only with every line ticked, and sends the lines and the day', async () => {
    const io = show()
    await waitFor(() => expect(row('capped')).toBeTruthy())
    fireEvent.click(within(row('capped')).getByRole('button', { name: 'Check it against the sheet, Capped Concrete' }))
    const check = screen.getByTestId('certificate-check')
    expect(within(check).getByText('What this job\'s sheet asks, revision 2')).toBeTruthy()
    expect(within(check).getByRole('link', { name: 'Open their file' }).getAttribute('href')).toBe('https://example.test/c1.pdf')
    const boxes = within(check).getAllByRole('checkbox')
    expect(boxes).toHaveLength(ASKS.length)
    const first = within(check).getByRole('button', { name: `0 of ${ASKS.length} checked` }) as HTMLButtonElement
    expect(first.disabled).toBe(true)
    for (const box of boxes) fireEvent.click(box)
    const good = within(check).getByRole('button', { name: 'Mark it good' }) as HTMLButtonElement
    expect(good.disabled).toBe(false)
    fireEvent.click(good)
    await waitFor(() => expect(io.markGood).toHaveBeenCalledWith({ paperId: 'c1', sheetId: 'sheet-cedar', asks: ASKS, goodUntil: '2027-03-03' }))
    // The check shuts and the rows are read again.
    await waitFor(() => expect(screen.queryByTestId('certificate-check')).toBeNull())
    expect(vi.mocked(io.readParties).mock.calls.length).toBeGreaterThan(1)
  })

  it('holds Mark it good on a day that has passed, and says why', async () => {
    show({ certs: [cert({ expiresOn: '2026-11-01' })] })
    await waitFor(() => expect(row('capped')).toBeTruthy())
    fireEvent.click(within(row('capped')).getByRole('button', { name: 'Check it against the sheet, Capped Concrete' }))
    const check = screen.getByTestId('certificate-check')
    for (const box of within(check).getAllByRole('checkbox')) fireEvent.click(box)
    expect((within(check).getByRole('button', { name: 'Mark it good' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(check).getByText('That day has passed. Ask them for the current certificate.')).toBeTruthy()
  })

  it('sends one back naming what is left unticked, and never one nobody read', async () => {
    const io = show()
    await waitFor(() => expect(row('capped')).toBeTruthy())
    fireEvent.click(within(row('capped')).getByRole('button', { name: 'Check it against the sheet, Capped Concrete' }))
    const check = screen.getByTestId('certificate-check')
    const back = () => within(check).getByRole('button', { name: /^Send it back/ }) as HTMLButtonElement
    expect(back().disabled).toBe(true)
    fireEvent.click(within(check).getAllByRole('checkbox')[0]!)
    expect(back().textContent).toBe(`Send it back, naming ${ASKS.length - 1} things missing`)
    expect(back().disabled).toBe(false)
    fireEvent.click(back())
    await waitFor(() => expect(io.sendBack).toHaveBeenCalledWith({ paperId: 'c1', sheetId: 'sheet-cedar', projectId: 'cedar', companyId: 'capped', job: 'Cedar Park Medical Office', missing: ASKS.slice(1) }))
  })

  it('says so when the send-back is kept and its email did not go', async () => {
    show({ io: { sendBack: vi.fn(async () => ({ ok: true as const, value: { emailed: false, emailWords: 'It is marked as sent back. The email to them did not go. They have no email address on file.' } })) } })
    await waitFor(() => expect(row('capped')).toBeTruthy())
    fireEvent.click(within(row('capped')).getByRole('button', { name: 'Check it against the sheet, Capped Concrete' }))
    const check = screen.getByTestId('certificate-check')
    fireEvent.click(within(check).getAllByRole('checkbox')[0]!)
    fireEvent.click(within(check).getByRole('button', { name: /^Send it back/ }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('The email to them did not go.'))
  })

  it('keeps the check open and says the reason when a press is refused', async () => {
    show({ io: { markGood: vi.fn(async () => ({ ok: false as const, error: 'That company is not on a trade of this job.' })) } })
    await waitFor(() => expect(row('capped')).toBeTruthy())
    fireEvent.click(within(row('capped')).getByRole('button', { name: 'Check it against the sheet, Capped Concrete' }))
    const check = screen.getByTestId('certificate-check')
    for (const box of within(check).getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.click(within(check).getByRole('button', { name: 'Mark it good' }))
    await waitFor(() => expect(within(check).getByRole('alert').textContent).toBe('That company is not on a trade of this job.'))
  })

  it('lists what was sent back, and offers Check it again when the sheet changed', async () => {
    show({
      certs: [
        cert({ sheetProjectId: 'cedar', sentBackAt: '2026-11-20T15:00:00Z', sentBackOn: '2026-11-20', missing: ['General liability: a made-up amount.'] }),
        cert({ id: 'c2', companyId: 'far', status: 'signed', sheetProjectId: 'cedar', sheetRevision: 1, sheetAsks: ['An older line.'], checkedAt: '2026-11-19T15:00:00Z' }),
      ],
    })
    await waitFor(() => expect(row('capped')).toBeTruthy())
    expect(within(row('capped')).getByText('Sent back Nov 20, 1 thing missing')).toBeTruthy()
    expect(within(row('capped')).getByText('General liability: a made-up amount.')).toBeTruthy()
    expect(within(row('far')).getByText('The sheet changed since their certificate')).toBeTruthy()
    expect(within(row('far')).getByRole('button', { name: 'Check it again, Far Field Framing' })).toBeTruthy()
  })

  it('offers no check before the sheet is published, and draws nothing on a job with no trade', async () => {
    show({ revision: 0, page: null })
    await waitFor(() => expect(row('capped')).toBeTruthy())
    expect(screen.getByText("Publish this job's sheet first. A certificate is checked against the published sheet.")).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws nothing on a job with no trade', async () => {
    const io = show({ parties: [] })
    await waitFor(() => expect(io.readCertificates).toHaveBeenCalled())
    expect(screen.queryByTestId('sheet-certificates')).toBeNull()
  })

  it('says why the certificates did not read', async () => {
    show({ io: { readCertificates: vi.fn(async () => Promise.reject(new Error('a made-up reason'))) } })
    expect(await screen.findByText(/a made-up reason/)).toBeTruthy()
    expect(screen.queryByTestId('sheet-certificates')).toBeNull()
  })
})
