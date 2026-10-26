import { describe, expect, it } from 'vitest'
import {
  ageDays,
  bankingSortingNextLine,
  billedAwaitingNextLine,
  boxesNextLine,
  completeNoBillNextLine,
  dispatchInboxNextLine,
  emailNextLine,
  fieldPhotosNextLine,
  jobFollowupsNextLine,
  jobsCleanupNextLine,
  missingJobInfoNextLine,
  peopleHoursNextLine,
  percentCompleteNextLine,
  physicalInboxNextLine,
  propertyKindsNextLine,
  supplyHousesNextLine,
  textsNextLine,
  todaysLinesNextLine,
  unassignedFieldTimeNextLine,
  undatedBillsNextLine,
  vehicleCheckinNextLine,
} from './nextLine'

describe('nextLine · the first row and its verb (punch list #176, change 2)', () => {
  it('Billed Awaiting leans on the customer whose bill has waited longest, not the one who owes most', () => {
    expect(
      billedAwaitingNextLine([
        { customerName: 'Structura, Inc.', total: 103386.4, worstAgeDays: 31 },
        { customerName: 'TF Harper', total: 29323, worstAgeDays: 38 },
      ]),
    ).toBe('Lean on TF Harper · $29,323 · 38 days')
    expect(billedAwaitingNextLine([{ customerName: 'Loberg', total: 5622, worstAgeDays: null }])).toBe('Lean on Loberg · $5,622')
    expect(billedAwaitingNextLine([])).toBeNull()
  })

  it('People Hours approves the oldest day waiting, whatever order the breakdown came in', () => {
    expect(
      peopleHoursNextLine([
        { workDate: '2026-10-23', count: 2, hours: 9 },
        { workDate: '2026-10-22', count: 3, hours: 14.2 },
      ]),
    ).toBe("Approve Thursday's 3 sessions · 14.2 h")
    expect(peopleHoursNextLine([{ workDate: '2026-10-19', count: 1, hours: 4 }])).toBe("Approve Monday's 1 session · 4 h")
    expect(peopleHoursNextLine([])).toBeNull()
  })

  it('Vehicle check-ins asks the holder, or reads a motor-pool truck itself', () => {
    expect(vehicleCheckinNextLine([{ vehicle: { year: 2007, make: 'Dodge', model: 'Ram' }, holderName: 'Trace', motorPool: false, daysStale: 11 }])).toBe(
      "Ask Trace for the 2007 Dodge Ram's miles · 11 days since the last reading",
    )
    expect(vehicleCheckinNextLine([{ vehicle: { year: null, make: 'Ford', model: 'Transit' }, holderName: null, motorPool: true, daysStale: null }])).toBe("Read the Ford Transit's miles · never read")
  })

  it('the Physical inbox decides the oldest paper; Supply Houses pays the house most past 60 days', () => {
    expect(physicalInboxNextLine([{ title: 'Toll bill', ageDays: 23 }])).toBe('Decide “Toll bill” · 23 days in the tray')
    expect(physicalInboxNextLine([{ title: 'Card', ageDays: 0 }])).toBe('Decide “Card” · today in the tray')
    expect(
      supplyHousesNextLine([
        { name: 'Reece', past60_90: 0, past90plus: 0 },
        { name: 'Ferguson', past60_90: 1200, past90plus: 3010 },
        { name: 'Moore', past60_90: 1980, past90plus: 0 },
      ]),
    ).toBe('Pay or dispute Ferguson · $4,210 past 60 days')
    expect(supplyHousesNextLine([{ name: 'Reece', past60_90: 0, past90plus: 0 }])).toBeNull()
  })

  it('Missing job info: a customer first, then an email, then pictures', () => {
    const job = { number: '1044', name: 'H & I Creekside' }
    expect(missingJobInfoNextLine({ noCustomer: [job], noEmail: [job], noPictures: [] })).toBe('Link a customer to 1044 H & I Creekside')
    expect(missingJobInfoNextLine({ noCustomer: [], noEmail: [job], noPictures: [job] })).toBe('Add a billing email to 1044 H & I Creekside')
    expect(missingJobInfoNextLine({ noCustomer: [], noEmail: [], noPictures: [{ number: '', name: 'Cano Camera' }] })).toBe('Add a pictures link to Cano Camera')
    expect(missingJobInfoNextLine({ noCustomer: [], noEmail: [], noPictures: [] })).toBeNull()
  })

  it('Property kinds names the address and the lien clock; Percent complete the number the facts suggest', () => {
    expect(propertyKindsNextLine([{ address: '12 Oak St', customerName: 'Hunter Homes', openBalance: 4000, lienClock: true }])).toBe(
      'Pick residential or commercial for 12 Oak St · Hunter Homes · lien clock running',
    )
    expect(propertyKindsNextLine([{ address: '12 Oak St', customerName: 'Hunter Homes', openBalance: 4000, lienClock: false }])).toBe(
      'Pick residential or commercial for 12 Oak St · Hunter Homes · $4,000 open',
    )
    expect(percentCompleteNextLine([{ label: '879 · Hunter Homes, lot 12', suggestedPct: 40 }])).toBe('Move 879 · Hunter Homes, lot 12 to 40%')
  })

  it('Missing bill dates, Complete no bill (lowest number first) and Unassigned field time (oldest day first)', () => {
    expect(undatedBillsNextLine([{ customerName: 'Loberg', amount: 5622, hcpNumber: '650' }])).toBe("Date Loberg's $5,622 bill on 650")
    expect(completeNoBillNextLine([{ hcp_number: '1060', job_name: 'Cano Camera' }, { hcp_number: '995', job_name: 'Locks' }])).toBe('Set the Total Bill on 995 Locks')
    expect(
      unassignedFieldTimeNextLine([
        { personName: 'Abraham', workDate: '2026-10-23', unallocatedHrs: 4.7 },
        { personName: 'Tristen', workDate: '2026-10-21', unallocatedHrs: 2 },
      ]),
    ).toBe("Put Tristen's 2 h on Wednesday on a job")
  })

  it('Jobs Cleanup links the first sheet, else points at the money cards; Field photos moves the oldest estimate', () => {
    expect(jobsCleanupNextLine([{ contractor: 'Intertec', total: 1850, typedNumber: '1048', address: '' }], 2)).toBe("Link Intertec's $1,850 sheet · 1048 to a job")
    expect(jobsCleanupNextLine([], 2)).toBe('Work the 2 money cards below')
    expect(jobsCleanupNextLine([], 0)).toBeNull()
    expect(fieldPhotosNextLine([{ label: 'CO #78 — Herber Custom Homes', photos: [1, 2, 3] }])).toBe('Move 3 photos for CO #78 — Herber Custom Homes to Drive')
  })

  it('Texts replies first, then calls about a text that never arrived; Email clears the box most past the limit', () => {
    expect(textsNextLine({ needsReply: [{ name: 'Megan Connell', waiting: 'waiting 2 h' }], notDelivered: [] })).toBe('Reply to Megan Connell · waiting 2 h')
    expect(textsNextLine({ needsReply: [], notDelivered: [{ name: 'Tom Coyle' }] })).toBe('Call Tom Coyle · the text never arrived')
    expect(textsNextLine({ needsReply: [], notDelivered: [] })).toBeNull()
    expect(
      emailNextLine(
        [
          { title: 'bids@', open: 4, past: 0 },
          { title: 'work@', open: 2, past: 2 },
        ],
        3,
      ),
    ).toBe('Clear work@ · 2 open · 2 past 3 days')
    expect(emailNextLine([{ title: 'bids@', open: 0, past: 0 }], 3)).toBeNull()
  })

  it('Banking sorts the oldest row; the Dispatch inbox answers the first open request, a customer waiting first', () => {
    expect(
      bankingSortingNextLine([
        { counterparty_name: 'Ferguson', amount: -412.5, posted_at: '2026-10-22T15:00:00Z' },
        { counterparty_name: 'Shell', amount: -80, posted_at: '2026-10-20T15:00:00Z' },
      ]),
    ).toBe('Sort the $80 Shell row from Oct 20')
    const now = Date.parse('2026-10-25T15:00:00Z')
    expect(
      dispatchInboxNextLine(
        [
          { status: 'closed', title: 'Old', created_at: '2026-10-01T15:00:00Z', senderName: 'Robert', priority: 'normal' },
          { status: 'open', title: 'Please call Malachi about his T-Mobile plan', created_at: '2026-10-23T15:00:00Z', senderName: 'Robert', priority: 'normal' },
        ],
        now,
      ),
    ).toBe("Answer Robert's “Please call Malachi about his T-Mobile plan” · waiting 2 days")
    expect(dispatchInboxNextLine([{ status: 'open', title: 'Leak at 12 Oak', created_at: '2026-10-25T14:00:00Z', senderName: null, priority: 'high' }], now)).toBe(
      "Customer waiting: answer someone's “Leak at 12 Oak” · waiting today",
    )
    expect(ageDays('2026-10-23T15:00:00Z', now)).toBe(2)
  })

  it('the boxes tick the first open one; Job follow-ups calls about the stalest quiet job', () => {
    const items = [
      { id: 'a', label: 'Open the window shades' },
      { id: 'b', label: 'Turn on the lights' },
    ]
    expect(boxesNextLine(items, (id) => id === 'b')).toBe('Tick: Turn on the lights')
    expect(boxesNextLine(items, () => false)).toBeNull()
    expect(jobFollowupsNextLine({ hcpNumber: '651', jobName: 'Dudley Mason', quietDays: 160 })).toBe('Call about 651 Dudley Mason · quiet 160 days')
    expect(jobFollowupsNextLine(null)).toBeNull()
  })

  it('Today’s lines names the first of the viewer’s own lines in the card’s words, and nothing when there are none (v2.5868)', () => {
    expect(todaysLinesNextLine([{ title: '84 live jobs have no contract on file' }, { title: '3 checks came back ($20,502)' }])).toBe('84 live jobs have no contract on file')
    expect(todaysLinesNextLine([])).toBeNull()
  })
})
