// @vitest-environment jsdom
/**
 * The short Dashboard's body: the list of what waits on the leader alone with one press a row, the lien card in
 * place of its row, the office's count and the door; the list held back while the Lien desk is read, a failed read
 * said in words, and *Nothing waiting on you* only once the read is in.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { NeedsYouItem } from '../../lib/dashboardNeedsYou'
import type { LienLeaderSignCard } from '../../lib/jobs/lienLeaderSignCard'
import { ShortDashboardBody, type ShortDashboardBodyProps } from './DashboardShortView'

afterEach(cleanup)

const sign: LienLeaderSignCard = {
  count: 2,
  tone: 'red',
  kicker: 'Lien deadlines · your signature',
  title: 'Sign 2 lien notices by Thursday, Nov 19',
  line: [{ text: 'Dana drafted them Friday.' }],
  phoneLines: [[{ text: 'Dana drafted them Friday.' }]],
  detail: 'Dana drafted them Friday',
  figure: '$6,529',
  rows: [
    { jobId: 'j1', label: '650 · Alder Creek Lofts', number: '650', claim: 4100, claimWords: '$4,100', gcName: 'Ridgeway Builders', chips: [{ key: 'due', tone: 'red', text: 'Sep closes Thu' }], monthsWords: 'Sep', monthNamed: true, href: '/lien-desk?job=j1', pressLabel: 'Open 650 to sign ▸', pressTitle: 'Open the notice for 650 to sign', primary: true },
    { jobId: 'j2', label: '702 · Pine Hollow Clinic', number: '702', claim: 2429, claimWords: '$2,429', gcName: 'Calloway Construction', chips: [], monthsWords: 'Aug + Sep', monthNamed: false, href: '/lien-desk?job=j2', pressLabel: 'Open 702 ›', pressTitle: 'Open the notice for 702', primary: false },
  ],
  more: null,
}

const lienItem: NeedsYouItem = { key: 'lien-notice-approve', severity: 'red', kicker: sign.kicker, title: sign.title, detail: 'Dana drafted them Friday.', figure: '2', actionLabel: 'Open 650 to sign', lienSign: sign, openHref: '/lien-desk?job=j1', first: true }
const runItem: NeedsYouItem = { key: 'lien-notice-batch', severity: 'blue', kicker: 'Lien deadlines · your call', title: 'Approve the run for Calloway Construction', detail: '$9,200 claimed on 4 notices.', figure: '4', actionLabel: 'Decide' }
const tagItem: NeedsYouItem = { key: 'tagged-notes', severity: 'amber', kicker: 'Tagged job notes', title: 'Dana tagged you on Alder Creek Lofts', detail: 'Can the rough-in move to Wednesday?', figure: '1', actionLabel: 'Open' }

function draw(over: Partial<ShortDashboardBodyProps> = {}) {
  const props: ShortDashboardBodyProps = {
    firstName: 'Marcus',
    hour: 8,
    waiting: [lienItem, runItem, tagItem],
    alsoYours: 0,
    office: 23,
    read: 'ready',
    phone: true,
    onAct: vi.fn(),
    onOpenLien: vi.fn(),
    onOpenLienDesk: vi.fn(),
    onEverythingElse: vi.fn(),
    ...over,
  }
  const view = render(<ShortDashboardBody {...props} />)
  return { props, ...view }
}

describe('ShortDashboardBody', () => {
  it('lists what waits on him with one press a row, then the office’s count and the door', () => {
    const { props, container } = draw({ schedule: <div data-testid="his-day">8:00 Alder Creek Lofts</div> })
    expect(container.querySelector('[data-short-greeting]')?.textContent).toBe('Morning, Marcus')
    expect(container.querySelector('[data-short-count]')?.textContent).toBe('3 things wait on you.')
    expect(container.querySelector('[data-short-waiting-count]')?.textContent).toBe('3')
    expect([...container.querySelectorAll('[data-short-row]')].map((r) => r.getAttribute('data-short-row'))).toEqual(['lien-notice-approve', 'lien-notice-batch', 'tagged-notes'])
    // The lien line is the leader's card, and a press on a notice hands over that notice's address.
    expect(container.querySelector('[data-lien-leader-card]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open 650 to sign ▸' }))
    expect(props.onOpenLien).toHaveBeenCalledWith(lienItem, '/lien-desk?job=j1', 'sign')
    // Every other line is a title, a sentence and one press that says the act.
    fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
    expect(props.onAct).toHaveBeenCalledWith(runItem)
    expect(screen.getByTestId('his-day')).toBeTruthy()
    expect(container.querySelector('[data-short-office]')?.textContent).toBe('The office is handling 23 other things.')
    expect(container.querySelector('[data-short-door-note]')?.textContent).toBe('Money, crew, jobs and the full Dashboard.')
    fireEvent.click(container.querySelector('[data-short-door]') as HTMLElement)
    expect(props.onEverythingElse).toHaveBeenCalledTimes(1)
  })

  it('draws what is handed in under the greeting above the list, so the lines that wait never push it down (v2.8507)', () => {
    const { container } = draw({ underGreeting: <button type="button" data-write-someone-up>Write someone up</button>, schedule: <div data-testid="his-day">8:00 Alder Creek Lofts</div> })
    const order = [...container.querySelectorAll('[data-short-greeting], [data-write-someone-up], [data-short-row], [data-testid="his-day"], [data-short-door]')].map((el) =>
      el.hasAttribute('data-short-greeting') ? 'greeting' : el.hasAttribute('data-write-someone-up') ? 'write someone up' : el.hasAttribute('data-short-row') ? 'a line that waits' : el.hasAttribute('data-short-door') ? 'everything else' : 'his day',
    )
    expect(order).toEqual(['greeting', 'write someone up', 'a line that waits', 'a line that waits', 'a line that waits', 'his day', 'everything else'])
  })

  it('a superintendent’s door names what is behind it for him (punch list #384)', () => {
    const { container } = draw({ firstName: 'Sam', role: 'superintendent', waiting: [], office: 0 })
    expect(container.querySelector('[data-short-door-note]')?.textContent).toBe('Clock In, your hours, your crew and the full Dashboard.')
    expect(container.querySelector('[data-short-office]')?.textContent).toBe('Nothing else is open.')
  })

  it('says nothing waits only once the read is in, and names what the door holds of his own', () => {
    const { container } = draw({ waiting: [], alsoYours: 2, office: 19 })
    expect(container.querySelector('[data-empty-state]')?.textContent).toBe('Nothing waiting on you. The office puts a paper here when it needs your signature or your word.')
    expect(container.querySelector('[data-short-count]')).toBeNull()
    expect(container.querySelector('[data-short-waiting-count]')).toBeNull()
    expect(container.querySelector('[data-short-door-note]')?.textContent).toBe('2 more of yours are in there.')
  })

  it('holds the list back while the Lien desk is being read', () => {
    const { container } = draw({ waiting: [], read: 'reading' })
    expect(screen.getByRole('status').textContent).toBe('Reading what waits on you…')
    expect(container.querySelector('[data-empty-state]')).toBeNull()
    expect(container.querySelector('[data-short-count]')).toBeNull()
  })

  it('while the read is out, the office’s line is not drawn and the door shows no count that would then change', () => {
    // The counts as they stand a second into the read: none from the office yet, two of his own.
    const { container } = draw({ waiting: [], read: 'reading', office: 0, alsoYours: 2 })
    expect(container.querySelector('[data-short-office]')).toBeNull()
    expect(screen.queryByText('Nothing else is open.')).toBeNull()
    expect(container.querySelector('[data-short-door-note]')?.textContent).toBe('Money, crew, jobs and the full Dashboard.')
    expect(container.textContent).not.toMatch(/\d+ more of yours/)
    cleanup()
    // A superintendent's door keeps his own words while it reads.
    const sup = draw({ waiting: [], read: 'reading', office: 4, alsoYours: 3, role: 'superintendent' })
    expect(sup.container.querySelector('[data-short-door-note]')?.textContent).toBe('Clock In, your hours, your crew and the full Dashboard.')
    cleanup()
    // Once the read is in, both say their counts.
    const ready = draw({ waiting: [], read: 'ready', office: 23, alsoYours: 13 })
    expect(ready.container.querySelector('[data-short-office]')?.textContent).toBe('The office is handling 23 other things.')
    expect(ready.container.querySelector('[data-short-door-note]')?.textContent).toBe('13 more of yours are in there.')
  })

  it('a read that failed is not whole either: no office line and no count on the door', () => {
    const { container } = draw({ waiting: [tagItem], read: 'failed', office: 5, alsoYours: 2 })
    expect(container.querySelector('[data-short-office]')).toBeNull()
    expect(container.querySelector('[data-short-door-note]')?.textContent).toBe('Money, crew, jobs and the full Dashboard.')
  })

  it('says a failed read in words, shows what did arrive, and never says nothing waits', () => {
    const { props, container } = draw({ waiting: [tagItem], read: 'failed' })
    expect(screen.getByRole('alert').textContent).toBe('The Lien desk could not be read, so this list may be short. Open the Lien desk')
    fireEvent.click(screen.getByRole('button', { name: 'Open the Lien desk' }))
    expect(props.onOpenLienDesk).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-short-row="tagged-notes"]')).toBeTruthy()
    // The count is a promise that the list is whole: a failed read makes none.
    expect(container.querySelector('[data-short-count]')).toBeNull()
    expect(container.querySelector('[data-short-waiting-count]')).toBeNull()
    cleanup()
    const empty = draw({ waiting: [], read: 'failed' })
    expect(empty.container.querySelector('[data-empty-state]')).toBeNull()
  })

  it('Rate your crew is a row of the list while his round is open', () => {
    const onRateCrew = vi.fn()
    const { container } = draw({ waiting: [], onRateCrew })
    expect(container.querySelector('[data-short-count]')?.textContent).toBe('1 thing waits on you.')
    expect(container.querySelector('[data-empty-state]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rate' }))
    expect(onRateCrew).toHaveBeenCalledTimes(1)
  })
})
