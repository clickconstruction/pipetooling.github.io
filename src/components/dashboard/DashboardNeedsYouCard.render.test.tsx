// @vitest-environment jsdom
/**
 * Render smokes for the Needs You card (v2.2339): empty-state null render,
 * cards mode rows + actions, the Cards/Walk toggle with per-user persistence,
 * and walk mode's Skip rotation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DashboardNeedsYouCard } from './DashboardNeedsYouCard'
import { lienLeaderSignItem, rankNeedsYouItems, type NeedsYouItem } from '../../lib/dashboardNeedsYou'
import { buildLienLeaderSignCard } from '../../lib/jobs/lienLeaderSignCard'
import { leaderInput, leaderNine, leaderTonight } from '../../test/lienLeaderFixtures'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
const phone = { on: false }
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => phone.on }))

const ITEMS: NeedsYouItem[] = [
  {
    key: 'ar-deposits',
    severity: 'blue',
    kicker: 'Money received',
    title: 'Allocate 2 bank deposits',
    detail: '2 Mercury transactions still have balance to apply.',
    figure: '2',
    actionLabel: 'Match deposits',
  },
  {
    key: 'tally-self',
    severity: 'amber',
    kicker: 'Your card purchases',
    title: '89 purchases need a job',
    detail: "Purchases over 2 days old aren't on a job yet.",
    figure: '89',
    actionLabel: 'Open tally',
  },
  {
    key: 'lost-bids',
    severity: 'gray',
    kicker: 'Win/loss hygiene',
    title: '61 lost bids have no reason recorded',
    detail: '$8.7M unexplained.',
    figure: '61',
    actionLabel: 'Start call mode',
  },
]

// The fixtures are the office's lines, so the mechanics render as the assistant, whose lines they are (v2.5843: a dev reads them folded).
function renderCard(items: NeedsYouItem[] = ITEMS, role: 'dev' | 'assistant' | 'master_technician' = 'assistant') {
  const onAction = vi.fn()
  const utils = render(<DashboardNeedsYouCard userId="u-1" role={role} items={items} onAction={onAction} />)
  return { ...utils, onAction }
}

beforeEach(() => {
  localStorage.clear()
  phone.on = false
})

describe('DashboardNeedsYouCard', () => {
  it('renders nothing when the list is empty (like the banners it replaces)', () => {
    const { container } = renderCard([])
    expect(container.innerHTML).toBe('')
  })

  it('cards mode: one row per item, count badge, action fires onAction', () => {
    const { onAction } = renderCard()
    expect(screen.getByText('Needs you')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Allocate 2 bank deposits')).toBeTruthy()
    fireEvent.click(screen.getByText('Match deposits'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'ar-deposits' }))
  })

  it('materials on site (punch list #209, v2.6728): the two office lines draw their words and press through with their keys', () => {
    const items: NeedsYouItem[] = [
      { key: 'materials-missing-week', severity: 'amber', kicker: 'Materials on site', title: '$1,240 of material walked away this week', detail: "3 lines on 2 jobs: a count under what the ledger expected, or a Can't find press on the phone.", figure: '$1,240', actionLabel: 'Open the desk' },
      { key: 'materials-count-due', severity: 'gray', kicker: 'Materials on site', title: '12 boxes on 3 jobs not counted in 14 days', detail: 'The desk lists the boxes due on each job.', figure: '12', actionLabel: 'Open the job' },
    ]
    const { onAction } = renderCard(items)
    expect(screen.getByText('$1,240 of material walked away this week')).toBeTruthy()
    expect(screen.getByText('12 boxes on 3 jobs not counted in 14 days')).toBeTruthy()
    fireEvent.click(screen.getByText('Open the desk'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'materials-missing-week' }))
    fireEvent.click(screen.getByText('Open the job'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'materials-count-due' }))
  })

  it('the toggle switches to walk mode and persists per user', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText('Walk the list view'))
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(screen.getByText('Money received')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_needs_you_mode_u-1')).toBe('walk')
  })

  it('walk mode: Skip rotates through the list and shows what is next', () => {
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'walk')
    renderCard()
    expect(screen.getByText(/Next: 89 purchases need a job/)).toBeTruthy()
    fireEvent.click(screen.getByText('Skip for now'))
    expect(screen.getByText('2 of 3')).toBeTruthy()
    expect(screen.getByText('89 purchases need a job')).toBeTruthy()
    fireEvent.click(screen.getByText('Skip for now'))
    fireEvent.click(screen.getByText('Skip for now'))
    // Wrapped back to the first item.
    expect(screen.getByText('1 of 3')).toBeTruthy()
  })

  it('walk mode with a single item hides Skip', () => {
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'walk')
    renderCard([ITEMS[0] as NeedsYouItem])
    expect(screen.queryByText('Skip for now')).toBeNull()
  })

  it('on a phone an office role opens on Walk with nothing saved; a saved Cards choice and a dev keep Cards (v2.3881)', () => {
    phone.on = true
    const a = renderCard(ITEMS, 'assistant')
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_needs_you_mode_u-1')).toBeNull() // a default, not a choice
    a.unmount()
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'cards')
    const b = renderCard(ITEMS, 'assistant')
    expect(screen.queryByText('1 of 3')).toBeNull()
    b.unmount()
    localStorage.clear()
    renderCard(ITEMS, 'dev')
    expect(screen.queryByText('1 of 3')).toBeNull()
  })

  it('the trail: a skipped card goes to the back and onto the trail, a tap brings it back, and an acted one is listed (v2.3881)', () => {
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'walk')
    const { onAction, container } = renderCard()
    expect(container.querySelector('[data-needs-you-trail]')).toBeNull()
    fireEvent.click(screen.getByText('Skip for now'))
    // The skipped card is last in the round, not next.
    expect(screen.getByText(/Next: 61 lost bids/)).toBeTruthy()
    expect(screen.getByText(/Then: Allocate 2 bank deposits/)).toBeTruthy()
    const trail = container.querySelector('[data-needs-you-trail]') as HTMLElement
    expect(trail.textContent).toContain('Handled this visit:')
    fireEvent.click(screen.getByRole('button', { name: /Allocate 2 bank deposits/ }))
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(screen.getByText('Money received')).toBeTruthy()
    fireEvent.click(screen.getByText('Match deposits'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'ar-deposits' }))
    expect(trail.querySelectorAll('button').length).toBe(1) // one entry per item
  })

  it('an item the work cleared stays on the trail as done, without a door', () => {
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'walk')
    const onAction = vi.fn()
    const { rerender, container } = render(<DashboardNeedsYouCard userId="u-1" role="assistant" items={ITEMS} onAction={onAction} />)
    fireEvent.click(screen.getByText('Match deposits'))
    rerender(<DashboardNeedsYouCard userId="u-1" role="assistant" items={ITEMS.slice(1)} onAction={onAction} />)
    const trail = container.querySelector('[data-needs-you-trail]') as HTMLElement
    expect(trail.textContent).toContain('✓ Allocate 2 bank deposits')
    expect(trail.querySelector('button')).toBeNull()
    expect(screen.getByText('1 of 2')).toBeTruthy()
  })
})

describe('DashboardNeedsYouCard · whose line it is (punch list #176, change 3)', () => {
  it('the owner reads the office lines folded, with a summary, and opens them with Show; the walk still reaches them', () => {
    const { onAction } = renderCard(ITEMS, 'master_technician')
    // tally-self is the viewer's own; the deposits and the lost bids are the office's.
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2 for others')).toBeTruthy()
    expect(screen.getByText('The office is on these')).toBeTruthy()
    expect(screen.queryByText('Match deposits')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show the office is on these' }))
    fireEvent.click(screen.getByText('Match deposits'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'ar-deposits' }))
    fireEvent.click(screen.getByLabelText('Walk the list view'))
    expect(screen.getByText('1 of 3')).toBeTruthy()
  })

  it('the assistant sees what waits on the owner, folded', () => {
    const owners: NeedsYouItem = { key: 'bulk-delete', severity: 'red', kicker: 'Data safety', title: 'Bulk deletions detected', detail: '', figure: '5', actionLabel: 'Review deletions' }
    renderCard([...ITEMS, owners], 'assistant')
    expect(screen.getByText('Waiting on the owner')).toBeTruthy()
    expect(screen.queryByText('Review deletions')).toBeNull()
    expect(screen.getByText('Allocate 2 bank deposits')).toBeTruthy()
  })

  it('with only the folds left, the card says Nothing waits on you as its empty state (punch list #184, sweep C)', () => {
    const owners: NeedsYouItem = { key: 'bulk-delete', severity: 'red', kicker: 'Data safety', title: 'Bulk deletions detected', detail: '', figure: '5', actionLabel: 'Review deletions' }
    renderCard([owners], 'assistant')
    expect(screen.getByText('Waiting on the owner')).toBeTruthy()
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('Nothing waits on you.')
  })
})

describe('DashboardNeedsYouCard: While you were off (v2.6060, punch list #141 PR 4)', () => {
  it('draws the line with its count and See them opens it', () => {
    const waited: NeedsYouItem = {
      key: 'while-off',
      severity: 'amber',
      kicker: 'Push me',
      title: 'While you were off: 3 replies and a work order waited',
      detail: 'Since 8 PM. Evan answered Dana at 11:50 PM.',
      figure: '4',
      actionLabel: 'See them',
    }
    const { onAction } = renderCard([waited], 'assistant')
    expect(screen.getByText('While you were off: 3 replies and a work order waited')).toBeTruthy()
    expect(screen.getByText('Since 8 PM. Evan answered Dana at 11:50 PM.')).toBeTruthy()
    fireEvent.click(screen.getByText('See them'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'while-off' }))
  })
  it('starts with its title: the Lien desk’s counts are a card of their own beside it (punch list #423), and no prop hands them in', () => {
    render(<DashboardNeedsYouCard userId="u1" role="assistant" items={ITEMS} onAction={() => {}} />)
    const section = document.querySelector('section[aria-label^="Needs you"]')!
    expect(section.firstElementChild!.hasAttribute('data-dashboard-card-head')).toBe(true)
    expect(section.querySelector('[data-lien-desk-card]')).toBeNull()
    expect(section.textContent).not.toContain('The Board')
  })
})

describe('DashboardNeedsYouCard: the leader’s lien notices as a card of their own (v2.7435)', () => {
  /** The Needs you line a leader gets with these notices waiting, through the real builders. */
  const leaderItems = (awaiting = leaderTonight()): NeedsYouItem[] => [lienLeaderSignItem(buildLienLeaderSignCard(leaderInput(awaiting))!)]
  const text = (sel: string) => [...document.querySelectorAll(sel)].map((n) => n.textContent ?? '')
  beforeEach(() => cleanup())

  it('on a computer: the deadline as the title, the money and the wait in one line, a row and a press per notice', () => {
    const items = [ITEMS[1]!, ...leaderItems()]
    const { onAction } = renderCard(items, 'master_technician')
    const card = document.querySelector('[data-lien-leader-card]') as HTMLElement
    expect(card.getAttribute('data-tone')).toBe('red')
    expect(card.getAttribute('data-phone')).toBe('no')
    expect(card.textContent).toContain('Lien notices · your signature')
    expect(text('[data-lien-leader-title]')).toEqual(['Sign 1 lien notice today'])
    expect(text('[data-lien-leader-line]')).toEqual(['2 more with no open window · $6,529 on 3 jobs · they have waited on you since Oct 7, 40 days'])
    expect([...card.querySelectorAll('[data-lien-leader-line] strong')].map((n) => n.textContent)).toEqual(['$6,529', 'Oct 7'])
    // One row a notice, the GC on it, the chips on the job they belong to.
    const rows = [...card.querySelectorAll('[data-lien-leader-row]')] as HTMLElement[]
    expect(rows.map((r) => r.getAttribute('data-lien-leader-row'))).toEqual(['j891', 'j804', 'j922'])
    expect(rows[0]!.textContent).toContain('891 · ZZ Test Car Wash')
    expect(rows[0]!.textContent).toContain('$2,976')
    expect(rows[0]!.textContent).toContain('ZZ Test GC 891')
    expect([...rows[0]!.querySelectorAll('[data-lien-leader-chip]')].map((c) => [c.getAttribute('data-tone'), c.textContent])).toEqual([['red', 'August closes today'], ['red', 'July closed Oct 15, not sent']])
    expect(rows[1]!.textContent).toContain('Jul + Aug + Sep')
    expect([...rows[2]!.querySelectorAll('[data-lien-leader-chip]')].map((c) => [c.getAttribute('data-tone'), c.textContent])).toEqual([['amber', 'nothing claimed, ask the office']])
    // Every row has its press: the first signs, in the green; the others open.
    const presses = [...card.querySelectorAll('[data-lien-leader-press]')] as HTMLElement[]
    expect(presses.map((b) => [b.textContent, b.getAttribute('data-primary')])).toEqual([['Open 891 to sign ▸', 'yes'], ['Open 804 ›', 'no'], ['Open 922 ›', 'no']])
    expect(rows.every((r) => r.tagName === 'DIV')).toBe(true)
    fireEvent.click(presses[1]!)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0]![0]).toMatchObject({ key: 'lien-notice-approve', openHref: '/lien-desk?tab=notices&job=j804&pile=awaiting' })
    fireEvent.click(presses[0]!)
    expect(onAction.mock.calls[1]![0]).toMatchObject({ openHref: '/lien-desk?tab=notices&job=j891&pile=awaiting' })
    // The old row's words are gone, and with three waiting there is no line for the rest.
    expect(card.textContent).not.toContain('the office drafted')
    expect(card.querySelector('[data-lien-leader-more]')).toBeNull()
  })

  it('red, it is the first line of Needs you; blue, it sits where the row sat', () => {
    // Ranked, the card leads although the purchases line was handed in first and sits in a worse tier.
    const ranked = rankNeedsYouItems([{ ...ITEMS[1]!, key: 'bulk-delete' }, ...leaderItems()])
    expect(ranked.map((i) => i.key)).toEqual(['lien-notice-approve', 'bulk-delete'])
    expect(ranked[0]).toMatchObject({ first: true, severity: 'red' })
    renderCard(ranked, 'master_technician')
    const all = document.querySelector('section')!.textContent ?? ''
    expect(all.indexOf('Sign 1 lien notice today')).toBeLessThan(all.indexOf('89 purchases need a job'))
    cleanup()
    const blue = leaderItems(leaderNine().slice(2, 4))
    expect(blue[0]).toMatchObject({ severity: 'blue', title: '2 lien notices wait on your signature' })
    expect(blue[0]!.first).toBeUndefined()
    renderCard(blue, 'master_technician')
    expect((document.querySelector('[data-lien-leader-card]') as HTMLElement).getAttribute('data-tone')).toBe('blue')
  })

  it('on a phone: the wait on its own line, one button on the first notice, and every other row is the press', () => {
    phone.on = true
    // A phone with no saved choice opens on the deck, so this visit has Cards saved.
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'cards')
    const { onAction } = renderCard(leaderItems(), 'master_technician')
    const drawn = document.querySelector('[data-lien-leader-card]') as HTMLElement
    expect(drawn.getAttribute('data-phone')).toBe('yes')
    expect(text('[data-lien-leader-line]')).toEqual(['2 more with no open window · $6,529 on 3 jobs', 'Waiting on you since Oct 7, 40 days'])
    const presses = [...drawn.querySelectorAll('[data-lien-leader-press]')] as HTMLElement[]
    expect(presses.map((b) => b.textContent)).toEqual(['Open 891 to sign ▸'])
    const rows = [...drawn.querySelectorAll('[data-lien-leader-row]')] as HTMLElement[]
    expect(rows.map((r) => r.tagName)).toEqual(['DIV', 'BUTTON', 'BUTTON'])
    expect(rows[1]!.getAttribute('aria-label')).toBe('Open the notice for 804 ZZ Test Auto Parts on the Lien desk')
    // A phone's rows leave the GC out.
    expect(drawn.textContent).not.toContain('ZZ Test GC')
    fireEvent.click(rows[2]!)
    expect(onAction.mock.calls[0]![0]).toMatchObject({ key: 'lien-notice-approve', openHref: '/lien-desk?tab=notices&job=j922&pile=awaiting' })
  })

  it('with nine waiting: three rows, and one line that opens the Awaiting approval pile', () => {
    const { onAction } = renderCard(leaderItems(leaderNine()), 'master_technician')
    const card = document.querySelector('[data-lien-leader-card]') as HTMLElement
    expect(text('[data-lien-leader-title]')).toEqual(['Sign 2 lien notices today'])
    expect(card.querySelectorAll('[data-lien-leader-row]')).toHaveLength(3)
    const more = card.querySelector('[data-lien-leader-more]') as HTMLElement
    expect(more.textContent).toBe('6 more wait on you ›')
    fireEvent.click(more)
    expect(onAction.mock.calls[0]![0]).toMatchObject({ openHref: '/lien-desk?tab=notices&pile=awaiting' })
  })

  it('Walk the list still says it in one card: the title, the line, and a press that opens the first notice', () => {
    const { onAction } = renderCard(leaderItems(), 'master_technician')
    fireEvent.click(screen.getByRole('button', { name: 'Walk the list view' }))
    expect(document.querySelector('[data-lien-leader-card]')).toBeNull()
    expect(screen.getByText('Sign 1 lien notice today')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open 891 to sign' }))
    expect(onAction.mock.calls[0]![0]).toMatchObject({ key: 'lien-notice-approve', openHref: '/lien-desk?tab=notices&job=j891&pile=awaiting' })
  })
})
