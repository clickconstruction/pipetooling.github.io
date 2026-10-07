// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcNewPlansWindow } from './GcNewPlans'
import type { GcProjectView } from '../../lib/gc/projectRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** A clinic as the mapper gives it: one set, four sheets, two trades. */
const clinic: GcProjectView = {
  id: 'p1',
  name: 'Fair Oaks Clinic',
  address: '1 Test St',
  customerId: 'c1',
  stage: 'bidding',
  bidDue: null,
  sqFt: null,
  sizeNote: '',
  customerRole: 'owner',
  propertyOwnerId: null,
  architectId: null,
  projectManagerUserId: null,
  generalConditions: 0,
  contingencyPct: 0,
  feePct: 0,
  driveFolderUrl: '',
  lostOn: null,
  sheets: [
    { id: 'C-201', title: 'Grading and drainage plan' },
    { id: 'E-101', title: 'Power plan' },
    { id: 'E-201', title: 'Lighting plan' },
    { id: 'M-101', title: 'HVAC plan' },
  ],
  specs: [],
  trades: [
    { id: 'site', trade: 'Sitework', position: 0, budget: 0, ours: false, ownBidId: null, scope: [{ id: 's1', label: 'Clearing and grading', sheets: ['C-201'], specs: null, addedInSetId: null }], excludes: [] },
    { id: 'elec', trade: 'Electrical', position: 1, budget: 0, ours: false, ownBidId: null, scope: [{ id: 'e1', label: 'Lighting', sheets: null, specs: null, addedInSetId: null }], excludes: [] },
  ],
  planSets: [
    {
      id: 'set0',
      rev: 0,
      label: 'Bid set',
      kind: 'Bid set',
      issuedOn: '2026-10-01',
      note: '',
      checkedByUserId: null,
      drive: { url: '', access: null, checkedOn: null },
      changedSheets: [],
      addedSheets: [],
      removedSheets: [],
      retitledSheets: [],
      changedSpecs: [],
      addedSpecs: [],
      removedSpecs: [],
      retitledSpecs: [],
      addedLines: [],
    },
  ],
  packages: [],
}

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
