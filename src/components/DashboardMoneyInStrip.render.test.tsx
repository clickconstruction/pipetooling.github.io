// @vitest-environment jsdom
/**
 * Render smokes for the Money in bar (punch list #191): closed by default to
 * one line, pressed open to the week line with the drawer shelf, last week's
 * column and today's column, doors on the chips (the Banking door left off
 * for a role that cannot open Banking), the failed-source line, and the
 * remembered open state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import DashboardMoneyInStrip, { MONEY_IN_OPEN_KEY, MoneyInStripView } from './DashboardMoneyInStrip'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import type { MoneyInWeekState } from '../hooks/useMoneyInWeek'
import { buildMoneyInWeek, type MoneyInRow, type MoneyInWeekView } from '../lib/moneyInWeek'
import type { CollectBillRead } from '../lib/bridge/collect/collectPile'

const phone = { on: false }
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => phone.on }))
const hook = vi.hoisted(() => ({ state: null as MoneyInWeekState | null }))
vi.mock('../hooks/useMoneyInWeek', () => ({ useMoneyInWeek: () => hook.state }))
vi.mock('../hooks/useAuth', async () => (await import('../test/renderSmokeMocks')).useAuthModuleMock({ role: 'assistant' }))
vi.mock('../lib/supabase', async () => ({ supabase: (await import('../test/renderSmokeMocks')).makeSupabaseStub() }))

const bill = (over: Partial<CollectBillRead> & { key: string }): CollectBillRead => ({
  jobId: `job-${over.key}`,
  payerId: 'c1',
  payerName: 'Barton Creek Builders',
  billedYmd: '2026-10-12',
  usd: 12400,
  state: 'notdue',
  isGc: false,
  gcByRecord: false,
  paceDays: 14,
  paceSource: 'own',
  paceSamples: 4,
  expectedYmd: '2026-10-30',
  daysPastExpected: null,
  ageDays: 14,
  promise: null,
  ...over,
})

// A small week on the mock-up's Monday, made-up names throughout.
function week(): MoneyInWeekView {
  return buildMoneyInWeek({
    payments: [{ paymentId: 'p1', jobId: 'j-ridgeway', usd: 9800, paidOnYmd: '2026-10-26', paymentType: null, note: 'Stripe', referenceNumber: null, payerName: 'Ridgeway Builders', bankTransactionId: null }],
    unlinked: [{ paymentId: 'u1', jobId: 'j-cedar', usd: 7250, paidOnYmd: '2026-10-23', paymentType: 'Check', referenceNumber: '4471', payerName: 'Cedar Ridge Builders' }],
    deposits: [],
    linkedDeposits: new Map(),
    returns: [{ id: 'r1', payerName: 'Hill Country Electric', usd: 3150, cameBackYmd: '2026-10-22', chip: 'came back · Insufficient funds', livePaymentIds: [], jobId: 'j-hill' }],
    unbankedCount: 2,
    pile: [
      bill({ key: 'inv:riverbend', payerName: 'Riverbend Office Park', usd: 6300, expectedYmd: '2026-10-27' }),
      bill({ key: 'inv:barton', state: 'promised', promise: { promisedYmd: '2026-10-30', markedByName: 'Taunya' } }),
    ],
    claims: null,
    stripeOpenInvoiceIds: new Set(),
    payout: { usd: 9310, arrivalYmd: '2026-10-28' },
    todayYmd: '2026-10-26',
  })
}

function renderBar(over: Partial<Parameters<typeof MoneyInStripView>[0]> = {}) {
  const onDoor = vi.fn<(row: MoneyInRow) => void>()
  const onOpenDeposits = vi.fn()
  const utils = render(
    <MoneyInStripView view={week()} failed={[]} loading={false} readAtIso="2026-10-26T14:40:00Z" canOpenBanking={false} onDoor={onDoor} onOpenDeposits={onOpenDeposits} {...over} />,
  )
  return { ...utils, onDoor, onOpenDeposits }
}

beforeEach(() => {
  localStorage.clear()
  phone.on = false
})

describe('DashboardMoneyInStrip', () => {
  it('is one closed line by default: came in, still expected, last week, the returned pill', () => {
    renderBar()
    const bar = screen.getByRole('button', { name: /Money in/ })
    expect(bar.getAttribute('aria-expanded')).toBe('false')
    expect(bar.textContent).toContain('Came in $9,800 · 1')
    expect(bar.textContent).toContain('Still expected $25.9k · 3')
    expect(bar.textContent).toContain('Last week still out $3,150 · 1')
    expect(bar.textContent).toContain('1 RETURNED')
    expect(screen.queryByText(/week of/)).toBeNull()
  })

  it('opens to the week line and remembers it was left open', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: /Money in/ }))
    expect(screen.getByText('· week of Mon Oct 26')).toBeTruthy()
    expect(screen.getByText('Monday 9:40 AM')).toBeTruthy()
    expect(screen.getByText('In the drawer')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Cedar Ridge Builders · #4471 · \$7,250 · Fri/ })).toBeTruthy()
    expect(screen.getByText(/2 older checks never reached the bank/)).toBeTruthy()
    expect(screen.getByText('$3,150 still out')).toBeTruthy()
    expect(screen.getByText(/Mon 26/).textContent).toContain('today')
    expect(screen.getByText('✓ Landed · Stripe')).toBeTruthy()
    expect(localStorage.getItem(MONEY_IN_OPEN_KEY)).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Close ▴' }))
    expect(localStorage.getItem(MONEY_IN_OPEN_KEY)).toBe('0')
    expect(screen.queryByText('In the drawer')).toBeNull()
  })

  it('opens already open when it was left open', () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    renderBar()
    expect(screen.getByText('In the drawer')).toBeTruthy()
  })

  it('opens the door behind a chip, and the deposits window from the shelf', () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    const { onDoor, onOpenDeposits } = renderBar()
    fireEvent.click(screen.getByRole('button', { name: /Riverbend Office Park, \$6,300: Open the job/ }))
    expect(onDoor).toHaveBeenCalledTimes(1)
    expect(onDoor.mock.calls[0]![0].jobId).toBe('job-inv:riverbend')
    fireEvent.click(screen.getByRole('button', { name: 'Open deposits →' }))
    expect(onOpenDeposits).toHaveBeenCalledTimes(1)
  })

  it('leaves the Banking door off for a role that cannot open Banking', () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    renderBar({ canOpenBanking: false })
    expect(screen.getByText('Card money')).toBeTruthy()
    expect(screen.queryByText('Open Banking →')).toBeNull()
  })

  it('shows the Banking door to a role that can open it', () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    renderBar({ canOpenBanking: true })
    expect(screen.getByText('Open Banking →')).toBeTruthy()
  })

  it('names a source it could not read, and keeps the rest', () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    renderBar({ failed: ['stripe'] })
    expect(screen.getByText("Couldn't read Stripe. The rest is live.")).toBeTruthy()
    expect(screen.getByText('Riverbend Office Park')).toBeTruthy()
  })

  it('says it is reading before the week arrives', () => {
    renderBar({ view: null, loading: true })
    expect(screen.getByRole('status').textContent).toContain('reading the week')
  })

  it('stacks only the days with money on a phone', () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    phone.on = true
    renderBar()
    expect(screen.getByText(/Tue 27/)).toBeTruthy()
    expect(screen.queryByText(/Thu 29/)).toBeNull()
  })

  it('turns a word or a pace chip into the pen, and keeps the job door beside it', () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    const onPen = vi.fn<(row: MoneyInRow) => void>()
    const { onDoor } = renderBar({ onPen })
    expect(screen.getAllByRole('button', { name: 'New date ›' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /New date for Riverbend Office Park, \$6,300/ }))
    expect(onPen).toHaveBeenCalledTimes(1)
    expect(onPen.mock.calls[0]![0].kind).toBe('pace')
    const doors = screen.getAllByRole('button', { name: 'Open the job →' })
    expect(doors).toHaveLength(2)
    fireEvent.click(doors[0]!)
    expect(onDoor).toHaveBeenCalledTimes(1)
    expect(onPen).toHaveBeenCalledTimes(1)
  })

  it('says where a chip the pen moved came from', () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    renderBar({ onPen: vi.fn(), moved: new Map([['job-inv:riverbend', 'was Tue, by pace']]) })
    expect(screen.getByText('was Tue, by pace')).toBeTruthy()
  })
})

describe('DashboardMoneyInStrip, wired', () => {
  it('opens Write down their word from a pace chip, with quick days and where the day stands', async () => {
    localStorage.setItem(MONEY_IN_OPEN_KEY, '1')
    hook.state = { view: week(), failed: [], loading: false, readAtIso: null, refresh: vi.fn() }
    renderWithProviders(<DashboardMoneyInStrip ar={[]} collections={[]} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /New date for Riverbend Office Park, \$6,300/ }))
    await settle()
    expect(screen.getByRole('heading', { name: 'Write down their word' })).toBeTruthy()
    expect(screen.getByText('Riverbend Office Park · $6,300 open')).toBeTruthy()
    expect(screen.getByText('Now a guess from their usual pace: Tue Oct 27.')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Quick days' }).textContent).toBe('Tue 27Wed 28Thu 29Mon Nov 2')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Write down their word' })).toBeNull()
  })
})

