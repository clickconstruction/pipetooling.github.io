// @vitest-environment jsdom
/**
 * The Lien desk's Months card as the ledger (punch list #361): one card, read top to bottom. The
 * last day of work is its first row with no box of its own, one lead line stands where the paragraph
 * was, the grid keeps every hook the gates and the desk find it by, the money is one block (the claim
 * as the total line, the bills as its lines), and the quiet rows close it. Every door still opens.
 * jsdom lays nothing out, so the widths and the phone's stack are measured in a browser; this holds
 * the order, the words, the hooks and the presses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienDeskMonths from './LienDeskMonths'
import LienClaimBox from './LienClaimBox'
import LienClaimBills from './LienClaimBills'
import { LienLastWorkDayLine } from './LienLastWorkDayLine'
import type { LienGridPaper, LienGridRow, LienMonthGrid } from '../../lib/jobs/lienMonthGrid'
import type { LienClaimBill } from '../../lib/jobs/lienClaimBills'

vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) }) } }))

afterEach(cleanup)

const TODAY = '2026-11-19'

function row(month: string, over: Omit<Partial<LienGridRow>, 'window'> & { window?: Partial<LienGridRow['window']> } = {}): LienGridRow {
  const { window: w, ...rest } = over
  return {
    month,
    hours: 40,
    crew: '3 people · 4 days',
    fromCreation: false,
    pendingOnly: false,
    cells: { this: 'blank' },
    thisNotice: { on: false, locked: false, info: false, late: false },
    ...rest,
    window: { state: 'open', deadline: '2026-12-15', daysLeft: 26, noticed: false, noted: false, notedBy: '', notedAt: '', skipped: false, skipReason: '', skippedBy: '', ...w },
  }
}

const paperA: LienGridPaper = { key: 'f1', letter: 'A', kind: 'filing', sentOn: '2026-10-14', byHand: false, amount: 15_722, printedClaim: null, packetOthers: 0, months: ['2026-06'], method: 'certified_mail', documentUrl: '', documentNote: '', pile: '' }
const thisPaper = (letter: string, months: string[]): LienGridPaper => ({ key: 'this', letter, kind: 'this', sentOn: '', byHand: false, amount: 0, printedClaim: null, packetOthers: 0, months, method: '', documentUrl: '', documentNote: '', pile: 'to_draft' })

/** An earlier paper A that named June after its window, July missed and not noted, August missed and named as information, September open and ticked. */
function fullGrid(): LienMonthGrid {
  return {
    papers: [paperA, thisPaper('B', ['2026-08', '2026-09'])],
    rows: [
      row('2026-06', { cells: { f1: 'info', this: 'blank' }, thisNotice: { on: false, locked: true, info: false, late: false }, window: { state: 'closed', deadline: '2026-09-15', daysLeft: -65, noticed: true } }),
      row('2026-07', { cells: { f1: 'blank', this: 'blank' }, thisNotice: { on: false, locked: true, info: false, late: false }, window: { state: 'closed', deadline: '2026-10-15', daysLeft: -35 } }),
      row('2026-08', { cells: { f1: 'blank', this: 'info' }, thisNotice: { on: true, locked: true, info: true, late: false }, window: { state: 'closed', deadline: '2026-11-16', daysLeft: -3 } }),
      row('2026-09', { cells: { f1: 'blank', this: 'named' }, thisNotice: { on: true, locked: false, info: false, late: false } }),
    ],
    earliestOpen: '2026-12-15',
    lateUntil: null,
  }
}

const BILLS: LienClaimBill[] = [
  { invoiceId: 'inv-1', number: '#41', what: 'Rough In', sentYmd: '2026-07-15', stripe: false, dueYmd: '', billed: 26_800, paid: 26_800, owed: 0 },
  { invoiceId: 'inv-2', number: '#42', what: 'Top Out', sentYmd: '2026-09-10', stripe: true, dueYmd: '2026-09-25', billed: 6_700, paid: 5_700, owed: 1_000 },
]

function mount(grid: LienMonthGrid, over: Partial<Parameters<typeof LienDeskMonths>[0]> = {}) {
  const doors = { onToggle: vi.fn(), onNoteMissed: vi.fn(), onRecordByHand: vi.fn(), onSetRetainage: vi.fn(), onBill: vi.fn(), onSaveClaim: vi.fn(), onClearClaim: vi.fn(), onSavedDay: vi.fn() }
  renderWithProviders(
    <LienDeskMonths
      headless
      grid={grid}
      claim="$1,000"
      onToggle={doors.onToggle}
      onNoteMissed={doors.onNoteMissed}
      onRecordByHand={doors.onRecordByHand}
      lastWork={<LienLastWorkDayLine flat jobId="j1" job={{ last_work_date: '2026-09-08' }} todayYmd={TODAY} canEdit userId="u1" onSaved={doors.onSavedDay} />}
      claimNode={(foot) => <LienClaimBox foot={foot} balance={1_000} correction={null} months={['2026-08', '2026-09']} office busy={false} onSave={doors.onSaveClaim} onClear={doors.onClearClaim} />}
      claimTail={
        <span data-lien-claim-retainage="unset">
          Retainage the GC holds: not recorded.
          <button type="button" onClick={doors.onSetRetainage}>Set on the job ›</button>
        </span>
      }
      bills={<LienClaimBills bills={BILLS} unbilled={4_000} revenue={37_500} loading={false} onBill={doors.onBill} />}
      {...over}
    />,
  )
  return { doors, card: document.querySelector('[data-lien-desk-months]') as HTMLElement }
}

describe('LienDeskMonths, the ledger (#361)', () => {
  it('is one card in one order: the last day of work, the lead line, the grid, the missed line, the money, the quiet rows', () => {
    const { card } = mount(fullGrid())
    const parts = Array.from(card.children).map((el) => {
      const e = el as HTMLElement
      if (e.matches('[data-lien-ledger-last-work]')) return 'last work'
      if (e.matches('[data-lien-ledger-lead]')) return 'lead'
      if (e.querySelector('table')) return 'grid'
      if (e.matches('[data-lien-months-missed]')) return 'missed'
      if (e.matches('[data-lien-ledger-money]')) return 'money'
      return 'quiet'
    })
    expect(parts).toEqual(['last work', 'lead', 'grid', 'missed', 'money', 'quiet', 'quiet', 'quiet', 'quiet'])
    // The last day of work has no box of its own: it is the card's first row.
    const line = screen.getByTestId('lien-last-work')
    expect(line.getAttribute('data-flat')).toBe('yes')
    expect((line.firstElementChild as HTMLElement).style.border).toBe('')
    expect((line.firstElementChild as HTMLElement).style.background).toBe('')
    expect(screen.getByTestId('lien-last-work-day').textContent).toBe('Sep 8')
    // One lead line where the paragraph was; the second sentence only because an earlier paper is on the job.
    expect((card.querySelector('[data-lien-ledger-lead]') as HTMLElement).textContent).toBe('Tick a month to put it on this notice. A check is a paper that already names the month.')
    expect(card.textContent).not.toContain('Every month worked, oldest first.')
    // The quiet rows, in their order, with the words they had.
    const quiet = Array.from(card.querySelectorAll(':scope > .lienLedgerQuiet:not([data-lien-months-missed])')).map((e) => e.textContent)
    expect(quiet).toEqual([
      'Retainage the GC holds: not recorded.Set on the job ›',
      'A paper that went out by hand? Record it… — it becomes a column here.',
      'One notice can cover several months. Dec 15 is the date this one has to beat.',
      'Aug closed with nothing sent — named on this notice as information only.',
    ])
  })

  it('the grid keeps its hooks: a row a month, a missed month marked and red by its own attribute, an earlier paper lettered in its cell', () => {
    const { card } = mount(fullGrid())
    const rows = Array.from(card.querySelectorAll('[data-lien-grid-row]')) as HTMLElement[]
    expect(rows.map((r) => r.getAttribute('data-lien-grid-row'))).toEqual(['2026-06', '2026-07', '2026-08', '2026-09'])
    // Red means late and nothing else: only the two months whose window closed with nothing sent.
    expect(rows.map((r) => r.getAttribute('data-missed') ?? 'no')).toEqual(['no', 'yes', 'yes', 'no'])
    expect(rows.map((r) => r.getAttribute('data-on'))).toEqual(['no', 'no', 'yes', 'yes'])
    // A closed month is one line (v2.7430); the open one keeps two.
    expect(rows.map((r) => (r.querySelector('td.lienMonthOne') ? 'one' : 'two'))).toEqual(['one', 'one', 'one', 'two'])
    // The window on one line: a chip where the state changes, the rest faint words beside it.
    expect((rows[3]!.querySelector('.lienLedgerWindow') as HTMLElement).textContent).toBe('mail by Dec 1526 days left')
    // The heads: the papers lettered, this notice the name alone (the total is at the foot).
    expect((card.querySelector('[data-lien-grid-paper="A"]') as HTMLElement).textContent).toBe('ASent Oct 14$15,722 · certified mail')
    expect((card.querySelector('[data-lien-grid-paper="this"]') as HTMLElement).textContent).toBe('BThis notice')
    // June's cell under paper A carries the letter with its check, for the narrow card where the column is gone.
    const june = rows[0]!.querySelector('td[data-col="paper"]') as HTMLElement
    expect(june.getAttribute('data-cell')).toBe('info')
    expect(june.textContent).toBe('A✓ as information')
    expect((rows[1]!.querySelector('td[data-col="paper"]') as HTMLElement).textContent).toBe('')
    // What a missed window costs is said once, under the grid.
    expect((card.querySelector('[data-lien-months-missed]') as HTMLElement).textContent).toBe('closed Jul, Aug · lien right gone · the money still rides')
  })

  it('the money is one block: the claim is the total line with the months it names under the figure, the bills are its lines', () => {
    const { card } = mount(fullGrid())
    const money = card.querySelector('[data-lien-ledger-money]') as HTMLElement
    expect(Array.from(money.children).map((e) => (e.matches('[data-lien-claim-box]') ? 'claim' : e.matches('[data-lien-claim-bills]') ? 'bills' : '?'))).toEqual(['claim', 'bills'])
    const claim = money.querySelector('[data-lien-claim-box]') as HTMLElement
    expect(claim.classList.contains('lienLedgerClaim')).toBe(true)
    expect(claim.textContent).toBe('Claim amount on the notice$1,000 Still unpaid on this jobCorrect the claim ›This notice names Aug, Sep · 2 months')
    expect((claim.querySelector('[data-lien-grid-foot]') as HTMLElement).textContent).toBe('This notice names Aug, Sep · 2 months')
    // The figure is said once on the card: no second total in the grid.
    expect(card.querySelector('tfoot')).toBeNull()
    expect(card.textContent?.match(/\$1,000(?!\.)/g)).toHaveLength(1)
    const bills = money.querySelector('[data-lien-claim-bills]') as HTMLElement
    expect(Array.from(bills.querySelectorAll('[data-lien-claim-bill]')).map((b) => b.getAttribute('data-lien-claim-bill'))).toEqual(['inv-1', 'inv-2'])
    expect((bills.querySelector('[data-lien-claim-bill="inv-2"]') as HTMLElement).textContent).toContain('Owed$1,000.00')
    expect((bills.querySelector('[data-lien-claim-unbilled]') as HTMLElement).textContent).toContain('Not billed yet')
  })

  it('every door still opens, and looking saves nothing', () => {
    const { card, doors } = mount(fullGrid())
    // Tick a month.
    fireEvent.click(screen.getByRole('checkbox', { name: /^Sep(tember)? 2026$/ }))
    expect(doors.onToggle).toHaveBeenCalledWith('2026-09', false)
    // Note it as missed, on the month nobody noted.
    const presses = Array.from(card.querySelectorAll('[data-lien-desk-note-missed]')) as HTMLButtonElement[]
    expect(presses).toHaveLength(2)
    fireEvent.click(presses[0]!)
    expect(doors.onNoteMissed).toHaveBeenCalledWith('2026-07')
    // Record it…
    fireEvent.click(card.querySelector('[data-lien-desk-by-hand]') as HTMLButtonElement)
    expect(doors.onRecordByHand).toHaveBeenCalledTimes(1)
    // Set on the job ›
    fireEvent.click(screen.getByRole('button', { name: 'Set on the job ›' }))
    expect(doors.onSetRetainage).toHaveBeenCalledTimes(1)
    // Bill it from here ›
    fireEvent.click(card.querySelector('[data-lien-bill-from-here]') as HTMLButtonElement)
    expect(doors.onBill).toHaveBeenCalledTimes(1)
    // Change › opens the day's editor in the row; Cancel closes it.
    fireEvent.click(screen.getByTestId('lien-last-work-change'))
    const editor = screen.getByTestId('lien-last-work-editor')
    fireEvent.click(within(editor).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('lien-last-work-editor')).toBeNull()
    // Correct the claim › opens the claim's editor in the money block; Cancel closes it.
    fireEvent.click(screen.getByRole('button', { name: 'Correct the claim ›' }))
    const claimEditor = card.querySelector('[data-lien-claim-editor]') as HTMLElement
    expect(claimEditor.closest('[data-lien-ledger-money]')).toBeTruthy()
    fireEvent.click(within(claimEditor).getByRole('button', { name: 'Cancel' }))
    expect(card.querySelector('[data-lien-claim-box]')).toBeTruthy()
    expect(doors.onSaveClaim).not.toHaveBeenCalled()
    expect(doors.onClearClaim).not.toHaveBeenCalled()
    expect(doors.onSavedDay).not.toHaveBeenCalled()
  })

  it('with no earlier paper the lead line is the one sentence, and a reader with no doors sees none', () => {
    const grid: LienMonthGrid = { papers: [thisPaper('A', ['2026-09'])], rows: [row('2026-09', { cells: { this: 'named' }, thisNotice: { on: true, locked: false, info: false, late: false } })], earliestOpen: '2026-12-15', lateUntil: null }
    const { card } = mount(grid, { onNoteMissed: undefined, onRecordByHand: undefined, claimTail: undefined, claimNode: undefined, bills: undefined, lastWork: undefined })
    expect((card.querySelector('[data-lien-ledger-lead]') as HTMLElement).textContent).toBe('Tick a month to put it on this notice.')
    expect(card.querySelector('[data-lien-months-missed]')).toBeNull()
    expect(card.querySelector('[data-lien-desk-by-hand]')).toBeNull()
    expect(card.querySelectorAll(':scope > .lienLedgerQuiet')).toHaveLength(0)
    // The plain figure draws the same total line.
    expect((card.querySelector('.lienLedgerClaim') as HTMLElement).textContent).toBe('Claim amount on the notice$1,000Still unpaid on this jobThis notice names Sep · 1 month')
  })

  it('a job with no months says so through EmptyState, with no grid and no lead line', () => {
    const { card } = mount({ papers: [thisPaper('A', [])], rows: [], earliestOpen: null, lateUntil: null })
    expect((card.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('No months on this job yet.')
    expect(card.querySelector('table')).toBeNull()
    expect(card.querySelector('[data-lien-ledger-lead]')).toBeNull()
    // The row above the empty words is the next step: the last day of work and its Change ›.
    expect(card.firstElementChild?.matches('[data-lien-ledger-last-work]')).toBe(true)
    expect(screen.getByTestId('lien-last-work-change')).toBeTruthy()
  })
})
