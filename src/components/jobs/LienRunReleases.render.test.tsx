// @vitest-environment jsdom
/**
 * The releases on the run (punch list #435, piece 5): each saved release under the act it is on, the one print with
 * what it holds, the two days typed where they sit, the county's door, and a viewer with no press. The facts are
 * handed in; the rule is held by `lienReleaseRun.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { LienPayoffFacts, LienPayoffRelease } from '../../lib/jobs/lienPayoff'
import type { ReleaseFactsChange } from '../../lib/jobs/lienReleaseFacts'
import type { SentFiling } from '../../lib/sent/sentCopies'
import LienRunReleases, { type LienRunReleasesProps } from './LienRunReleases'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// Every name, address, job, instrument and amount here is made up.
const TODAY = '2026-12-01'
const WHO = { id: 'u1', name: 'Alex Rivera' }
const PAPER = { county: 'Travis', claimantCompany: 'Marlow Mechanical', claimantPersonName: 'R. Castellan', filedDate: '2026-11-09', legalDescription: 'LOT 1 BLK 2 LARKSPUR SUBD', propertyAddress: '212 Larkspur Court, Austin, TX', ownerName: 'Marisol Okafor', paymentDate: '2026-11-24' }
const rel = (id: string, job: string, affidavit: string, instrument: string, more: Record<string, unknown> = {}, filedAt: string | null = null): LienPayoffRelease => ({ id, job_id: job, created_at: '2026-11-25T16:00:00Z', filed_at: filedAt, recording_number: instrument, fields: { ...PAPER, recordingNumber: instrument, releasesFilingId: affidavit, ...more } })
const facts = (releases: LienPayoffRelease[], over: Partial<LienPayoffFacts> = {}): LienPayoffFacts => ({
  affidavits: [
    { id: 'a1', job_id: 'j1', amount: 7420, county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-11-09', fields: {} },
    { id: 'a2', job_id: 'j2', amount: 5160.5, county: 'Travis', recording_number: '2026-0412208', filed_at: '2026-11-09', fields: {} },
    { id: 'a3', job_id: 'j3', amount: 900, county: 'Bastrop', recording_number: '2026-0500001', filed_at: '2026-10-02', fields: {} },
  ],
  releases,
  jobs: [
    { id: 'j1', hcp_number: null, click_number: '2041', job_name: 'Okafor main house', job_address: '212 Larkspur Court, Austin, TX', customer_id: 'c1', customer_name: 'Marisol Okafor' },
    { id: 'j2', hcp_number: null, click_number: '2058', job_name: 'Okafor service visit', job_address: '212 Larkspur Ct Austin TX', customer_id: 'c1', customer_name: 'Marisol Okafor' },
    { id: 'j3', hcp_number: null, click_number: '1987', job_name: 'Calloway gate', job_address: '40 Calloway Road, Bastrop', customer_id: 'c2', customer_name: 'Calloway Homes' },
  ],
  openByJob: { j1: 0, j2: 0, j3: 0 },
  paymentsByJob: {},
  bank: [],
  todayYmd: TODAY,
  ...over,
})
const R1 = rel('r1', 'j1', 'a1', '2026-0412207')
const R2 = rel('r2', 'j2', 'a2', '2026-0412208')

const draw = (f: LienPayoffFacts, over: Partial<LienRunReleasesProps> = {}) => {
  const read = vi.fn(() => Promise.resolve(f))
  const keep = vi.fn((rows: ReadonlyArray<{ releaseId: string }>, _change: ReleaseFactsChange) => Promise.resolve(rows.map((r) => ({ releaseId: r.releaseId, ok: true, why: null as string | null }))))
  const print = vi.fn((_html: string) => true)
  const file = vi.fn((_filing: SentFiling, _body: unknown) => Promise.resolve(true))
  const onOpenRelease = vi.fn()
  const onChanged = vi.fn()
  renderWithProviders(<LienRunReleases todayYmd={TODAY} refreshKey={1} isMobile={false} issuer={null} who={WHO} onOpenRelease={onOpenRelease} onChanged={onChanged} read={read} keep={keep} print={print} file={file} {...over} />)
  return { read, keep, print, file, onOpenRelease, onChanged }
}
const found = (selector: string) =>
  waitFor(() => {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) throw new Error(`${selector} is not drawn yet`)
    return el
  })
const lineOf = (id: string) => document.querySelector<HTMLElement>(`[data-lien-run-release="${id}"]`)!

afterEach(cleanup)

describe('LienRunReleases', () => {
  it('draws nothing while no saved release has an act left', async () => {
    const { read } = draw(facts([]))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    expect(document.querySelector('[data-lien-run-card="releases"]')).toBeNull()
  })

  it('lists each release under the act it is on, with the tally', async () => {
    draw(facts([R1, rel('r2', 'j2', 'a2', '2026-0412208', { printedForNotary: { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T18:00:00Z' } }), rel('r3', 'j3', 'a3', '2026-0500001', { releaseInstrument: '2026-0500990' }, '2026-11-30')]))
    const card = await found('[data-lien-run-card="releases"]')
    expect(card.querySelector('[data-lien-run-releases-tally]')!.textContent).toBe('1 to print · 1 at the notary · 1 to send')
    expect(card.querySelector('[data-lien-run-releases="print"]')!.textContent).toContain('Print for the notary · 1 release')
    expect(card.querySelector('[data-lien-run-releases="notary"] [data-lien-run-release-note]')!.textContent).toBe('Printed Nov 26 by Alex Rivera.')
    expect(card.querySelector('[data-lien-run-releases="copies"] [data-lien-run-release-note]')!.textContent).toBe('Recorded Nov 30 as 2026-0500990.')
    expect(card.querySelector('[data-lien-run-releases="county"]')).toBeNull()
    expect(lineOf('r1').textContent).toContain('2041')
    expect(lineOf('r1').textContent).toContain('releases instrument 2026-0412207')
  })

  it('prints the ready releases in one print, files a copy a job, and marks each printed by who pressed', async () => {
    const { keep, print, file, read, onChanged } = draw(facts([R1, R2]))
    const press = await found('[data-lien-run-releases-print]')
    expect(press.textContent).toBe('Print 2 releases for the notary')
    fireEvent.click(press)
    expect(print).toHaveBeenCalledTimes(1)
    const html = print.mock.calls[0]![0]
    expect(html).toContain('2026-0412207')
    expect(html).toContain('2026-0412208')
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    expect(keep.mock.calls[0]![0].map((r) => r.releaseId)).toEqual(['r1', 'r2'])
    expect(keep.mock.calls[0]![1]).toMatchObject({ printed: { by: 'u1', name: 'Alex Rivera' } })
    expect(file).toHaveBeenCalledTimes(2)
    expect(file.mock.calls.map((c) => c[0])).toEqual([
      expect.objectContaining({ kind: 'lien_release_of_record', jobIds: ['j1'], how: 'print', title: 'Release of Recorded Lien — Job 2041' }),
      expect.objectContaining({ kind: 'lien_release_of_record', jobIds: ['j2'], how: 'print', title: 'Release of Recorded Lien — Job 2058' }),
    ])
    await screen.findByText('Printed 2 releases.')
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(onChanged).toHaveBeenCalled()
  })

  it('holds a release whose bills owe again: the press says so and prints the rest', async () => {
    const { keep, print } = draw(facts([R1, R2], { openByJob: { j1: 0, j2: 5160.5, j3: 0 } }))
    const press = await found('[data-lien-run-releases-print]')
    expect(press.textContent).toBe('Print 1 release for the notary · 1 is short ▸')
    expect(document.querySelector('[data-lien-run-releases-print-foot]')!.textContent).toContain('1 is held.')
    expect(lineOf('r2').dataset.held).toBe('short')
    expect(lineOf('r2').querySelector('[data-lien-run-release-held]')!.textContent).toBe('Held. $5,160.50 is open on this job’s bills again.')
    fireEvent.click(press)
    expect(print.mock.calls[0]![0]).not.toContain('2026-0412208')
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    expect(keep.mock.calls[0]![0].map((r) => r.releaseId)).toEqual(['r1'])
  })

  it('is dead with nothing ready, and marks nothing when the print window is blocked', async () => {
    draw(facts([R2], { openByJob: { j1: 0, j2: 5160.5, j3: 0 } }))
    const dead = await found('[data-lien-run-releases-print]')
    expect(dead.textContent).toBe('Print ▸')
    expect((dead as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    const { keep, file } = draw(facts([R1]), { print: vi.fn((_html: string) => false) })
    fireEvent.click(await found('[data-lien-run-releases-print]'))
    await screen.findByText('The print window was blocked. Allow pop-ups for this site, then print again.')
    expect(keep).not.toHaveBeenCalled()
    expect(file).not.toHaveBeenCalled()
  })

  it('leaves out a release whose row holds no paper, and says to print it from its own tab', async () => {
    const bare: LienPayoffRelease = { id: 'r2', job_id: 'j2', created_at: '2026-11-25T16:00:00Z', filed_at: null, recording_number: '2026-0412208', fields: { releasesFilingId: 'a2' } }
    const { keep, print } = draw(facts([R1, bare]))
    fireEvent.click(await found('[data-lien-run-releases-print]'))
    expect(print.mock.calls[0]![0]).not.toContain('2026-0412208')
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    expect(keep.mock.calls[0]![0].map((r) => r.releaseId)).toEqual(['r1'])
    expect(lineOf('r2').querySelector('[data-lien-run-release-no-paper]')!.textContent).toBe('This release does not hold its paper. Print it from its own tab.')
  })

  it('keeps the day a release was notarized where it sits', async () => {
    const { keep } = draw(facts([rel('r1', 'j1', 'a1', '2026-0412207', { printedForNotary: { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T18:00:00Z' } })]))
    await found('[data-lien-run-releases="notary"]')
    fireEvent.click(screen.getByRole('button', { name: /the day it was notarized/ }))
    fireEvent.change(screen.getByLabelText(/the day it was notarized/), { target: { value: '2026-11-28' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    expect(keep.mock.calls[0]![0]).toEqual([expect.objectContaining({ releaseId: 'r1' })])
    expect(keep.mock.calls[0]![1]).toEqual({ notarizedYmd: '2026-11-28' })
  })

  it('opens the release’s tab for the county’s stamp, and keeps the day the copies went', async () => {
    const { keep, onOpenRelease } = draw(facts([rel('r1', 'j1', 'a1', '2026-0412207', { notarizedYmd: '2026-11-28' }), rel('r3', 'j3', 'a3', '2026-0500001', {}, '2026-11-30')]))
    const county = await found('[data-lien-run-releases="county"] [data-lien-run-release-open]')
    expect(county.textContent).toBe('Record the county’s stamp ›')
    fireEvent.click(county)
    expect(onOpenRelease).toHaveBeenCalledWith('j1')
    fireEvent.click(screen.getByRole('button', { name: /the day the stamped copies were sent/ }))
    fireEvent.change(screen.getByLabelText(/the day the stamped copies were sent/), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
    expect(keep.mock.calls[0]![0]).toEqual([expect.objectContaining({ releaseId: 'r3' })])
    expect(keep.mock.calls[0]![1]).toMatchObject({ copies: { ymd: '2026-12-01', by: 'u1', name: 'Alex Rivera' } })
  })

  it('shows a viewer outside the lien office the list with no press', async () => {
    draw(facts([R1, rel('r3', 'j3', 'a3', '2026-0500001', {}, '2026-11-30')]), { who: null })
    await found('[data-lien-run-card="releases"]')
    expect(document.querySelector('[data-lien-run-releases-print]')).toBeNull()
    expect(screen.queryByRole('button', { name: /the day/ })).toBeNull()
  })

  it('names the reason a read failed and reads again on Try again', async () => {
    let fail = true
    const read = vi.fn(() => (fail ? Promise.reject(new Error('permission denied for table job_lien_filings')) : Promise.resolve(facts([R1]))))
    draw(facts([]), { read })
    const failed = await found('[data-lien-run-card="releases"][data-state="failed"]')
    expect(failed.textContent).toContain('permission denied for table job_lien_filings')
    fail = false
    fireEvent.click(failed.querySelector('[data-lien-run-releases-retry]')!)
    await found('[data-lien-run-releases="print"]')
  })

  it('makes each press a finger tall on a phone', async () => {
    draw(facts([R1, rel('r2', 'j2', 'a2', '2026-0412208', { notarizedYmd: '2026-11-28' })]), { isMobile: true })
    expect((await found('[data-lien-run-releases-print]')).style.minHeight).toBe('44px')
    expect(document.querySelector<HTMLElement>('[data-lien-run-release-open]')!.style.minHeight).toBe('44px')
  })
})
