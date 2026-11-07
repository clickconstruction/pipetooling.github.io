// @vitest-environment jsdom
/**
 * Render smoke for punch list #217, jobs-money-3 (a prototype): the Team queue's *Day strip*
 * switch. Off by default, the day card reads as before: no strip, no place on a line, the picker
 * in its old order. On, each card draws the holder's day, a swipe inside the session's bar gets a
 * chip that names the job and leads its picker, a swipe after clock-out gets the gap in words and
 * leads nothing, a tick's press goes to its line, and the switch is remembered per person on the
 * device. The sorter's rules, the likely marks and the writes are untouched. Made-up names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { TallyTeamQueueReads } from '../../lib/tally/fetchTallyTeamQueue'
import type { StaleStaffRow } from '../../lib/tally/teamPurchaseRows'
import type { CardChargeWindowRow } from '../../lib/banking/cardChargesWindow'
import { tallyDayStripStorageKey } from '../../lib/tally/tallyDayStrip'

const rpc = vi.fn()

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args), from: () => ({}) } }))
vi.mock('../../hooks/useOverheadOfficeJobId', () => ({ useOverheadOfficeJobId: () => 'job-office' }))
vi.mock('../../hooks/useMercuryLedgerNicknames', () => ({
  useMercuryLedgerNicknames: () => ({ nicknameByAccount: {}, nicknameByDebitCard: {} }),
}))
vi.mock('../../hooks/useStaleTallyStaffFollowUp', () => ({
  useStaleTallyStaffFollowUp: () => ({ peopleCount: 1, transactionCount: 1, refetch: vi.fn(async () => {}) }),
}))
vi.mock('../MercuryTransactionAllocationsModal', () => ({ MercuryTransactionAllocationsModal: () => null }))
vi.mock('../MercuryTransactionInvoiceLinkModal', () => ({ default: () => null }))
vi.mock('../pay/PersonOffsetFormModal', () => ({ PersonOffsetFormModal: () => null }))

const at = (hm: string, day = '2026-09-30') => `${day}T${hm}:00-05:00`
const staffRow = (id: string, hm: string, amount: number, store: string, cat: string): StaleStaffRow =>
  ({
    target_user_id: 'u-ann',
    target_name: 'Ann',
    target_email: '',
    target_phone: '',
    mercury_transaction_id: id,
    posted_at: at(hm),
    amount,
    counterparty_name: store,
    note: '',
    mercury_account_id: 'acct',
    currency: 'USD',
    mercury_id: `m-${id}`,
    raw: { mercuryCategory: cat, createdAt: new Date(at(hm)).toISOString() },
    job_splits: [],
  }) as StaleStaffRow

/** Ann's last Ridge Supply charge, ten days before, went to another job: the line's own chip. */
const ridgeHistory: CardChargeWindowRow = {
  id: 't-old',
  postedAt: at('12:00', '2026-09-20'),
  purchasedAt: at('11:30', '2026-09-20'),
  amount: -40,
  counterpartyName: 'Ridge Supply',
  kind: 'debitCardTransaction',
  status: 'sent',
  bankCategory: null,
  debitCardId: 'card',
  cardNickname: null,
  cardRole: null,
  holderUserId: 'u-ann',
  holderName: 'Ann',
  attributedUserId: null,
  attributedPersonId: null,
  labelId: null,
  labelDefaultKey: null,
  payrollMarked: false,
  splits: [{ jobId: 'job-b', amount: -40, hcpNumber: null, clickNumber: null, jobName: null, serviceTypeId: null }],
  invoiceLinks: [],
  sortedAt: at('18:00', '2026-09-20'),
  sortedByName: 'Bea',
  viewerCanSort: true,
} as CardChargeWindowRow

// A swipe at 9:15 inside the 7:10 to 4:40 session, and one at 7:40 PM, three hours after clock-out.
const READS: TallyTeamQueueReads = {
  queue: [staffRow('t-parts', '09:15', -88.2, 'Ridge Supply', 'Retail'), staffRow('t-fuel', '19:40', -31.47, 'Corner Fuel', 'FuelAndGas')],
  history: [ridgeHistory],
  sessions: [{ user_id: 'u-ann', work_date: '2026-09-30', job_ledger_id: 'job-a', clocked_in_at: at('07:10'), clocked_out_at: at('16:40') }],
  schedule: [{ assignee_user_id: 'u-ann', work_date: '2026-09-30', job_id: 'job-a', time_start: '07:00:00', time_end: '15:30:00' }],
}

vi.mock('../../lib/tally/fetchTallyTeamQueue', () => ({
  TALLY_TEAM_SORTED_WINDOW_DAYS: 30,
  fetchTallyTeamQueue: vi.fn(async () => READS),
  fetchRecentlySortedTeamPurchases: vi.fn(async () => []),
  fetchTallyJobLabels: vi.fn(async () => ({ 'job-a': 'JP101 · Hill Street', 'job-b': 'JP202 · Oak Lane', 'job-office': '000 · Office' })),
}))

const { TallyTeamQueue } = await import('./TallyTeamQueue')

const STORAGE_KEY = tallyDayStripStorageKey(SMOKE_AUTH_USER_ID)

const pickerOptions = (line: HTMLElement) => [...within(line).getByRole('combobox').querySelectorAll('option')].map((o) => o.textContent)
const linesByStore = (card: HTMLElement) => {
  const lines = within(card).getAllByTestId('tally-team-line')
  const find = (store: string) => lines.find((l) => l.textContent?.includes(store))!
  return { parts: find('Ridge Supply'), fuel: find('Corner Fuel') }
}

const openCard = async () => {
  renderWithProviders(<TallyTeamQueue />)
  const card = await screen.findByTestId('tally-team-day-card')
  await settle()
  await screen.findAllByText(/JP101 · Hill Street/)
  return card
}

beforeEach(() => {
  rpc.mockReset()
  localStorage.clear()
})

describe('TallyTeamQueue, the Day strip switch', () => {
  it('is off by default: the card reads as before, with no strip, no place on a line and the old picker order', async () => {
    const card = await openCard()
    const toggle = screen.getByTestId('tally-team-day-strip-toggle')
    expect(toggle.textContent).toBe('Day strip')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(within(card).queryByTestId('tally-day-strip')).toBeNull()
    expect(within(card).queryAllByTestId('tally-team-place')).toHaveLength(0)
    const { parts, fuel } = linesByStore(card)
    expect(pickerOptions(parts)).toEqual(['Pick a job', 'JP202 · Oak Lane', 'JP101 · Hill Street', '000 · Office'])
    expect(pickerOptions(fuel)).toEqual(['Pick a job', 'JP101 · Hill Street', '000 · Office'])
    expect(within(card).getByTestId('tally-team-evidence').textContent).toContain('Clocked on JP101 Hill Street from 7:10 AM to 4:40 PM.')
  })

  it('on, draws the day, places each swipe, leads the inside line’s picker and leaves the gap line’s alone', async () => {
    const card = await openCard()
    fireEvent.click(screen.getByTestId('tally-team-day-strip-toggle'))
    expect(screen.getByTestId('tally-team-day-strip-toggle').getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')

    const strip = within(card).getByTestId('tally-day-strip')
    expect(strip.getAttribute('aria-label')).toBe('Ann’s day, 6:00 AM to 8:00 PM')
    const bars = within(strip).getAllByTestId('tally-day-strip-bar')
    expect(bars.map((b) => [b.getAttribute('data-kind'), b.getAttribute('data-job'), b.textContent])).toEqual([
      ['scheduled', 'job-a', ''],
      ['clocked', 'job-a', 'JP101'],
    ])
    const ticks = within(strip).getAllByTestId('tally-day-strip-tick')
    expect(ticks.map((t) => [t.getAttribute('data-place'), t.getAttribute('aria-label')])).toEqual([
      ['inside', '9:15 AM, $88.20, in JP101’s hours'],
      ['after', '7:40 PM, $31.47, 3 h after clock-out'],
    ])
    expect(strip.textContent).toContain('6 AM')
    expect(strip.textContent).toContain('noon')
    expect(strip.textContent).toContain('8 PM')

    const { parts, fuel } = linesByStore(card)
    const insidePlace = within(parts).getByTestId('tally-team-place')
    expect(insidePlace.tagName).toBe('BUTTON')
    expect(insidePlace.textContent).toBe('JP101 · Hill Streetin JP101’s hours')
    expect(insidePlace.getAttribute('aria-pressed')).toBe('false')
    expect(pickerOptions(parts)).toEqual(['Pick a job', 'JP101 · Hill Street', 'JP202 · Oak Lane', '000 · Office'])

    const gapPlace = within(fuel).getByTestId('tally-team-place')
    expect(gapPlace.tagName).toBe('SPAN')
    expect(gapPlace.textContent).toBe('3 h after clock-out')
    expect(pickerOptions(fuel)).toEqual(['Pick a job', 'JP101 · Hill Street', '000 · Office'])

    // The day's chips keep their words and their likely mark; the sentence stays under the strip.
    const chips = within(card).getAllByTestId('tally-team-chip')
    expect(chips[0]!.getAttribute('data-rule')).toBe('clock-one-job')
    expect(chips[0]!.textContent).toContain('likely')
    expect(within(card).getByTestId('tally-team-evidence').textContent).toContain('Clocked on JP101 Hill Street from 7:10 AM to 4:40 PM.')
    for (const c of chips) expect(c.getAttribute('aria-pressed')).toBe('false')
    expect((within(card).getByTestId('tally-team-sort-day') as HTMLButtonElement).disabled).toBe(true)
  })

  it('the inside chip picks that job for its line alone; a tick’s press goes to the line', async () => {
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    const card = await openCard()
    fireEvent.click(screen.getByTestId('tally-team-day-strip-toggle'))
    const { parts } = linesByStore(card)
    fireEvent.click(within(parts).getByTestId('tally-team-place'))
    expect(within(parts).getByTestId('tally-team-place').getAttribute('aria-pressed')).toBe('true')
    expect(parts.textContent).toContain('Goes to JP101 · Hill Street.')
    expect(within(card).getByTestId('tally-team-sort-day').textContent).toBe('Sort 1 charge')

    const [, fuelTick] = within(card).getAllByTestId('tally-day-strip-tick')
    fireEvent.click(fuelTick!)
    expect(scrolled).toHaveBeenCalledTimes(1)
    const { fuel } = linesByStore(card)
    expect(document.activeElement).toBe(fuel)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('is remembered per person on the device, and off again takes the strip away', async () => {
    localStorage.setItem(STORAGE_KEY, '1')
    const card = await openCard()
    expect(within(card).getByTestId('tally-day-strip')).toBeTruthy()
    fireEvent.click(screen.getByTestId('tally-team-day-strip-toggle'))
    expect(within(card).queryByTestId('tally-day-strip')).toBeNull()
    expect(within(card).queryAllByTestId('tally-team-place')).toHaveLength(0)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0')
  })
})
