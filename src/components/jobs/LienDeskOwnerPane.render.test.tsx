// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../lib/jobs/lienPublicPropertyIo', () => ({ setLienPublicAnswer: vi.fn(async () => ({ answer: 'private', jobs: [] })), readLienPublicProperty: () => new Promise(() => {}) }))

import LienDeskOwnerPane from './LienDeskOwnerPane'

describe('LienDeskOwnerPane — Is this public property? (v2.7443)', () => {
  const cityOwner = { ownerMode: 'building_owner', ownerName: 'ZZ TEST CITY OF', ownerCompany: 'ATTN REAL ESTATE MANAGER', mailingAddress: '1 Example St, Sampletown, TX 78000', email: '', phone: '', source: 'property_record' as const }
  const record = (answer: string | null | undefined) =>
    ({ id: 'addr-1', address: '100 Sample Rd', owner_name: 'ZZ TEST CITY OF', owner_company: 'ATTN REAL ESTATE MANAGER', owner_mailing_address: '1 Example St, Sampletown, TX 78000', owner_confirmed_at: '2026-09-22T15:00:00Z', parcel_source: 'statewide', ...(answer === undefined ? {} : { lien_public_answer: answer }) }) as never
  const pane = (address: unknown) => <LienDeskOwnerPane job={undefined} jobId="job-1" gcName="ZZ Test Builders" gcCustomerId={null} address={address as never} owner={cityOwner} ownerName="ZZ TEST CITY OF" userId="u-1" onChanged={() => {}} onOpenEditJob={() => {}} />

  it('unanswered, the record asks once in place of the fixed sentence', async () => {
    await renderSettled(pane(record(null)), { loaded: () => screen.findByText('Yes, public property…') })
    expect(document.querySelector('[data-lien-public-question]')).toBeTruthy()
    expect(screen.queryByText(/the remedy is a claim on the GC's payment bond/)).toBeNull()
  })

  it('answered private, the pane says nothing about public property', async () => {
    const { container } = await renderSettled(pane(record('private')), { loaded: () => null })
    expect(container.querySelector('[data-lien-public-question]')).toBeNull()
    expect(container.textContent).not.toContain('Public property')
  })

  it('with no record to answer on, the old sentence stays', async () => {
    await renderSettled(pane(null), { loaded: () => screen.findByText(/the remedy is a claim on the GC's payment bond/) })
    expect(document.querySelector('[data-lien-public-question]')).toBeNull()
  })
})

const noOwner = { ownerMode: '', ownerName: '', ownerCompany: '', mailingAddress: '', email: '', phone: '', source: 'none' as const }

describe('LienDeskOwnerPane — Find the owner ›', () => {
  it('opens Edit Job on the Property record row, as its hover promises (#87 E)', async () => {
    const onOpenEditJob = vi.fn()
    await renderSettled(
      <LienDeskOwnerPane job={undefined} jobId="job-1" gcName="Lowbeck Contracting" gcCustomerId={null} address={null} owner={noOwner} ownerName="" userId={null} onChanged={() => {}} onOpenEditJob={onOpenEditJob} />,
      { loaded: () => screen.findByText('No job address to look up.') },
    )
    const door = screen.getByRole('button', { name: 'Find the owner ›' })
    expect(door.getAttribute('title')).toContain('Edit Job → Property record')
    fireEvent.click(door)
    expect(onOpenEditJob).toHaveBeenCalledWith('job-1', 'property-record')
  })
})
