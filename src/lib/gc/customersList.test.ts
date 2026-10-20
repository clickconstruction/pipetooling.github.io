import { describe, expect, it } from 'vitest'
import { contextFor, CUSTOMER_FLOW, CUSTOMERS } from '../flows/boardFixtures'
import { plainWordsFailures } from '../plainWords'
import { ALL_QUIET, NO_CUSTOMERS, OPEN_THE_CARD, READING, SECTION_TONE, SECTION_WORDS, customerCards, headChip, listSummary, type CustomersListInput } from './customersList'
import type { GcCustomer, GcProject } from './types'

const ctx = contextFor(CUSTOMER_FLOW)
const refs = Object.fromEntries(CUSTOMERS.map((c) => [c.contactId, { customerId: `cu-${c.contactId}` }]))
const flow: NonNullable<CustomersListInput['flow']> = { ctx, companies: CUSTOMERS, readings: {}, refs }

const customer = (contactId: string, over: Partial<GcCustomer> = {}): GcCustomer => {
  const c = CUSTOMERS.find((x) => x.contactId === contactId)!
  return { id: `cu-${contactId}`, name: c.name, contact: c.personName ?? '', phone: '(210) 555-0100', email: `${contactId}@example.com`, address: '100 Test St, San Antonio', payDays: null, retainagePct: null, portalOn: true, contacts: [], past: [], ...over }
}
const project = (id: string, customerId: string, over: Partial<GcProject> = {}): GcProject =>
  ({ id, name: ctx.jobs[id]?.name ?? id, customerId, stage: 'building', closedOn: null, lostOn: null, ...over }) as unknown as GcProject

/** Every fixture customer with one project per job, so each card has the jobs its places name. Castle Hills has no job and so no card. */
const customers = CUSTOMERS.map((c) => customer(c.contactId))
const projects = CUSTOMERS.flatMap((c) => c.jobIds.map((jobId) => project(jobId, `cu-${c.contactId}`, { stage: c.contactId === 'g9' ? 'pursuing' : 'building' })))

describe('the Customers list', () => {
  it('v2.5557 · makes a card per customer on a GC project, the watches first and the ones off the flow last', () => {
    const cards = customerCards({ customers, projects, flow, pageOpens: {} })
    expect(cards.map((c) => [c.name, c.worst])).toEqual([
      ['Leon Valley Bakery', 'over'],
      ['Cibolo Creek Partners', 'wait'],
      ['Helotes Dental Office', ''],
      ['Oak Hills Veterinary', ''],
      ['Bell Family Dental', ''],
    ])
    expect(cards[4]?.off).toMatchObject({ since: '2026-09-29', why: 'Declined our bid, went with another plumber.' })
    expect(cards.map((c) => c.name)).not.toContain('Castle Hills HOA')
  })

  it('reads each job’s stage from the Project Board’s section, the step it is on with its day, and the step’s own press', () => {
    const cards = customerCards({ customers, projects, flow, pageOpens: {} })
    const rows = (name: string) => cards.find((c) => c.name === name)!.jobs.map((j) => [j.name, j.stageWords, j.standing, j.small, j.tone, j.press?.label ?? null])
    expect(rows('Leon Valley Bakery')).toEqual([['Leon Valley Bakery', 'Bidding to the customer', 'Said yes', '8 d · over usual', 'over', 'Remind Leon Valley Bakery']])
    // Priya's job is on two steps at once, Start date and Change orders: the row stands on the furthest along, with its press.
    expect(rows('Helotes Dental Office')).toEqual([['Helotes Dental Office', 'Building', 'Change orders', '2 d', '', 'Remind Priya']])
    expect(rows('Oak Hills Veterinary')).toEqual([['Oak Hills Veterinary', 'Building', 'Our bid', 'our move · 4 d', '', null]])
    // A job on a step comes before the jobs not started, however they sort by name.
    expect(rows('Cibolo Creek Partners').map((r) => [r[0], r[2]])).toEqual([
      ['Stone Oak Pharmacy', 'Pay application'],
      ['Boerne Retail Pad B', 'not started'],
      ['Boerne Retail Shell', 'not started'],
      ['Fair Oaks Shops, Building D', 'not started'],
    ])
    expect(rows('Cibolo Creek Partners')[0]).toEqual(['Stone Oak Pharmacy', 'Building', 'Pay application', 'waiting on Jonah', 'wait', null])
    expect(SECTION_WORDS).toEqual({ pursuing: 'Bidding to the customer', buyout: 'Buying out', building: 'Building', closed: 'Closed', lost: 'Lost' })
    expect([SECTION_TONE.pursuing, SECTION_TONE.buyout, SECTION_TONE.building, SECTION_TONE.closed, SECTION_TONE.lost]).toEqual(['amber', 'blue', 'green', 'grey', 'red'])
    const lost = customerCards({ customers, projects: projects.map((p) => (p.id === 'helotes' ? { ...p, lostOn: '2026-10-01' } : p)), flow, pageOpens: {} })
    expect(lost.find((c) => c.name === 'Helotes Dental Office')?.jobs[0]?.stageWords).toBe('Lost')
  })

  it('leaves out a customer with no GC project, and reads a job with no place on the flow as not started', () => {
    const extra = [...customers, customer('g9', { id: 'cu-nobody', name: 'Nobody Yet LLC' })]
    const cards = customerCards({ customers: extra, projects: [...projects, project('x1', 'cu-priya', { name: 'A second job' })], flow, pageOpens: {} })
    expect(cards.map((c) => c.name)).not.toContain('Nobody Yet LLC')
    const priya = cards.find((c) => c.name === 'Helotes Dental Office')!
    expect(priya.jobs.map((j) => [j.name, j.standing, j.press?.label ?? null])).toEqual([
      ['Helotes Dental Office', 'Change orders', 'Remind Priya'],
      ['A second job', 'not started', null],
    ])
  })

  it('reads the master agreement from the Once lane and the portal from their last open, and waits for the flow in words', () => {
    const cards = customerCards({ customers, projects, flow, pageOpens: { 'cu-priya': new Date().toISOString() } })
    expect(cards.find((c) => c.name === 'Cibolo Creek Partners')?.agreement).toEqual({ words: 'signed', tone: 'done', small: '' })
    expect(cards.find((c) => c.name === 'Helotes Dental Office')?.agreement.words).toBe('not yet')
    expect(cards.find((c) => c.name === 'Helotes Dental Office')?.portal).toBe('today')
    expect(cards.find((c) => c.name === 'Leon Valley Bakery')?.portal).toBe('never')
    const unread = customerCards({ customers, projects, flow: null, pageOpens: null })
    expect(unread.map((c) => c.name)).toEqual(['Bell Family Dental', 'Cibolo Creek Partners', 'Helotes Dental Office', 'Leon Valley Bakery', 'Oak Hills Veterinary'])
    expect(unread[0]).toMatchObject({ portal: '—', agreement: { words: '' }, jobs: [expect.objectContaining({ standing: '', press: null })] })
  })

  it('names how each card stands in one chip, and sums the list in one line', () => {
    const cards = customerCards({ customers, projects, flow, pageOpens: {} })
    expect(cards.map((c) => headChip(c))).toEqual([
      { words: 'over usual', tone: 'amber' },
      { words: '1 waiting on someone else', tone: 'blue' },
      { words: ALL_QUIET, tone: 'grey' },
      { words: ALL_QUIET, tone: 'grey' },
      { words: 'off the flow since Sep 29', tone: 'grey' },
    ])
    expect(listSummary(cards)).toBe('4 customers on GC projects · 1 over usual · 1 waiting on someone else · 1 off the flow')
    const first = cards[0]!
    const late = { ...first, late: 1, worst: 'late' as const, jobs: [{ ...first.jobs[0]!, tone: 'late' as const, small: 'late 3 days' }] }
    expect(headChip(late)).toEqual({ words: 'late 3 days', tone: 'red' })
    expect(headChip({ ...late, late: 2 })).toEqual({ words: '2 late', tone: 'red' })
    expect(headChip({ ...first, worst: 'lapsed', lapsed: true })).toEqual({ words: 'lapsed', tone: 'amber' })
    expect(listSummary([late, ...cards.slice(1)])).toBe('4 customers on GC projects · 1 late · 1 waiting on someone else · 1 off the flow')
    for (const s of [NO_CUSTOMERS, READING, OPEN_THE_CARD]) expect(plainWordsFailures(s)).toEqual([])
  })
})
