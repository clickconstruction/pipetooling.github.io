// The customer's page block, as customer-portal lays it on a GC job (supabase/functions/_shared/gcPortalPage.ts):
// our contract's sum before the changes, the changes and pay applications, this week's line with the photos link only
// while the photos switch is on, the people, the schedule's moves since it went, by reason, and nothing of ours.
import { describe, expect, it } from 'vitest'
import { gcPortalPage, type GcPortalPageRows } from '../../../supabase/functions/_shared/gcPortalPage'

const rows = (over: Partial<GcPortalPageRows> = {}): GcPortalPageRows => ({
  terms: [
    {
      project_id: 'p1',
      owner_pay_days: 30,
      owner_contract_signed_on: null,
      architect_customer_id: 'arch',
      project_manager_user_id: 'u-pm',
      superintendent_user_id: 'u-super',
      portal_photos_on: false,
      portal_forecast_on: false,
      portal_spanish_on: false,
    },
  ],
  contractNow: { p1: 418300 },
  contractSends: [
    { project_id: 'p1', signed_on: null, created_at: '2026-09-01T15:00:00Z' },
    { project_id: 'p1', signed_on: '2026-09-19', created_at: '2026-09-15T15:00:00Z' },
  ],
  changeOrders: [
    { id: 'co-2', project_id: 'p1', number: 2, description: ' A sink in exam 3 ', description_es: null, price: '2150', days: 0, status: 'sent', answered_on: null },
    { id: 'co-1', project_id: 'p1', number: 1, description: 'Exam 2 cabinets', description_es: 'Gabinetes del consultorio 2', price: 6300, days: 0, status: 'signed', answered_on: '2026-09-28' },
    { id: 'co-x', project_id: 'p2', number: 1, description: 'Another job', description_es: null, price: 99, days: 0, status: 'signed', answered_on: '2026-09-01' },
  ],
  payApps: [
    { id: 'pa-1', project_id: 'p1', number: 1, final: false, period_to: '2026-09-30', sent_on: '2026-10-01', due: '63000', certified_on: '2026-10-06', invoice_id: 'inv-1', customer_line: 'Slab and plumbing ', customer_line_es: null },
  ],
  architects: [{ id: 'arch', name: 'Marsh & Vale Architects' }],
  users: [
    { id: 'u-pm', name: 'Robert', phone: null },
    { id: 'u-super', name: 'Wendi', phone: '(210) 555-0190' },
  ],
  logs: [
    { project_id: 'p1', log_date: '2026-09-25', customer_line: 'Older line.', customer_line_es: null, photos_url: 'https://photos/old' },
    { project_id: 'p1', log_date: '2026-10-02', customer_line: 'The slab is poured.', customer_line_es: 'La losa está vaciada.', photos_url: 'https://photos/new' },
  ],
  scheduleSends: [{ project_id: 'p1', sent_on: '2026-09-20' }],
  moves: [
    { project_id: 'p1', activity_name: 'Parking lot pour', made_on: '2026-10-01', from_start: '2026-10-05', to_start: '2026-10-12', reason: 'weather', undone_on: null },
    { project_id: 'p1', activity_name: 'Before the letter', made_on: '2026-09-10', from_start: '2026-09-12', to_start: '2026-09-15', reason: 'crew', undone_on: null },
    { project_id: 'p1', activity_name: 'Undone move', made_on: '2026-10-01', from_start: '2026-10-05', to_start: '2026-10-06', reason: 'us', undone_on: '2026-10-02' },
  ],
  ...over,
})

describe("the customer's page block for one job", () => {
  it('reads the money, the people, this week and the moves', () => {
    expect(gcPortalPage(rows(), 'p1')).toEqual({
      contract: 412000,
      contractSignedOn: '2026-09-19',
      architect: 'Marsh & Vale Architects',
      payDays: 30,
      changes: [
        { id: 'co-1', number: 1, description: 'Exam 2 cabinets', descriptionEs: 'Gabinetes del consultorio 2', price: 6300, days: 0, state: 'signed', signedOn: '2026-09-28' },
        { id: 'co-2', number: 2, description: 'A sink in exam 3', descriptionEs: null, price: 2150, days: 0, state: 'open', signedOn: null },
      ],
      payApps: [
        { id: 'pa-1', number: 1, final: false, periodTo: '2026-09-30', sentOn: '2026-10-01', due: 63000, certifiedOn: '2026-10-06', invoiceId: 'inv-1', customerLine: 'Slab and plumbing', customerLineEs: null },
      ],
      week: { on: '2026-10-02', line: 'The slab is poured.', lineEs: 'La losa está vaciada.', photosUrl: null },
      people: [
        { role: 'pm', name: 'Robert', phone: null },
        { role: 'super', name: 'Wendi', phone: '(210) 555-0190' },
      ],
      moves: [{ activity: 'Parking lot pour', madeOn: '2026-10-01', from: '2026-10-05', to: '2026-10-12', reason: 'weather' }],
      switches: { photos: false, forecast: false, spanish: false },
    })
  })

  it('shows the photos link only while the photos switch is on', () => {
    const on = rows({ terms: rows().terms.map((t) => ({ ...t, portal_photos_on: true })) })
    expect(gcPortalPage(on, 'p1')?.week?.photosUrl).toBe('https://photos/new')
    expect(gcPortalPage(on, 'p1')?.switches).toEqual({ photos: true, forecast: false, spanish: false })
  })

  it('lists no moves before the schedule went, and reads the office mark when no send is signed', () => {
    const page = gcPortalPage(rows({ scheduleSends: [], contractSends: [], terms: rows().terms.map((t) => ({ ...t, owner_contract_signed_on: '2026-09-21' })) }), 'p1')
    expect(page?.moves).toEqual([])
    expect(page?.contractSignedOn).toBe('2026-09-21')
  })

  it('reads nothing for a job whose terms it did not read', () => {
    expect(gcPortalPage(rows(), 'p9')).toBeNull()
  })
})
