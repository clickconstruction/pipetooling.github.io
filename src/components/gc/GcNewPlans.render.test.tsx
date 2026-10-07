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
  gc: { stage: 'bidding', bid_due: null, sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: null, project_manager_user_id: null, general_conditions: 0, contingency_pct: 0, fee_pct: 0, drive_folder_url: '', lost_on: null },
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
})
