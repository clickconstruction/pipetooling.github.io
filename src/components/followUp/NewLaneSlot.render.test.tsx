// @vitest-environment jsdom
/**
 * Messages, residential R7 (PR 3): the sort card above a thread over a fake io. *Who is this?*'s guesses in the box's
 * order, the ones that need a record first waiting with where to make it, a lead named in one press and *Someone else*
 * opening the window's own; *Which job?* with the default picked, kept or moved; *Who has it?* with the rule's pick first,
 * handed or taken; and no card for someone who needs no sorting. The people are the customer Messages prototype's
 * made-up ones (v0.8, screen 7); nothing here is a real row.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { FollowUpMessageRow } from '../../lib/followUp/followUpRows'
import type { NewLaneCardIo, NewLaneCardRows } from '../../lib/followUp/newLaneCardIo'
import type { JobTile } from '../../lib/messages/jobTiles'
import { NewLaneSlot } from './NewLaneSlot'

afterEach(cleanup)

const NOW = '2026-10-13T15:00:00Z'
const ROBERT = { id: 'u-robert', name: 'Robert', role: 'estimator' }
const ROSA = { id: 'u-rosa', name: 'Rosa', role: 'assistant' }

const person = (id: string, kind: Contact['kind'], name: string, patch: Partial<Contact> = {}): Contact => ({
  id,
  kind,
  name,
  goesBy: null,
  company: '',
  record: null,
  channels: [],
  jobIds: [],
  defaultJobId: null,
  ...patch,
})

const line = (id: string, contactId: string, direction: string, patch: Partial<FollowUpMessageRow> = {}): FollowUpMessageRow => ({
  id,
  contact_id: contactId,
  channel_id: null,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel: 'text',
  direction,
  who_user_id: null,
  who_text: '',
  at: '2026-10-13T13:41:00Z',
  subject: null,
  body: '',
  optout_line: null,
  back_on: null,
  back_by: null,
  back_words: null,
  back_done_at: null,
  ...patch,
})

const tile = (key: string, num: string, name: string): JobTile => ({ key, kind: 'pipeline', num, name, day: { words: 'working', tone: '' } })

const KEVIN = person('kevin', 'unknown', '(210) 555-0188')
const DANA = person('dana', 'customer', 'Dana Whitfield', { jobIds: ['pipeline:j1312', 'pipeline:j1298'], defaultJobId: 'pipeline:j1312' })
const GREG = person('greg', 'trade', 'Greg Paulk', { company: 'Hillside Excavation' })

const ROWS: Record<string, NewLaneCardRows> = {
  kevin: {
    contact: { state: 'waiting', snoozed_until: null, has_user_id: null },
    lines: [line('m-kevin', 'kevin', 'in', { body: 'Hi this is Kevin Alvarez, can someone come look at my water heater?', mailbox: 'team' })],
    tiles: {},
    active: new Set(),
    seats: { customer: 'u-rosa', trade: 'u-robert', arch: null },
    team: [ROBERT, ROSA],
  },
  dana: {
    contact: { state: 'waiting', snoozed_until: null, has_user_id: 'u-rosa' },
    lines: [line('m-dana', 'dana', 'in', { at: '2026-10-12T21:05:00Z', jobs_ledger_id: 'j1312', body: 'Can you do Thursday?', mailbox: 'team' })],
    tiles: { 'pipeline:j1312': tile('pipeline:j1312', 'J1312', 'Oakridge sewer line'), 'pipeline:j1298': tile('pipeline:j1298', 'J1298', 'Water heater') },
    active: new Set(['pipeline:j1312', 'pipeline:j1298']),
    seats: { customer: 'u-rosa', trade: 'u-robert', arch: null },
    team: [ROBERT, ROSA],
  },
  greg: {
    contact: { state: 'waiting', snoozed_until: null, has_user_id: null },
    lines: [line('m-greg', 'greg', 'in', { at: '2026-10-13T12:55:00Z', channel: 'email', subject: 'Pad on Monday', body: 'Who do we check in with on site?', mailbox: 'bids' })],
    tiles: {},
    active: new Set(),
    seats: { customer: 'u-rosa', trade: 'u-robert', arch: null },
    team: [ROBERT, ROSA],
  },
}

function fakeIo(over: Partial<NewLaneCardIo> = {}, rows: Record<string, NewLaneCardRows> = ROWS): NewLaneCardIo {
  return {
    loadCard: vi.fn(async (contactId: string) => rows[contactId]!),
    loadKnown: vi.fn(async () => ({ customers: [{ id: 'alvarez', name: 'Alvarez Family Dental' }] })),
    name: vi.fn(async (contactId: string) => contactId),
    tie: vi.fn(async () => undefined),
    takeIt: vi.fn(async () => undefined),
    handTo: vi.fn(async () => undefined),
    ...over,
  }
}

function renderSlot(contact: Contact, io: NewLaneCardIo = fakeIo()) {
  const acts = { openWho: vi.fn(), showContact: vi.fn() }
  const say = vi.fn()
  const reread = vi.fn()
  render(<NewLaneSlot contact={contact} acts={acts} io={io} say={say} reread={reread} me={{ id: 'u-robert', name: 'Robert' }} nowIso={NOW} />)
  return { acts, say, reread, io }
}

const card = (head: string) => within(screen.getByRole('region', { name: `Sort: ${head}` }))

describe('the sort card above the thread', () => {
  it('Who is this?: the team line’s guesses, the ones that need a record waiting with where to make it', async () => {
    const { io, say, reread, acts } = renderSlot(KEVIN, fakeIo({ name: vi.fn(async () => 'kevin-lead') }))
    expect(await screen.findByText('Kevin Alvarez at Alvarez Family Dental')).toBeTruthy()
    const who = card('Who is this?')
    expect(who.getByText('A number nobody has named came in on the team number. Someone asking for work is a lead until they book.')).toBeTruthy()
    const newCustomer = who.getByRole('button', { name: /Kevin Alvarez, a new customer/ }) as HTMLButtonElement
    expect(newCustomer.disabled).toBe(true)
    expect(within(newCustomer).getByText('Add them on Customers first. Then name the number here.')).toBeTruthy()
    expect((who.getByRole('button', { name: /A candidate, to the hiring board/ }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(who.getByRole('button', { name: /Kevin Alvarez, a new lead on Prospects/ }))
    await waitFor(() => expect(say).toHaveBeenCalledWith('Kevin Alvarez is a lead now. The thread stays with them.', 'success'))
    expect(io.name).toHaveBeenCalledWith('kevin', expect.objectContaining({ kind: 'lead', name: 'Kevin Alvarez', record: null }))
    expect(reread).toHaveBeenCalled()
    // The fold kept the thread on another contact: the window moves there.
    expect(acts.showContact).toHaveBeenCalledWith('kevin-lead')
    await waitFor(() => expect(io.loadCard).toHaveBeenCalledTimes(2))

    fireEvent.click(who.getByRole('button', { name: /Someone else/ }))
    expect(acts.openWho).toHaveBeenCalled()
  })

  it('Which job?: the default picked and kept, or another picked and moved to', async () => {
    const { io, say } = renderSlot(DANA)
    const job = within(await screen.findByRole('region', { name: 'Sort: Which job?' }))
    expect(job.getByText('Dana has two active jobs. The default job took this line, so check it is the right one.')).toBeTruthy()
    expect((screen.getByRole('radio', { name: /J1312/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(job.getByRole('button', { name: 'Keep it on J1312' }))
    await waitFor(() => expect(io.tie).toHaveBeenCalledWith('m-dana', 'pipeline:j1312'))
    await waitFor(() => expect(say).toHaveBeenCalledWith('The line stays on J1312.', 'success'))

    fireEvent.click(screen.getByRole('radio', { name: /J1298 Water heater/ }))
    fireEvent.click(job.getByRole('button', { name: 'Move it to J1298' }))
    await waitFor(() => expect(io.tie).toHaveBeenLastCalledWith('m-dana', 'pipeline:j1298'))
    await waitFor(() => expect(say).toHaveBeenLastCalledWith('The line is on J1298 now.', 'success'))
  })

  it('Who has it?: the rule’s pick first, then the office; handing it on, or taking it', async () => {
    const { io, say } = renderSlot(GREG)
    const has = await screen.findByRole('region', { name: 'Sort: Who has it?' })
    const people = within(has).getAllByRole('button').map((b) => b.textContent)
    expect(people).toEqual(['RobertRobert gets new trade partner messages. The rule picks them.', 'Rosathe office'])
    fireEvent.click(within(has).getByRole('button', { name: /^Rosa/ }))
    await waitFor(() => expect(io.handTo).toHaveBeenCalledWith('greg', 'u-rosa'))
    expect(say).toHaveBeenCalledWith('Rosa has Greg Paulk.', 'success')
    fireEvent.click(within(has).getByRole('button', { name: /^Robert/ }))
    await waitFor(() => expect(io.takeIt).toHaveBeenCalledWith('greg'))
    expect(say).toHaveBeenLastCalledWith('You have Greg Paulk.', 'success')
  })

  it('draws nothing for someone who needs no sorting, and keeps a refused press’s own words', async () => {
    const done = { ...ROWS, greg: { ...ROWS.greg!, contact: { state: 'done', snoozed_until: null, has_user_id: null } } }
    const quiet = fakeIo({}, done)
    renderSlot(GREG, quiet)
    await waitFor(() => expect(quiet.loadCard).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: /^Sort/ })).toBeNull()
    cleanup()

    const { say } = renderSlot(GREG, fakeIo({ handTo: vi.fn(async () => Promise.reject(new Error('Only the office hands a conversation on.'))) }))
    const has = await screen.findByRole('region', { name: 'Sort: Who has it?' })
    fireEvent.click(within(has).getByRole('button', { name: /^Rosa/ }))
    await waitFor(() => expect(say).toHaveBeenCalledWith(expect.stringContaining('Only the office hands a conversation on.'), 'error'))
  })
})

describe('One of our own team (v2.5546)', () => {
  it('opens the roster in the card, filters it by name, and a pick names the number as that person', async () => {
    const io = fakeIo({
      loadKnown: vi.fn(async () => ({
        customers: [],
        roster: [
          { id: 'p-will', name: 'Will Park', kind: 'helper', phone: '(737) 555-0102' },
          { id: 'p-marcus', name: 'Marcus Bell', kind: 'master_technician', phone: null },
        ],
      })),
      name: vi.fn(async () => 'kevin'),
    })
    const { say, acts } = renderSlot(KEVIN, io)
    const team = (await screen.findByRole('button', { name: /One of our own team/ })) as HTMLButtonElement
    const who = card('Who is this?')
    expect(team.disabled).toBe(false)
    expect(within(team).getByText('Pick them from the roster. The number goes on their People record, and the app can text them from now on.')).toBeTruthy()
    fireEvent.click(team)

    const ours = card('Which of ours?')
    expect(ours.getByText('The number goes on their People record. Next time the app knows them without asking.')).toBeTruthy()
    expect(within(ours.getByRole('group', { name: 'Our team' })).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Marcus BellMaster technician · no number on file',
      'Will ParkHelper · a number on file',
    ])
    fireEvent.change(ours.getByLabelText('Find a name'), { target: { value: 'marc' } })
    expect(within(ours.getByRole('group', { name: 'Our team' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Marcus BellMaster technician · no number on file'])
    fireEvent.change(ours.getByLabelText('Find a name'), { target: { value: 'zed' } })
    expect(ours.getByText('Nobody on the roster goes by that.')).toBeTruthy()
    fireEvent.change(ours.getByLabelText('Find a name'), { target: { value: '' } })

    fireEvent.click(ours.getByRole('button', { name: /Marcus Bell/ }))
    await waitFor(() => expect(say).toHaveBeenCalledWith('Marcus Bell is one of our own team now. The thread stays with them.', 'success'))
    expect(io.name).toHaveBeenCalledWith('kevin', expect.objectContaining({ kind: 'team', record: { table: 'people', id: 'p-marcus' }, name: 'Marcus Bell' }))
    expect(acts.openWho).not.toHaveBeenCalled()
  })

  it('Back leaves the roster and shows the guesses again', async () => {
    renderSlot(KEVIN, fakeIo({ loadKnown: vi.fn(async () => ({ customers: [], roster: [{ id: 'p-will', name: 'Will Park', kind: 'helper', phone: null }] })) }))
    fireEvent.click(await screen.findByRole('button', { name: /One of our own team/ }))
    fireEvent.click(card('Which of ours?').getByRole('button', { name: 'Back' }))
    expect(card('Who is this?').getByRole('button', { name: /a new lead on Prospects/i })).toBeTruthy()
  })
})
