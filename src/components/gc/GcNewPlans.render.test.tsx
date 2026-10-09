// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcNewPlansWindow } from './GcNewPlans'
import { gcProjectFromRows, type GcProjectRows } from '../../lib/gc/projectRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** A clinic as the mapper gives it: one set, four sheets, two trades. */
const rows: GcProjectRows = {
  project: { id: 'p1', name: 'Fair Oaks Clinic', address: '1 Test St', customer_id: 'c1', plans_link: null },
  gc: { stage: 'bidding', bid_due: null, sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: null, project_manager_user_id: null, drive_folder_url: '', lost_on: null },
  packages: [
    { id: 'site', trade: 'Sitework', position: 0, budget: 0, ours: false, own_bid_id: null },
    { id: 'elec', trade: 'Electrical', position: 1, budget: 0, ours: false, own_bid_id: null },
  ],
  scopeItems: [
    { id: 's1', package_id: 'site', position: 0, label: 'Clearing and grading', sheets: ['C-201'], specs: null, added_in_set_id: null },
    { id: 'e1', package_id: 'elec', position: 0, label: 'Lighting', sheets: null, specs: null, added_in_set_id: null },
  ],
  exclusions: [],
  sets: [{ id: 'set0', rev: 0, label: 'Bid set', kind: 'Bid set', issued_on: '2026-10-01', note: '', checked_by_user_id: null, drive_url: '', drive_access: null, drive_checked_on: null }],
  setItems: [
    { id: 'i1', set_id: 'set0', position: 0, kind: 'sheet', number: 'C-201', title: 'Grading and drainage plan', change: 'issued', was_title: null, discipline: 'Civil', page: null },
    { id: 'i2', set_id: 'set0', position: 1, kind: 'sheet', number: 'E-101', title: 'Power plan', change: 'issued', was_title: null, discipline: 'Electrical', page: null },
    { id: 'i3', set_id: 'set0', position: 2, kind: 'sheet', number: 'E-201', title: 'Lighting plan', change: 'issued', was_title: null, discipline: 'Electrical', page: null },
    { id: 'i4', set_id: 'set0', position: 3, kind: 'sheet', number: 'M-101', title: 'HVAC plan', change: 'issued', was_title: null, discipline: 'Mechanical', page: null },
  ],
  questions: [],
}
const clinic = gcProjectFromRows(rows)

describe('GcNewPlansWindow', () => {
  it('reads the sheets from the notes, finds the line left behind, and refuses until someone checked the set', () => {
    const onIssue = vi.fn()
    render(<GcNewPlansWindow project={clinic} book={[]} team={[{ id: 'u1', name: 'Robert', role: 'dev' }]} today="2026-10-06" onClose={() => undefined} onIssue={onIssue} />)
    expect(screen.getByText('Say what changed first.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('What changed'), { target: { value: 'E-201: two more floor boxes. C-201 is taken out.' } })
    expect(screen.getByText('Lighting plan')).toBeTruthy()
    expect(screen.getByText('taken out')).toBeTruthy()
    expect(screen.getByText('Lines left with nothing to read')).toBeTruthy()
    expect(screen.getByText('Say who checked the set.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Issue Addendum 1/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('step 7: lists who hears the set, the company whose trade it changes first, and says how many it emails', () => {
    const parties = {
      invites: [
        { id: 'v1', packageId: 'site', companyId: 'k-site', status: 'bid' as const },
        { id: 'v2', packageId: 'elec', companyId: 'k-elec', status: 'opened' as const },
        { id: 'v3', packageId: 'elec', companyId: 'k-no', status: 'declined' as const },
      ],
      companies: [
        { id: 'k-site', name: 'Alamo Sitework', lang: 'en' as const },
        { id: 'k-elec', name: 'Pecan Valley Electric', lang: 'es' as const },
        { id: 'k-no', name: 'Said No Electric', lang: 'en' as const },
      ],
    }
    render(<GcNewPlansWindow project={clinic} book={[]} team={[]} today="2026-10-06" onClose={() => undefined} onIssue={vi.fn()} parties={parties} canSend />)
    fireEvent.change(screen.getByLabelText('What changed'), { target: { value: 'E-201: two more floor boxes.' } })
    expect(screen.getByText('Who hears it')).toBeTruthy()
    const names = screen.getAllByText(/Alamo Sitework|Pecan Valley Electric/).map((e) => e.textContent)
    expect(names).toEqual(['Pecan Valley Electric', 'Alamo Sitework'])
    expect(screen.queryByText('Said No Electric')).toBeNull()
    expect(screen.getByText('it changes their trade')).toBeTruthy()
    expect(screen.getByText('for their records')).toBeTruthy()
    // Unticked until the owner names an inbox (call 3): nothing goes out unless a dev ticks it.
    expect((screen.getByLabelText('Email them when the set goes on') as HTMLInputElement).checked).toBe(false)
    expect(screen.getByText(/No email goes out\./)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Email them when the set goes on'))
    expect(screen.getByText(/It emails 2 companies\./)).toBeTruthy()
  })

  it('step 7: someone who cannot send yet sees who would hear it, and no email box', () => {
    const parties = {
      invites: [{ id: 'v1', packageId: 'site', companyId: 'k-site', status: 'bid' as const }],
      companies: [{ id: 'k-site', name: 'Alamo Sitework', lang: 'en' as const }],
    }
    const onIssue = vi.fn()
    render(<GcNewPlansWindow project={clinic} book={[]} team={[]} today="2026-10-06" onClose={() => undefined} onIssue={onIssue} parties={parties} />)
    expect(screen.getByText('Alamo Sitework')).toBeTruthy()
    expect(screen.getByText('Emails to the companies go out once the portal opens.')).toBeTruthy()
    expect(screen.queryByLabelText('Email them when the set goes on')).toBeNull()
    expect(screen.getByText(/No email goes out\./)).toBeTruthy()
  })

  it('step 7: with nobody asked on the job, nobody hears it', () => {
    render(<GcNewPlansWindow project={clinic} book={[]} team={[]} today="2026-10-06" onClose={() => undefined} onIssue={vi.fn()} parties={{ invites: [], companies: [] }} />)
    expect(screen.getByText('Nobody is asked on this job yet, so no email goes out.')).toBeTruthy()
  })

  it('step 7: when some emails did not go out, it says so and offers Try again', () => {
    const onRetrySends = vi.fn()
    render(
      <GcNewPlansWindow
        project={clinic}
        book={[]}
        team={[]}
        today="2026-10-06"
        onClose={() => undefined}
        onIssue={vi.fn()}
        sendReport={{ summary: 'Emailed 1 company. 1 did not go out. Press Try again.', failed: 1 }}
        onRetrySends={onRetrySends}
      />,
    )
    expect(screen.getByText('Emailed 1 company. 1 did not go out. Press Try again.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetrySends).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Issue/ })).toBeNull()
  })
})
