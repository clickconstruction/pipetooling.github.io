// @vitest-environment jsdom
/**
 * People → HR → Waiting on you (punch list #315, upgrade 3a): the plans an agent kept for a yes, as words, oldest
 * first, a stale one under them with why, narrowed to one person on that person's file, and no press that applies
 * anything. Made-up people and words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { HrKeptPlansSection } from './HrKeptPlansSection'
import { loadKeptPlans } from '../../lib/people/keptPlansIo'
import type { KeptPlanRow } from '../../lib/people/keptPlans'

const row = (over: Partial<KeptPlanRow> & { id: string }): KeptPlanRow => ({ person_id: 'p-pat', verb: 'plan_hr_entry', words: 'One entry dated Nov 3, 2026, as an incident.', author_label: 'Robert', session_label: 'morning session', kept_at: '2026-11-10T16:00:00.000Z', state: 'waiting', decided_label: null, decided_at: null, decided_why: null, ...over })
const ROWS: KeptPlanRow[] = [
  row({ id: 'k2', person_id: 'p-sam', verb: 'plan_person_doc', words: 'One line added to the narrative.', kept_at: '2026-11-12T16:00:00.000Z', session_label: null }),
  row({ id: 'k1' }),
  row({ id: 'k3', verb: 'plan_person_doc', words: 'Section 2 rewritten.', state: 'stale', decided_at: '2026-11-12T18:00:00.000Z', decided_label: 'Robert', decided_why: 'The document was saved after this plan was made.' }),
]

vi.mock('../../lib/people/keptPlansIo', () => ({ loadKeptPlans: vi.fn(async () => ({ rows: [] as KeptPlanRow[], heldWhy: null })) }))

// Today is Nov 12, 2026 on the app's calendar: only the clock's reading is held, so the waits below still run.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-12T20:00:00.000Z'), toFake: ['Date'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

const names: Record<string, string> = { 'p-pat': 'Pat Sample', 'p-sam': 'Sam Sample' }
const section = (personId: string | null, onOpenPerson = vi.fn()) => <HrKeptPlansSection personId={personId} nameForPerson={(id) => names[id] ?? 'this person'} onOpenPerson={onOpenPerson} />

describe('HrKeptPlansSection · Waiting on you (punch list #315)', () => {
  it('lists every file’s waiting plans oldest first, then the stale one with why, and opens a person from a row', async () => {
    vi.mocked(loadKeptPlans).mockResolvedValue({ rows: ROWS, heldWhy: null })
    const onOpenPerson = vi.fn()
    render(section(null, onOpenPerson))
    const list = await screen.findByTestId('hr-kept-plans')
    expect(within(list).getByText('Waiting on you (2)')).toBeTruthy()
    const items = within(list).getAllByRole('listitem')
    expect(items.map((li) => li.getAttribute('data-testid'))).toEqual(['kept-plan-k1', 'kept-plan-k2', 'kept-plan-k3'])
    // The oldest has waited two calendar days and says who kept it, from which session.
    expect(items[0]!.textContent).toContain('Pat Sample')
    expect(items[0]!.textContent).toContain('an HR entry')
    expect(items[0]!.textContent).toContain('waiting 2 days')
    expect(items[0]!.textContent).toContain('Kept by Robert’s agent, morning session, Nov 10, 2026')
    expect(items[0]!.textContent).toContain('One entry dated Nov 3, 2026, as an incident.')
    expect(items[1]!.textContent).toContain('waiting today')
    expect(items[2]!.textContent).toContain('no longer matches')
    expect(items[2]!.textContent).toContain('The document was saved after this plan was made. The agent plans again.')
    fireEvent.click(within(items[1]!).getByRole('button', { name: 'Sam Sample' }))
    expect(onOpenPerson).toHaveBeenCalledWith('p-sam')
  })

  it('words only: the only presses are the people’s names, and nothing applies or drops a plan', async () => {
    vi.mocked(loadKeptPlans).mockResolvedValue({ rows: ROWS, heldWhy: null })
    render(section(null))
    const list = await screen.findByTestId('hr-kept-plans')
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Pat Sample', 'Sam Sample', 'Pat Sample'])
    expect(within(list).queryByRole('button', { name: /apply|drop/i })).toBeNull()
  })

  it('on a person’s file it is that person’s alone and says how many wait on other files', async () => {
    vi.mocked(loadKeptPlans).mockResolvedValue({ rows: ROWS, heldWhy: null })
    render(section('p-pat'))
    const list = await screen.findByTestId('hr-kept-plans')
    expect(within(list).getByText('Waiting on you (1)')).toBeTruthy()
    expect(within(list).getAllByRole('listitem').map((li) => li.getAttribute('data-testid'))).toEqual(['kept-plan-k1', 'kept-plan-k3'])
    expect(within(list).getByText('An HR entry')).toBeTruthy()
    // The one press is the other file's person: on a wide screen an open file hides the list of every file.
    const onOpenPerson = vi.fn()
    cleanup()
    render(section('p-pat', onOpenPerson))
    const elsewhere = await screen.findByTestId('hr-kept-plans-elsewhere')
    expect(elsewhere.textContent).toBe('1 more waits on other files: Sam Sample')
    expect(within(screen.getByTestId('hr-kept-plans')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sam Sample'])
    fireEvent.click(within(elsewhere).getByRole('button', { name: 'Sam Sample' }))
    expect(onOpenPerson).toHaveBeenCalledWith('p-sam')
  })

  it('on a file with no plan of its own it still says a plan waits on another file (v2.8071)', async () => {
    vi.mocked(loadKeptPlans).mockResolvedValue({ rows: [row({ id: 'k1' })], heldWhy: null })
    const onOpenPerson = vi.fn()
    render(section('p-sam', onOpenPerson))
    const list = await screen.findByTestId('hr-kept-plans')
    expect(within(list).queryAllByRole('listitem')).toEqual([])
    expect(screen.getByTestId('hr-kept-plans-elsewhere').textContent).toBe('1 plan waits on other files: Pat Sample')
    fireEvent.click(within(list).getByRole('button', { name: 'Pat Sample' }))
    expect(onOpenPerson).toHaveBeenCalledWith('p-pat')
  })

  it('draws nothing when nothing waits', async () => {
    vi.mocked(loadKeptPlans).mockResolvedValue({ rows: [], heldWhy: null })
    const { container } = render(section(null))
    await vi.waitFor(() => expect(loadKeptPlans).toHaveBeenCalledTimes(1))
    expect(container.innerHTML).toBe('')
  })

  it('says so with the reason when the read fails, and reads again on the press (v2.8071)', async () => {
    vi.mocked(loadKeptPlans).mockResolvedValue({ rows: [], heldWhy: 'the list timed out' })
    render(section(null))
    const held = await screen.findByTestId('hr-kept-plans-held')
    expect(held.textContent).toBe('Waiting on you could not be read: the list timed out Read it again')
    expect(screen.queryByTestId('hr-kept-plans')).toBeNull()
    vi.mocked(loadKeptPlans).mockResolvedValue({ rows: ROWS, heldWhy: null })
    fireEvent.click(within(held).getByRole('button', { name: 'Read it again' }))
    const list = await screen.findByTestId('hr-kept-plans')
    expect(within(list).getByText('Waiting on you (2)')).toBeTruthy()
    expect(screen.queryByTestId('hr-kept-plans-held')).toBeNull()
  })
})
