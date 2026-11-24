// @vitest-environment jsdom
/**
 * The Release of record tab, punch list #435 piece 2: money holds the print and the save, a typed reason lets the
 * release go anyway, a saved release shows the county's stamp as two values changed in place and takes no second
 * save, and a job with two filed liens picks which one. The rules are held by `lienReleaseOfRecord.test.ts`.
 * Wiring only: the writes go to a stub and are read back off it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

const writes = vi.hoisted(() => ({ inserts: [] as Array<Record<string, unknown>>, updates: [] as Array<{ patch: Record<string, unknown>; id: string }> }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (table: string) => unknown }
  const from = stub.from.bind(stub)
  return {
    supabase: {
      ...stub,
      from: (table: string) => {
        if (table !== 'job_lien_filings') return from(table)
        return {
          ...(from(table) as object),
          insert: (row: Record<string, unknown>) => {
            writes.inserts.push(row)
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new-release' }, error: null }) }) }
          },
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              writes.updates.push({ patch, id })
              return Promise.resolve({ data: null, error: null })
            },
          }),
        }
      },
    },
  }
})

afterEach(() => {
  cleanup()
  writes.inserts.length = 0
  writes.updates.length = 0
})

// Every job, name, instrument and amount here is made up.
const address = { id: 'addr-1', county: 'Travis', legal_description: 'LOT 1 BLK 2 LARKSPUR SUBD', owner_name: 'Marisol Okafor', owner_company: '', owner_mailing_address: '1 Owner Way, Austin, TX 78701', homestead: false }
const lien = (over: Record<string, unknown> = {}) => ({ id: 'a1', job_id: 'job-2041', kind: 'affidavit', filed_at: '2026-11-09', serve_due: '2026-11-16', served_at: '2026-11-12', voided_at: null, county: 'Travis', recording_number: '2026-0412207', months_covered: [], sends: [], fields: {}, amount: 7420, created_at: '2026-11-09T15:00:00Z', ...over })
const release = (over: Record<string, unknown> = {}) => ({ ...lien(), id: 'r1', kind: 'release_of_record', filed_at: null, amount: 0, fields: { releasesFilingId: 'a1', paymentDate: '2026-11-20' }, created_at: '2026-11-21T15:00:00Z', ...over })
const owing = () => makeJob({ id: 'job-2041', hcp_number: '2041', job_name: 'Okafor main house', job_address: '212 Larkspur Court, Austin, TX', status: 'billed', revenue: 7420, payments_made: 0 })
const paid = () =>
  makeJob({ id: 'job-2041', hcp_number: '2041', job_name: 'Okafor main house', job_address: '212 Larkspur Court, Austin, TX', status: 'billed', revenue: 7420, payments_made: 7420, payments: [{ id: 'p1', job_id: 'job-2041', invoice_id: null, amount: 7420, paid_on: '2026-11-20', payment_type: 'Cash', reference_number: null }] })

type Props = Parameters<typeof LienFilingTabs>[0]
const draw = (over: Partial<Props>) => {
  const onChanged = vi.fn()
  renderWithProviders(
    <LienFilingTabs
      job={owing()}
      jobNumber="2041"
      activeTab="release_record"
      issuer={null}
      signerNameFallback="R. Castellan, Master Plumber"
      linkedAddress={address as never}
      jobOwnerRow={null}
      filings={[lien() as never]}
      clock={{ workMonth: '2026-08', noticeDeadline: '2026-11-16', filingDeadline: '2026-12-15' }}
      isSub={false}
      originalContractorName=""
      ownerEmail=""
      originalContractorEmail=""
      onChanged={onChanged}
      {...over}
    />,
  )
  return { onChanged }
}
const actions = () => [...document.querySelectorAll<HTMLButtonElement>('[data-lien-release-actions] button')]
const money = () => document.querySelector<HTMLElement>('[data-lien-release-money]')!

describe('Release of record: money holds the release', () => {
  it('holds the print and the save while the bills still owe, and says what is open', () => {
    draw({})
    expect(money().dataset.lienReleaseMoney).toBe('red')
    expect(money().getAttribute('role')).toBe('alert')
    expect(money().textContent).toContain('$7,420.00 is still open on this job’s bills. Record the payment first.')
    expect(actions().map((b) => [b.textContent, b.disabled])).toEqual([
      ['Print for notarization', true],
      ['Download PDF', true],
      ['Save release record', true],
    ])
    fireEvent.click(actions()[2]!)
    expect(writes.inserts).toEqual([])
  })

  it('lets it go once a reason is typed, and saves the reason and the affidavit it names', async () => {
    const { onChanged } = draw({})
    fireEvent.click(screen.getByRole('button', { name: 'Release it anyway…' }))
    expect(actions().every((b) => b.disabled)).toBe(true)
    fireEvent.change(document.querySelector<HTMLInputElement>('[data-lien-release-anyway-reason]')!, { target: { value: 'settled for less, per the owner' } })
    expect(money().dataset.lienReleaseMoney).toBe('amber')
    expect(money().textContent).toContain('The release goes out anyway.')
    expect(actions().every((b) => !b.disabled)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save release record' }))
    await waitFor(() => expect(writes.inserts).toHaveLength(1))
    const row = writes.inserts[0]!
    expect(row.kind).toBe('release_of_record')
    expect(row.recording_number).toBe('2026-0412207')
    expect(row.fields).toMatchObject({ releasesFilingId: 'a1', releasedUnpaidReason: 'settled for less, per the owner', recordingNumber: '2026-0412207', county: 'Travis' })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('is open on a paid job, with the payment date on the last payment’s day', async () => {
    draw({ job: paid() })
    expect(money().dataset.lienReleaseMoney).toBe('green')
    expect(money().textContent).toBe('Paid Nov 20 by cash.')
    expect((screen.getByLabelText('Payment / satisfaction date') as HTMLInputElement).value).toBe('2026-11-20')
    expect(actions().every((b) => !b.disabled)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save release record' }))
    await waitFor(() => expect(writes.inserts).toHaveLength(1))
    expect(writes.inserts[0]!.fields).toMatchObject({ releasesFilingId: 'a1', paymentDate: '2026-11-20' })
    expect((writes.inserts[0]!.fields as Record<string, unknown>).releasedUnpaidReason).toBeUndefined()
  })
})

describe('Release of record: a saved release and the county’s stamp', () => {
  it('takes no second save, and keeps the recorded day and the instrument number where they sit', async () => {
    const { onChanged } = draw({ job: paid(), filings: [lien() as never, release() as never] })
    expect(document.querySelector('[data-lien-release-saved]')!.textContent).toBe('This release is saved. Sign it before a notary. Then record it at the county.')
    expect(actions().map((b) => b.textContent)).toEqual(['Print for notarization', 'Download PDF'])
    expect(document.querySelector('[data-lien-release-money]')).toBeNull()

    const stamp = document.querySelector<HTMLElement>('[data-lien-release-stamp]')!
    expect(stamp.textContent).toContain('Recorded on')
    expect(stamp.textContent).toContain('not yet')
    fireEvent.click(screen.getByRole('button', { name: /the release’s instrument number/ }))
    fireEvent.change(screen.getByLabelText(/the release’s instrument number/), { target: { value: '2026-0431955' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(writes.updates).toHaveLength(1))
    expect(writes.updates[0]).toEqual({ id: 'r1', patch: { fields: { releasesFilingId: 'a1', paymentDate: '2026-11-20', releaseInstrument: '2026-0431955' } } })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('reads released once the county’s day is on the row', () => {
    draw({ job: paid(), filings: [lien() as never, release({ filed_at: '2026-11-23', fields: { releasesFilingId: 'a1', releaseInstrument: '2026-0431955' } }) as never] })
    const saved = document.querySelector<HTMLElement>('[data-lien-release-saved]')!
    expect(saved.dataset.lienReleaseSaved).toBe('recorded')
    expect(saved.textContent).toBe('Released. The county recorded it Nov 23 as 2026-0431955.')
  })
})

describe('Release of record: a job with two filed liens', () => {
  it('asks which lien, opens on the one still to release, and saves against the one picked', async () => {
    const second = lien({ id: 'a2', recording_number: '2026-0500001', filed_at: '2026-11-16' })
    draw({ job: paid(), filings: [lien() as never, second as never, release({ filed_at: '2026-11-23' }) as never] })
    const which = document.querySelector<HTMLElement>('[data-lien-release-which]')!
    expect(which.textContent).toContain('instrument #2026-0412207, filed November 9, 2026, released')
    const radios = [...which.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios.map((r) => r.checked)).toEqual([false, true])
    fireEvent.click(screen.getByRole('button', { name: 'Save release record' }))
    await waitFor(() => expect(writes.inserts).toHaveLength(1))
    expect(writes.inserts[0]!.recording_number).toBe('2026-0500001')
    expect(writes.inserts[0]!.fields).toMatchObject({ releasesFilingId: 'a2' })
    fireEvent.click(radios[0]!)
    expect(document.querySelector('[data-lien-release-saved]')!.textContent).toContain('Released. The county recorded it Nov 23.')
  })
})
