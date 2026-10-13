/**
 * The New lane's screens' kernels (residential R7, PR 3), over the customer Messages prototype's made-up people (v0.8,
 * screen 7, mockup A): Kevin Alvarez's text to the team number, Dana Whitfield on two jobs, Greg Paulk with nobody on
 * him, Robert and Rosa in the office. Tue Oct 13 2026, 10:00 AM in Chicago. Nothing here is a real row.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { JobTile } from '../messages/jobTiles'
import { whoGuesses } from './newLane'
import {
  activeJobKeys,
  guessWait,
  hasPeople,
  hasTargets,
  laneFacts,
  laneJobs,
  laneRowFor,
  namedWords,
  rulePick,
  tiedWords,
  type LaneLineRow,
} from './newLaneRows'
import type { Teammate } from './team'

const NOW = '2026-10-13T15:00:00Z'
const TODAY = '2026-10-13'
const ROBERT: Teammate = { id: 'u-robert', name: 'Robert', role: 'estimator' }
const ROSA: Teammate = { id: 'u-rosa', name: 'Rosa', role: 'assistant' }
const TEAM = [ROBERT, ROSA]
const SEATS = { customer: 'u-rosa', trade: 'u-robert', arch: null }

const line = (id: string, contactId: string, direction: string, at: string, patch: Partial<LaneLineRow> = {}): LaneLineRow => ({
  id,
  contact_id: contactId,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel: 'text',
  direction,
  at,
  subject: null,
  body: 'Can you do Thursday? Also is the water heater quote still good?',
  ...patch,
})

const WAITING = { state: 'waiting', snoozed_until: null, has_user_id: null }

describe('which jobs are still under way', () => {
  it('reads a bid, a GC project and a Pipeline job by their own facts', () => {
    const active = activeJobKeys({
      bids: [
        { id: 'b-open', outcome: null },
        { id: 'b-won', outcome: 'Won' },
        { id: 'b-lost', outcome: 'lost' },
      ],
      projects: [
        { project_id: 'p-building', stage: 'building', lost_on: null },
        { project_id: 'p-closed', stage: 'closed', lost_on: null },
        { project_id: 'p-lost', stage: 'bidding', lost_on: '2026-10-01' },
      ],
      pipeline: [
        { id: 'j1312', status: 'working' },
        { id: 'j1298', status: null },
        { id: 'j1290', status: 'paid' },
        { id: 'j1288', status: 'ready_to_bill' },
      ],
    })
    expect([...active].sort()).toEqual(['bid:b-open', 'pipeline:j1288', 'pipeline:j1298', 'pipeline:j1312', 'project:p-building'])
  })
})

describe('a line’s box and its tie', () => {
  it('reads the box and whether a person tied it, and nothing it does not know', () => {
    expect(laneFacts({ mailbox: 'bids', tied_by: 'u-rosa' })).toEqual({ mailbox: 'bids', tiedByHand: true })
    expect(laneFacts({ mailbox: 'office', tied_by: null })).toEqual({ mailbox: null, tiedByHand: false })
    expect(laneFacts({})).toEqual({ mailbox: null, tiedByHand: false })
  })
})

describe('the jobs on Which job?', () => {
  it('takes each tile’s number and name, and whether it is under way', () => {
    const tiles: Record<string, JobTile> = {
      'pipeline:j1312': { key: 'pipeline:j1312', kind: 'pipeline', num: 'J1312', name: 'Oakridge sewer line', day: { words: 'working', tone: '' } },
      'pipeline:j1298': { key: 'pipeline:j1298', kind: 'pipeline', num: 'J1298', name: 'Water heater', day: { words: 'waiting', tone: '' } },
    }
    expect(laneJobs(['pipeline:j1312', 'pipeline:j1298', 'pipeline:gone'], tiles, new Set(['pipeline:j1312']))).toEqual([
      { id: 'pipeline:j1312', number: 'J1312', name: 'Oakridge sewer line', active: true },
      { id: 'pipeline:j1298', number: 'J1298', name: 'Water heater', active: false },
    ])
  })
})

describe('the rule’s pick on Who has it?', () => {
  it('picks whoever answered them last, else the seat for their kind', () => {
    expect(rulePick({ kind: 'trade', answeredLastBy: 'u-rosa', team: TEAM, seats: SEATS })).toEqual({ userId: 'u-rosa', name: 'Rosa', why: 'Rosa answered them last.' })
    expect(rulePick({ kind: 'trade', answeredLastBy: null, team: TEAM, seats: SEATS })).toEqual({ userId: 'u-robert', name: 'Robert', why: 'Robert gets new trade partner messages.' })
    expect(rulePick({ kind: 'customer', answeredLastBy: null, team: TEAM, seats: SEATS })?.why).toBe('Rosa gets new customer messages.')
    // An architect shares the trade seat until their own is set.
    expect(rulePick({ kind: 'arch', answeredLastBy: null, team: TEAM, seats: SEATS })?.name).toBe('Robert')
  })

  it('picks nobody for a kind no seat holds, an empty seat, or someone no longer on the team', () => {
    expect(rulePick({ kind: 'lead', answeredLastBy: null, team: TEAM, seats: SEATS })).toBeNull()
    expect(rulePick({ kind: 'customer', answeredLastBy: null, team: TEAM, seats: { customer: null, trade: null } })).toBeNull()
    expect(rulePick({ kind: 'trade', answeredLastBy: 'u-gone', team: TEAM, seats: { customer: null, trade: 'u-gone' } })).toBeNull()
  })

  it('offers the rule’s pick first, then the office, each with who they are', () => {
    expect(hasPeople(TEAM)).toEqual([
      { name: 'Robert', words: 'an estimator', office: true },
      { name: 'Rosa', words: 'the office', office: true },
    ])
    const pick = rulePick({ kind: 'trade', answeredLastBy: 'u-rosa', team: TEAM, seats: SEATS })
    expect(hasTargets({ contactId: 'greg' }, TEAM, pick)).toEqual([
      { name: 'Rosa', words: 'Rosa answered them last. The rule picks them.', rulePick: true, userId: 'u-rosa' },
      { name: 'Robert', words: 'an estimator', rulePick: false, userId: 'u-robert' },
    ])
    expect(hasTargets({ contactId: 'greg' }, TEAM, null).map((t) => t.userId)).toEqual(['u-robert', 'u-rosa'])
  })
})

describe('a guess that needs its record first', () => {
  const kevin = { who: '(210) 555-0188', body: 'Hi this is Kevin Alvarez, can someone come look at my water heater?' }
  const bexar = { who: 'estimating@bexarsteel.example', body: 'Attached is our number for the shell.' }

  it('waits with the place to make it, and the ones a press can name do not', () => {
    const team = whoGuesses(kevin, 'team', { customers: [{ id: 'alvarez', name: 'Alvarez Family Dental' }] })
    expect(team.map((g) => [g.label, guessWait(g)])).toEqual([
      ['Kevin Alvarez at Alvarez Family Dental', null],
      ['Kevin Alvarez, a new lead on Prospects', null],
      ['Kevin Alvarez, a new customer', 'Add them on Customers first. Then name the number here.'],
      ['A candidate, to the hiring board', 'Add them on Prospects under Team first. Then name the number here.'],
      ['Someone else', null],
    ])
    const bids = whoGuesses(bexar, 'bids', { trades: [{ id: 'bexar', company: 'Bexar Steel Erectors', contactName: 'Tom Riddle', emails: ['tom@bexarsteel.example'], openAsk: null }] })
    expect(bids.map((g) => guessWait(g))).toEqual([
      null,
      null,
      'Add the company under Trade partners in GC mode first. Then name the number here.',
      'Add the supply house on Materials first. Then name the number here.',
      'Add them on Prospects under Team first. Then name the number here.',
      null,
    ])
  })

  it('says what a press did in plain words', () => {
    const [atDental, lead] = whoGuesses(kevin, 'team', { customers: [{ id: 'alvarez', name: 'Alvarez Family Dental' }] })
    const said = [
      namedWords(lead!),
      namedWords({ kind: 'lead', label: 'A new lead on Prospects', name: null }),
      namedWords(atDental!),
      tiedWords({ number: 'J1298' }, true),
      tiedWords({ number: 'J1312' }, false),
      ...['customer', 'trade', 'supply_house', 'candidate'].map((kind) => guessWait({ kind: kind as never, record: null }) ?? ''),
    ]
    expect(said.slice(0, 5)).toEqual([
      'Kevin Alvarez is a lead now. The thread stays with them.',
      'They are a lead now. The thread stays with them.',
      'The number is Kevin Alvarez at Alvarez Family Dental now. The thread stays with them.',
      'The line is on J1298 now.',
      'The line stays on J1312.',
    ])
    expect(said.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})

describe('the open person’s lane row', () => {
  const dana = { id: 'dana', kind: 'customer' as const, name: 'Dana Whitfield', company: '', jobIds: ['pipeline:j1312', 'pipeline:j1298'], defaultJobId: 'pipeline:j1312', goesBy: null }
  const active = new Set(['pipeline:j1312', 'pipeline:j1298'])
  const onDefault = line('m-dana', 'dana', 'in', '2026-10-12T21:05:00Z', { jobs_ledger_id: 'j1312', mailbox: 'team' })

  it('asks which job when the default took a line from someone on two jobs', () => {
    const row = laneRowFor(dana, { conversation: { ...WAITING, has_user_id: 'u-rosa' }, lines: [onDefault], active }, TODAY, NOW)
    expect(row).toMatchObject({ contactId: 'dana', sort: 'job', head: 'Which job?', messageId: 'm-dana', via: 'Text on the team number', jobIds: ['pipeline:j1312', 'pipeline:j1298'] })
  })

  it('leaves the lane once a person tied the line, or nobody waits on us', () => {
    expect(laneRowFor(dana, { conversation: { ...WAITING, has_user_id: 'u-rosa' }, lines: [{ ...onDefault, tied_by: 'u-rosa' }], active }, TODAY, NOW)).toBeNull()
    expect(laneRowFor(dana, { conversation: { ...WAITING, state: 'done' }, lines: [onDefault], active }, TODAY, NOW)).toBeNull()
    expect(laneRowFor(dana, { conversation: { state: 'snoozed', snoozed_until: '2026-10-19', has_user_id: null }, lines: [onDefault], active }, TODAY, NOW)).toBeNull()
    expect(laneRowFor(dana, { conversation: null, lines: [onDefault], active }, TODAY, NOW)).toBeNull()
  })

  it('asks who has it when nobody is on a conversation, and leaves a customer’s page write to Needs you', () => {
    const greg = { id: 'greg', kind: 'trade' as const, name: 'Greg Paulk', company: 'Hillside Excavation', jobIds: [], defaultJobId: null }
    const asked = line('m-greg', 'greg', 'in', '2026-10-13T12:55:00Z', { channel: 'email', subject: 'Pad on Monday', body: 'Who do we check in with on site?', mailbox: 'bids' })
    expect(laneRowFor(greg, { conversation: WAITING, lines: [asked], active: new Set() }, TODAY, NOW)).toMatchObject({ sort: 'has', via: 'Email to bids@' })
    const page = line('m-dana-page', 'dana', 'in', '2026-10-13T13:00:00Z', { channel: 'portal' })
    expect(laneRowFor({ ...dana, jobIds: [] }, { conversation: WAITING, lines: [page], active }, TODAY, NOW)).toBeNull()
  })
})
