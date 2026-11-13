import { describe, expect, it } from 'vitest'
import { buildJobHoverCard, HOVER_CARD_GAP, HOVER_CARD_MARGIN, jobCrewNames, jobHoverCardLookup, NO_NAME_WORDS, placeHoverCard, placeHoverCardUnder, type JobHoverCardInputs } from './jobHoverCard'
import type { MemberBid, MemberJob } from './overview'

const STAGES: Record<string, string> = { waiting: 'Waiting', working: 'Working', ready_to_bill: 'Ready to Bill', billed: 'Billed Awaiting Payment', paid: 'Paid' }

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return { bid_number: over.id.replace(/^b/, ''), project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null, development_id: 'harlow', outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null, bid_date_sent: null, bid_due_date: null, estimated_job_start_date: null, plans_link: null, design_drawing_plan_date: null, gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null, created_at: null, updated_at: null, working_board_archived_at: null, service_type_id: null, last_contact: null, ...over }
}
function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return { hcp_number: over.id.replace(/^j/, ''), click_number: null, job_name: null, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'harlow', bid_id: null, status: null, revenue: null, payments_made: null, last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, service_type_id: null, ...over }
}
function inputs(over: Partial<JobHoverCardInputs> = {}): JobHoverCardInputs {
  return {
    names: new Map([['u-dana', 'Dana'], ['u-mel', 'Mel'], ['u-luis', 'Luis']]),
    teamMembers: [],
    bids: [],
    jobLabel: (j) => `JP${j.hcp_number}`,
    bidLabel: (b) => `BP${b.bid_number}`,
    stageLabel: (s) => STAGES[(s ?? '').toLowerCase()] ?? '—',
    money: (n) => `$${n.toLocaleString('en-US')}`,
    shortDay: (s) => (s ?? '').slice(0, 10),
    moneyShown: true,
    ...over,
  }
}

const lot3 = job({ id: 'j1091', job_name: 'Lot 3 rough-in', job_address: '14 Gray Fox Trl, Driftwood, TX', customer_name: 'Harlow Homes', status: 'working', pct_complete: 40, revenue: 12000, payments_made: 3000, last_work_date: '2026-10-29', last_bill_date: '2026-10-15', created_at: '2026-09-02T15:00:00Z', bid_id: 'b401', prior_numbers: ['HCP 550', 'C# 543'] })
const phase2 = bid({ id: 'b401', project_name: 'Phase 2 water' })
const crew = [
  { job_id: 'j1091', user_id: 'u-dana' },
  { job_id: 'j1091', user_id: 'u-mel' },
  { job_id: 'j1091', user_id: 'u-dana' },
  { job_id: 'j9', user_id: 'u-luis' },
]

describe('buildJobHoverCard', () => {
  it('reads the full row: the number, the name, the address and every detail the row carries, in the card’s order', () => {
    const card = buildJobHoverCard(lot3, inputs({ teamMembers: crew, bids: [phase2] }))
    expect(card.number).toBe('JP1091')
    expect(card.name).toBe('Lot 3 rough-in')
    expect(card.address).toBe('14 Gray Fox Trl, Driftwood, TX')
    expect(card.lines).toEqual([
      { label: 'Customer', value: 'Harlow Homes' },
      { label: 'Stage', value: 'Working' },
      { label: 'Progress', value: '40% done' },
      { label: 'Crew', value: 'Dana, Mel' },
      { label: 'Last work', value: '2026-10-29' },
      { label: 'Value', value: '$12,000' },
      { label: 'Paid', value: '$3,000' },
      { label: 'Last bill', value: '2026-10-15' },
      { label: 'From bid', value: 'BP401 Phase 2 water' },
      { label: 'Made', value: '2026-09-02' },
      { label: 'Old numbers', value: '550, 543' },
    ])
  })

  it('a thin row says the name is still to come, carries no address, and a waiting job with no crew reads not scheduled', () => {
    const card = buildJobHoverCard(job({ id: 'j2', status: 'waiting' }), inputs())
    expect(card.name).toBe(NO_NAME_WORDS)
    expect(card.address).toBeNull()
    expect(card.lines).toEqual([
      { label: 'Stage', value: 'Waiting' },
      { label: 'Crew', value: 'not scheduled' },
    ])
  })

  it('a reader with no money sees no figure and no bill day', () => {
    const card = buildJobHoverCard(lot3, inputs({ moneyShown: false, teamMembers: crew, bids: [phase2] }))
    expect(card.lines.map((l) => l.label)).toEqual(['Customer', 'Stage', 'Progress', 'Crew', 'Last work', 'From bid', 'Made', 'Old numbers'])
  })

  it('a billed job says what is open on the bill: its value less what was paid', () => {
    const card = buildJobHoverCard(job({ id: 'j5', status: 'billed', revenue: 12000, payments_made: 3000 }), inputs())
    expect(card.lines).toEqual([
      { label: 'Stage', value: 'Billed Awaiting Payment' },
      { label: 'Value', value: '$12,000' },
      { label: 'Paid', value: '$3,000' },
      { label: 'Open on bill', value: '$9,000' },
    ])
  })

  it('a paid job carries no progress line and nothing open on bill; a job whose bid is not on the site names no bid', () => {
    const card = buildJobHoverCard(job({ id: 'j3', status: 'paid', pct_complete: 100, revenue: 5000, payments_made: 5000, bid_id: 'b-elsewhere' }), inputs())
    expect(card.lines).toEqual([
      { label: 'Stage', value: 'Paid' },
      { label: 'Value', value: '$5,000' },
      { label: 'Paid', value: '$5,000' },
    ])
  })

  it('a job whose crew the page did not read says nothing about a crew, rather than not scheduled', () => {
    const atAddress = job({ id: 'j7', status: 'waiting' })
    expect(buildJobHoverCard(atAddress, inputs({ crewRead: new Set(['j1091']) })).lines.map((l) => l.label)).toEqual(['Stage'])
    expect(buildJobHoverCard(atAddress, inputs({ crewRead: new Set(['j7']) })).lines).toContainEqual({ label: 'Crew', value: 'not scheduled' })
  })

  it('blank names and addresses are blanks, not spaces', () => {
    const card = buildJobHoverCard(job({ id: 'j4', job_name: '   ', job_address: ' ', customer_name: '  ' }), inputs())
    expect(card.name).toBe(NO_NAME_WORDS)
    expect(card.address).toBeNull()
    expect(card.lines.find((l) => l.label === 'Customer')).toBeUndefined()
  })
})

describe('jobCrewNames', () => {
  it('names each team member once, in the order the rows came, and only this job’s', () => {
    expect(jobCrewNames('j1091', inputs({ teamMembers: crew }))).toEqual(['Dana', 'Mel'])
    expect(jobCrewNames('j9', inputs({ teamMembers: crew }))).toEqual(['Luis'])
    expect(jobCrewNames('j-none', inputs({ teamMembers: crew }))).toEqual([])
  })
})

describe('jobHoverCardLookup', () => {
  it('answers a job the page holds, the same card twice, and null for one it does not', () => {
    const cardFor = jobHoverCardLookup([lot3], inputs({ bids: [phase2] }))
    const a = cardFor('j1091')
    expect(a?.name).toBe('Lot 3 rough-in')
    expect(cardFor('j1091')).toBe(a)
    expect(cardFor('j-elsewhere')).toBeNull()
  })
})

const WIN = { width: 1280, height: 800 }
const CARD = { width: 300, height: 180 }

describe('placeHoverCard', () => {
  it('sits to the lower right of the pointer, a gap away', () => {
    expect(placeHoverCard({ x: 400, y: 300 }, CARD, WIN)).toEqual({ left: 400 + HOVER_CARD_GAP, top: 300 + HOVER_CARD_GAP })
  })
  it('flips to the left of the pointer when the right edge is near', () => {
    expect(placeHoverCard({ x: 1100, y: 300 }, CARD, WIN)).toEqual({ left: 1100 - HOVER_CARD_GAP - 300, top: 300 + HOVER_CARD_GAP })
  })
  it('flips above the pointer when the bottom is near', () => {
    expect(placeHoverCard({ x: 400, y: 700 }, CARD, WIN)).toEqual({ left: 400 + HOVER_CARD_GAP, top: 700 - HOVER_CARD_GAP - 180 })
  })
  it('never passes an edge: a flip that would go off the left or the top is clamped to the margin', () => {
    const narrow = { width: 320, height: 200 }
    expect(placeHoverCard({ x: 10, y: 10 }, CARD, narrow)).toEqual({ left: HOVER_CARD_MARGIN, top: HOVER_CARD_MARGIN })
    expect(placeHoverCard({ x: 310, y: 190 }, CARD, narrow)).toEqual({ left: HOVER_CARD_MARGIN, top: HOVER_CARD_MARGIN })
  })
  it('a card taller than the window pins to the top margin', () => {
    expect(placeHoverCard({ x: 400, y: 300 }, { width: 300, height: 2000 }, WIN).top).toBe(HOVER_CARD_MARGIN)
  })
})

describe('placeHoverCardUnder', () => {
  const chip = { left: 500, top: 400, right: 560, bottom: 420 }
  it('sits under the chip with its left edge on the chip’s', () => {
    expect(placeHoverCardUnder(chip, CARD, WIN)).toEqual({ left: 500, top: 426 })
  })
  it('goes above the chip when the bottom is near', () => {
    expect(placeHoverCardUnder({ left: 500, top: 760, right: 560, bottom: 780 }, CARD, WIN)).toEqual({ left: 500, top: 760 - 6 - 180 })
  })
  it('slides in from the right edge rather than passing it', () => {
    expect(placeHoverCardUnder({ left: 1200, top: 400, right: 1260, bottom: 420 }, CARD, WIN).left).toBe(1280 - HOVER_CARD_MARGIN - 300)
  })
})
