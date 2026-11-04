// @vitest-environment jsdom
/**
 * The band on a New row (punch list #258, v2.6507): three rows in the lane, an invitation to bid wearing the Estimating
 * band, a customer's text on the team line the Dispatch band, and a sender nobody has named none; the band's label is
 * the desk's word then why; at 1400 the band is 22 wide and the row's padding moves right by it, at 375 it is 18; and a
 * press on the band opens the thread as the row does. Every person is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { newLane, type NewLaneContact, type NewLaneMessage } from '../../lib/followUp/newLane'
import type { FollowUpContact } from '../../lib/followUp/followUpRows'
import type { FollowUpQueue } from '../../lib/followUp/queue'
import { DESK_BAND, DESK_MARKS } from '../../lib/messages/deskMarks'
import { FollowUpSections, type FollowUpSectionActions } from './FollowUpSections'
import type { Teammate } from './WhoHasItPill'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const NOW = '2026-11-04T15:00:00Z'
const ME: Teammate = { id: 'u-robert', name: 'Robert', role: 'estimator' }

const CONTACTS: NewLaneContact[] = [
  { id: 'dale', kind: 'unknown', name: 'dale@ridgeway.example', company: '', jobIds: [], defaultJobId: null, has: null, channels: [{ kind: 'email', value: 'dale@ridgeway.example' }] },
  { id: 'priya', kind: 'customer', name: 'Priya Raman', company: '', jobIds: [], defaultJobId: null, has: null, channels: [{ kind: 'phone', value: '(210) 555-0142' }] },
  { id: 'jesse', kind: 'unknown', name: 'jesse@surety.example', company: '', jobIds: [], defaultJobId: null, has: null, channels: [{ kind: 'email', value: 'jesse@surety.example' }] },
]

const MESSAGES: NewLaneMessage[] = [
  { id: 'm-dale', contactId: 'dale', jobId: null, channel: 'email', direction: 'in', at: '2026-11-03T13:12:00Z', subject: 'Oak Hill Clinic, Boerne - Invitation to Bid', body: 'Please see the attached invitation to bid. Bids due Thursday.', mailbox: 'bids', invitation: { kind: 'invitation', project: 'Oak Hill Clinic, Boerne', due: null, portal: null, cue: 'invitation to bid' } },
  { id: 'm-priya', contactId: 'priya', jobId: null, channel: 'text', direction: 'in', at: '2026-11-03T14:00:00Z', body: 'Can someone come look at the water heater this week?', mailbox: 'team' },
  { id: 'm-jesse', contactId: 'jesse', jobId: null, channel: 'email', direction: 'in', at: '2026-11-03T15:00:00Z', subject: 'A trusted perspective on surety', body: 'Our latest article.', mailbox: 'bids' },
]

const followUpContact = (c: NewLaneContact): FollowUpContact => ({
  id: c.id,
  kind: c.kind,
  name: c.name,
  goesBy: null,
  company: c.company,
  state: 'waiting',
  snoozedUntil: null,
  has: null,
  hasUserId: null,
  hasSince: null,
  hasHow: null,
  jobIds: [...c.jobIds],
  defaultJobId: c.defaultJobId,
  phone: c.channels?.find((ch) => ch.kind === 'phone')?.value ?? null,
  channels: c.channels,
})

function queueOf(): FollowUpQueue {
  return { newLane: newLane(CONTACTS, MESSAGES, new Set(), NOW), needsYou: [], clauses: [], needsReply: [], weOwe: [], calls: [], nudges: [], onPortal: () => false, count: 3 }
}

const actions = (): FollowUpSectionActions => ({
  openThread: vi.fn(),
  hand: vi.fn(),
  noReplyNeeded: vi.fn(),
  remindMonday: vi.fn(),
  backDone: vi.fn(),
  anotherDay: vi.fn(),
})

/** The window at a width: `useIsMobile` reads `(max-width: 640px)`. */
function atWidth(px: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: /max-width:\s*(\d+)px/.exec(query) ? px <= Number(/max-width:\s*(\d+)px/.exec(query)![1]) : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
}

function draw(px: number) {
  atWidth(px)
  const acts = actions()
  render(<FollowUpSections queue={queueOf()} contacts={CONTACTS.map(followUpContact)} lines={new Map()} me={ME} team={[ME]} todayYmd="2026-11-04" nowIso={NOW} actions={acts} />)
  return acts
}

const rowOf = (id: string) => document.querySelector(`[data-follow-up-row="${id}"]`)!.parentElement as HTMLElement

describe('the band on a New row', () => {
  it('at 1400: the invitation wears Estimating, the customer’s text Dispatch, the unnamed sender none', () => {
    draw(1400)
    const dale = within(rowOf('dale')).getByRole('img', { name: 'Estimating · An invitation to bid.' })
    expect(dale.dataset.deskBand).toBe('estimating')
    expect(dale.style.background).toBe(hexToRgb(DESK_MARKS.estimating.fill))
    expect(dale.style.width).toBe(`${DESK_BAND.desk.width}px`)
    expect(rowOf('dale').style.paddingLeft).toBe(`calc(${DESK_BAND.desk.width}px + 0.8rem)`)
    expect(dale.querySelector('path')?.getAttribute('d')).toBe(DESK_MARKS.estimating.icon.path)

    const priya = within(rowOf('priya')).getByRole('img', { name: 'Dispatch · A customer on the team line. Dispatch books the visit.' })
    expect(priya.dataset.deskBand).toBe('dispatch')
    expect(priya.style.background).toBe(hexToRgb(DESK_MARKS.dispatch.fill))

    expect(within(rowOf('jesse')).queryByRole('img')).toBeNull()
    expect(rowOf('jesse').style.paddingLeft).toBe('0.8rem')
    expect(document.querySelectorAll('[data-desk-band]')).toHaveLength(2)
  })

  it('at 375: the band narrows to 18 and the row’s padding follows', () => {
    draw(375)
    const dale = within(rowOf('dale')).getByRole('img', { name: /Estimating/ })
    expect(dale.style.width).toBe(`${DESK_BAND.phone.width}px`)
    expect(dale.querySelector('svg')?.getAttribute('width')).toBe(String(DESK_BAND.phone.icon))
    expect(rowOf('dale').style.paddingLeft).toBe(`calc(${DESK_BAND.phone.width}px + 0.8rem)`)
  })

  it('a press on the band opens the thread at the line, as the row does', () => {
    const acts = draw(1400)
    fireEvent.click(within(rowOf('priya')).getByRole('img', { name: /Dispatch/ }))
    expect(acts.openThread).toHaveBeenCalledWith('priya', 'm-priya')
  })
})

/** jsdom reports a hex background as rgb(). */
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
