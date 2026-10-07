// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcPlansWindow } from './GcPlansWindow'
import { gcProjectFromRows, type GcProjectRows } from '../../lib/gc/projectRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const rows: GcProjectRows = {
  project: { id: 'p1', name: 'Clinic', address: '1 Test St', customer_id: 'c1', plans_link: null },
  gc: { stage: 'bidding', bid_due: null, sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: null, project_manager_user_id: null, general_conditions: 0, contingency_pct: 0, fee_pct: 0, drive_folder_url: '', lost_on: null },
  packages: [{ id: 'site', trade: 'Sitework', position: 0, budget: 0, ours: false, own_bid_id: null }],
  scopeItems: [{ id: 's1', package_id: 'site', position: 0, label: 'Clearing and grading', sheets: ['C-201'], specs: null, added_in_set_id: null }],
  exclusions: [],
  sets: [
    { id: 'set0', rev: 0, label: 'Bid set', kind: 'Bid set', issued_on: '2026-10-01', note: '', checked_by_user_id: null, drive_url: '', drive_access: null, drive_checked_on: null },
    { id: 'set1', rev: 1, label: 'Permit set', kind: 'Permit set', issued_on: '2026-10-06', note: 'The permit set.', checked_by_user_id: null, drive_url: '', drive_access: null, drive_checked_on: null },
  ],
  setItems: [
    { id: 'i1', set_id: 'set0', position: 0, kind: 'sheet', number: 'C-101', title: 'Site plan', change: 'issued', was_title: null, discipline: 'Civil', page: null },
    { id: 'i2', set_id: 'set0', position: 1, kind: 'sheet', number: 'C-201', title: 'Grading and drainage plan', change: 'issued', was_title: null, discipline: 'Civil', page: null },
    { id: 'i6', set_id: 'set1', position: 0, kind: 'sheet', number: 'C-101', title: 'Site and grading plan', change: 'renamed', was_title: 'Site plan', discipline: null, page: null },
    { id: 'i7', set_id: 'set1', position: 1, kind: 'sheet', number: 'C-201', title: '', change: 'removed', was_title: null, discipline: null, page: null },
  ],
}

describe('GcPlansWindow', () => {
  it('opens on the newest set with the sheet taken out under Taken out, and reads the older set when picked', () => {
    render(<GcPlansWindow project={gcProjectFromRows(rows)} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'Clinic plans' })).toBeTruthy()
    expect(screen.getByText('Taken out')).toBeTruthy()
    expect(screen.getByText('Grading and drainage plan')).toBeTruthy()
    expect(document.body.textContent).toContain('1 sheet taken out.')
    fireEvent.click(screen.getByText('Grading and drainage plan'))
    expect(screen.getByText('Taken out by Permit set')).toBeTruthy()
    expect(screen.getByText('Clearing and grading')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Bid set/ }))
    expect(screen.queryByText('Taken out')).toBeNull()
    expect(screen.getByText('Site plan')).toBeTruthy()
  })
})
