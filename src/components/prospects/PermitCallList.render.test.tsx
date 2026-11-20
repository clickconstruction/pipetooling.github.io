// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BuilderRow } from '../../lib/research/permitBuilders'
import type { MarketPermit } from '../../lib/research/permitMarket'
import type { ResearchPermitRow } from '../../lib/research/permitResearch'
import { callChips, callRows, foldCallAnswers, type CallAnswerRow, type CallStanding } from '../../lib/research/permitCallList'
import { foldLookups, type LookupCheckRow, type LookupRow } from '../../lib/research/builderLookups'

/**
 * Permits, Market: the call list (punch list #405, step two). Five names with their reasons, the
 * chips over them, the jobs open now, Ask for as an empty state, and the three presses. Pursue
 * makes the lead the skim makes and takes the name off. Not for us takes it off. Put back undoes
 * either. Every company, person, address and number here is made up.
 */
const research = vi.hoisted(() => ({ approachFromPermit: vi.fn(), loadPermitsOfBuilder: vi.fn(), recordVerdict: vi.fn() }))
const marketIo = vi.hoisted(() => ({ recordCallAnswer: vi.fn(), recordLookupCheck: vi.fn() }))
vi.mock('../../lib/research/permitResearchIo', () => research)
vi.mock('../../lib/research/permitMarketIo', () => marketIo)

import { PermitCallList } from './PermitCallList'

const TODAY = '2026-11-19'

function builder(key: string, contact: string, over: Partial<BuilderRow> = {}): BuilderRow {
  return { key, name: null, sample_contact: contact, kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 0, open: 0, last_permit_on: null, plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null, ...over }
}
function issued(key: string, day: string, n = 1): MarketPermit[] {
  return Array.from({ length: n }, () => ({ builder_key: key, stage: 'issued', work_type: 'Commercial remodel', submitted_on: null, issued_on: day, declared_value: null, address_key: null }))
}
function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1',
    city: 'San Antonio',
    source: 'sa-applied',
    permit_number: 'COM-PRJ-APP26-00000001',
    permit_type: 'Commercial Project Application',
    stage: 'applied',
    residential: false,
    work_type: 'Commercial project',
    project_name: null,
    address: '2100 SAMPLE PKWY',
    zip: '78201',
    lat: null,
    lng: null,
    submitted_on: '2026-11-04',
    issued_on: null,
    filed_on: '2026-11-04',
    declared_value: 600_000,
    area_sf: null,
    contact: 'Ridgeway Builders',
    plumber: null,
    plumber_permit_on: null,
    verdict: null,
    verdict_reason: null,
    verdict_look_again_on: null,
    verdict_prospect_id: null,
    verdict_by: null,
    verdict_by_name: null,
    verdict_at: null,
    builder_key: 'ridgewaybuilders',
    ...over,
  }
}

const NAMES = ['Ridgeway Builders', 'Tall Pine Builders LLC', 'Juniper Hospitality Group', 'Harbor Fitouts Construction', 'Lime Build Contractors', 'Aster Ridge Contracting', 'Larkspur Builders']
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/llc$/, '')
const BUILDERS: BuilderRow[] = [...NAMES.map((n) => builder(key(n), n)), builder('quillpermits', 'Quill Permits')].map((b) => (b.key === 'juniperhospitalitygroup' ? { ...b, bids: 4, won: 0, last_bid_on: '2026-06-03' } : b))
/** Ridgeway picks up (6 against 2); the rest pull 3 to 8 permits in the last ninety days; the permit runner pulls 20. */
const PERMITS: MarketPermit[] = [
  ...issued('ridgewaybuilders', '2026-10-20', 6),
  ...issued('ridgewaybuilders', '2026-07-01', 2),
  ...NAMES.slice(1).flatMap((n, i) => issued(key(n), '2026-10-01', 8 - i)),
  ...issued('quillpermits', '2026-10-01', 20),
]
const ROWS = [row(), row({ id: 'p2', address: '77 KILN ST', submitted_on: '2026-10-28', filed_on: '2026-10-28' })]

const answer = (over: Partial<CallAnswerRow> = {}): CallAnswerRow => ({ id: 'a1', builder_key: 'larkspurbuilders', answer: 'not_for_us', reason: 'Too far for us', look_again_on: '2027-11-19', city: 'San Antonio', prospect_id: null, permit_id: null, answered_by: 'u2', answered_at: '2026-11-18T15:00:00Z', ...over })

const onAnswered = vi.fn()
const onLookupChecked = vi.fn()
const onRetry = vi.fn()
const onChanged = vi.fn()
const onOpenBuilder = vi.fn()
const onOpenPermit = vi.fn()

function draw(over: { answers?: CallAnswerRow[]; isMobile?: boolean; city?: string; builders?: BuilderRow[]; permits?: MarketPermit[]; rows?: ResearchPermitRow[]; recordsStart?: string | null; loading?: boolean; error?: string | null; answersError?: string | null; lookups?: LookupRow[]; checks?: LookupCheckRow[]; lookupsError?: string | null } = {}) {
  const builders = over.builders ?? BUILDERS
  const rows = over.rows ?? ROWS
  const recordsStart = over.recordsStart === undefined ? '2025-01-01' : over.recordsStart
  const standings: Map<string, CallStanding> = foldCallAnswers(over.answers ?? [], TODAY)
  const list = callRows({ builders, permits: over.permits ?? PERMITS, rows, standings, lookups: foldLookups(over.lookups ?? [], over.checks ?? []), recordsStartYmd: recordsStart, todayYmd: TODAY })
  const known = recordsStart === '2025-01-01'
  return renderWithProviders(
    <PermitCallList
      city={over.city ?? 'San Antonio'}
      authUserId="u1"
      todayYmd={TODAY}
      isMobile={over.isMobile ?? false}
      list={list}
      chips={callChips({ trendKnown: known, hasApplications: known, valuesReliable: false })}
      builders={builders}
      standings={standings}
      rows={rows}
      loading={over.loading ?? false}
      error={over.error ?? null}
      answersError={over.answersError ?? null}
      lookupsError={over.lookupsError ?? null}
      onRetry={onRetry}
      reach={known ? 'in the last year' : 'since Aug 27'}
      trendKnown={known}
      hasApplications={known}
      recordsStart={known ? 'Jan 1, 2025' : 'Aug 27'}
      researchers={[
        { id: 'u1', name: 'Eve' },
        { id: 'u2', name: 'Sam' },
      ]}
      onAnswered={onAnswered}
      onLookupChecked={onLookupChecked}
      onChanged={onChanged}
      onOpenBuilder={onOpenBuilder}
      onOpenPermit={onOpenPermit}
    />,
  )
}
const called = () => [...document.querySelectorAll('[data-call-row]')].map((el) => el.getAttribute('data-call-row'))

beforeEach(() => {
  research.approachFromPermit.mockReset().mockResolvedValue({ prospectId: 'lead-1', companyName: 'Ridgeway Builders', reused: false, deck: 'customer' })
  research.loadPermitsOfBuilder.mockReset().mockResolvedValue([])
  research.recordVerdict.mockReset().mockResolvedValue(undefined)
  marketIo.recordCallAnswer.mockReset().mockResolvedValue(undefined)
  marketIo.recordLookupCheck.mockReset().mockResolvedValue(undefined)
  onLookupChecked.mockReset()
  onAnswered.mockReset()
  onRetry.mockReset()
  onChanged.mockReset()
  onOpenBuilder.mockReset()
  onOpenPermit.mockReset()
})
afterEach(() => cleanup())

describe('the call list', () => {
  it('shows five names this week, each with its reasons, and says how many wait behind them', () => {
    draw()
    expect(screen.getByRole('button', { name: 'This week 5' }).getAttribute('aria-pressed')).toBe('true')
    // The builder with a job open now leads, then the names never bid by their ninety days. The one we bid waits behind them, and the permit runner, the busiest of all, behind every builder.
    expect(called()).toEqual(['ridgewaybuilders', 'tallpinebuilders', 'harborfitoutsconstruction', 'limebuildcontractors', 'asterridgecontracting'])
    const first = document.querySelector('[data-call-row="ridgewaybuilders"]') as HTMLElement
    for (const tag of ['Picking up', 'Never bid', '2 jobs open now']) expect(within(first).getByText(tag)).toBeTruthy()
    expect(within(first).getByText('8 jobs in the last year, 6 in the last 90 days against 2 in the 90 before. Mostly commercial remodel.')).toBeTruthy()
    expect(first.textContent).toContain('Open now: 2100 SAMPLE PKWY, applied Nov 4 · 77 KILN ST, applied Oct 28. They have no plumbing permit yet.')
    expect(screen.getByText(/^3 more wait behind these\./)).toBeTruthy()
    expect(screen.getByText('A name with a building word comes first, then the other companies. After that a job open now, then picking up or new, then never bid. A job is counted once.')).toBeTruthy()
    // Our history with a name we bid, on the chip that holds it.
    fireEvent.click(screen.getByRole('button', { name: 'New and busy 7' }))
    const juniper = document.querySelector('[data-call-row="juniperhospitalitygroup"]') as HTMLElement
    expect(within(juniper).getByText('We bid 4, won 0')).toBeTruthy()
    expect(within(juniper).getByText('We priced 4 of their jobs and won none. The last was Jun 3.')).toBeTruthy()
  })

  it('stands Ask for empty until a name is looked up, with the Google press beside it', () => {
    draw()
    const first = document.querySelector('[data-call-row="ridgewaybuilders"]') as HTMLElement
    expect(within(first).getByText('Nobody looked this name up yet.')).toBeTruthy()
    expect(within(first).getByRole('link', { name: 'Search Google for Ridgeway Builders' }).getAttribute('href')).toBe('https://www.google.com/search?q=%22Ridgeway%20Builders%22%20San%20Antonio%20TX')
  })

  it('filters by a chip, each with its count', () => {
    draw()
    expect(screen.getByRole('button', { name: 'Has a job open now 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New and busy 7' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Never bid 7' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Picking up 1' }))
    expect(called()).toEqual(['ridgewaybuilders'])
    fireEvent.click(screen.getByRole('button', { name: 'Never bid 7' }))
    // Every name that was never bid, the ones past the week's five too, the permit runner last.
    expect(called()).toHaveLength(7)
    expect(called()[6]).toBe('quillpermits')
    expect(within(document.querySelector('[data-call-row="quillpermits"]') as HTMLElement).getByText('May file for others')).toBeTruthy()
  })

  it('opens the building from a job open now, and the builder from Open builder', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: '77 KILN ST' }))
    expect(onOpenPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open builder Tall Pine Builders LLC' }))
    expect(onOpenBuilder).toHaveBeenCalledWith(expect.objectContaining({ key: 'tallpinebuilders' }))
  })

  it('leaves out the chips and the words a city’s records cannot back', () => {
    draw({ city: 'Austin', recordsStart: '2026-08-27', rows: [] })
    expect(screen.queryByRole('button', { name: /^Picking up/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Has a job open now/ })).toBeNull()
    expect(screen.getByText(/Austin’s records start Aug 27, so nothing here reads as picking up or new yet\./)).toBeTruthy()
    expect(screen.getAllByText('8 jobs since Aug 27. Mostly commercial remodel.').length).toBeGreaterThan(0)
  })

  it('says why a city has no list, and waits while the year reads', () => {
    draw({ city: 'Seguin', builders: [], permits: [], rows: [] })
    expect(screen.getByText('Seguin publishes no applicant on its permits, so no builder can be named here.')).toBeTruthy()
    cleanup()
    draw({ loading: true })
    expect(screen.getByText('Reading the year of permits…')).toBeTruthy()
    expect(called()).toEqual([])
    // No count is drawn before the list is read: a zero would read as a fact.
    expect(screen.queryByRole('button', { name: /^This week/ })).toBeNull()
  })

  it('says why and waits when a read the list is built from fails, with no name, count or empty state', () => {
    // The year of permits did not load, so the list holds no row. Nothing here may read as "all answered".
    draw({ permits: [], error: 'Couldn’t load the year of permits: the network is down' })
    expect(within(screen.getByRole('alert')).getByText(/the network is down/)).toBeTruthy()
    expect(screen.getByText('The list needs this read, so it shows no name until the read comes back.')).toBeTruthy()
    expect(called()).toEqual([])
    expect(screen.queryByText(/Nothing waiting on a call/)).toBeNull()
    expect(screen.queryByText(/is answered/)).toBeNull()
    expect(screen.queryByText(/Names that read as a builder come first/)).toBeNull()
    expect(screen.queryByRole('button', { name: /^This week/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('still draws the list when the answers cannot be read, and says an answered name may be on it', () => {
    draw({ answersError: 'Couldn’t load the answers on the call list: the network is down' })
    expect(called()).toHaveLength(5)
    expect(screen.getByText('A name already answered may be on this list until the answers load.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('answering a name', () => {
  it('pursues from the newest open job: the lead, the verdict on the permit, and the answer', async () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Pursue Ridgeway Builders' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Pursue Ridgeway Builders' })).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Their next jobs' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Pursue · hand to me' }))
    await waitFor(() => expect(marketIo.recordCallAnswer).toHaveBeenCalledTimes(1))
    expect(research.approachFromPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'gc', 'u1', {})
    expect(research.recordVerdict).toHaveBeenCalledWith({ permitId: 'p1', verdict: 'approach', reason: 'Pursued for their next jobs.', lookAgainOn: null, prospectId: 'lead-1', userId: 'u1', pursueFor: 'next_jobs', forUserId: 'u1' })
    expect(marketIo.recordCallAnswer).toHaveBeenCalledWith({ builderKey: 'ridgewaybuilders', answer: 'pursue', reason: 'Pursued for their next jobs.', lookAgainOn: '2027-02-17', city: 'San Antonio', prospectId: 'lead-1', permitId: 'p1' })
    expect(await screen.findByText(/Lead made: Ridgeway Builders, on the Customers deck\. Ridgeway Builders is off the list while you pursue them\. It may be offered again after Feb 17, 2027, once it applies for a new job\./)).toBeTruthy()
    expect(onAnswered).toHaveBeenCalledTimes(1)
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('reads a builder’s newest permit when the tab holds none of theirs, and writes no verdict on a history row', async () => {
    research.loadPermitsOfBuilder.mockResolvedValue([{ id: 's9', permit_number: 'COM-BLG-PMT26-00000009', permit_type: 'Comm New Building Permit', kind: 'building', stage: 'issued', work_type: 'New commercial', submitted_on: '2026-01-02', issued_on: '2026-10-01', contact: 'Tall Pine Builders LLC', address: '60 MILLRACE ROW', declared_value: 1_800_000 }])
    research.approachFromPermit.mockResolvedValue({ prospectId: 'lead-2', companyName: 'Tall Pine Builders LLC', reused: true, deck: 'gc_lead' })
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Pursue Tall Pine Builders LLC' }))
    const sheet = await screen.findByRole('dialog')
    expect(research.loadPermitsOfBuilder).toHaveBeenCalledWith('San Antonio', 'tallpinebuilders', TODAY)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Pursue · hand to me' }))
    await waitFor(() => expect(marketIo.recordCallAnswer).toHaveBeenCalledWith(expect.objectContaining({ builderKey: 'tallpinebuilders', answer: 'pursue', prospectId: 'lead-2', permitId: 's9' })))
    expect(research.approachFromPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 's9', address: '60 MILLRACE ROW' }), 'gc', 'u1', {})
    expect(research.recordVerdict).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('says why when the lead cannot be made, and writes no answer', async () => {
    research.approachFromPermit.mockRejectedValue(new Error('Could not make the lead: the network is down'))
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Pursue Ridgeway Builders' }))
    const sheet = await screen.findByRole('dialog')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Pursue · hand to me' }))
    expect(await within(sheet).findByText('Could not make the lead: the network is down')).toBeTruthy()
    expect(marketIo.recordCallAnswer).not.toHaveBeenCalled()
    expect(onAnswered).not.toHaveBeenCalled()
  })

  it('passes on a name with a reason in one press', async () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Not for us: Harbor Fitouts Construction' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Harbor Fitouts Construction is not for us' })).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Too big for us' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Not for us · too big for us' }))
    await waitFor(() => expect(marketIo.recordCallAnswer).toHaveBeenCalledWith({ builderKey: 'harborfitoutsconstruction', answer: 'not_for_us', reason: 'Too big for us', lookAgainOn: '2027-11-19', city: 'San Antonio' }))
    expect(await screen.findByText('Harbor Fitouts Construction is off the list. It may be offered again after Nov 19, 2027, once it applies for a new job.')).toBeTruthy()
    expect(onAnswered).toHaveBeenCalledTimes(1)
    expect(research.approachFromPermit).not.toHaveBeenCalled()
  })

  it('passes with no reason, and Cancel writes nothing', async () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Not for us: Harbor Fitouts Construction' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(marketIo.recordCallAnswer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Not for us: Harbor Fitouts Construction' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Not for us' }))
    await waitFor(() => expect(marketIo.recordCallAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 'not_for_us', reason: '' })))
  })

  it('brings the next name when one is answered, and puts an answered name back', async () => {
    draw({ answers: [answer({ id: 'a0', builder_key: 'ridgewaybuilders', answer: 'pursue', reason: 'Pursued for this job.', look_again_on: '2027-02-17', answered_by: 'u1' }), answer()] })
    // Ridgeway and Larkspur are off, so the names behind them move up and the one we bid takes the fifth place.
    expect(called()).toEqual(['tallpinebuilders', 'harborfitoutsconstruction', 'limebuildcontractors', 'asterridgecontracting', 'juniperhospitalitygroup'])
    fireEvent.click(screen.getByRole('button', { name: /^Answered 2/ }))
    const larkspur = document.querySelector('[data-call-answered="larkspurbuilders"]') as HTMLElement
    expect(within(larkspur).getByText('Not for us, Too far for us. Sam, Nov 18. Off the list until Nov 19, 2027, and then until it applies for a new job.')).toBeTruthy()
    expect(within(document.querySelector('[data-call-answered="ridgewaybuilders"]') as HTMLElement).getByText('Pursuing, Pursued for this job.. You, Nov 18. Off the list until Feb 17, 2027, and then until it applies for a new job.')).toBeTruthy()
    fireEvent.click(within(larkspur).getByRole('button', { name: 'Put Larkspur Builders back on the list' }))
    await waitFor(() => expect(marketIo.recordCallAnswer).toHaveBeenCalledWith({ builderKey: 'larkspurbuilders', answer: 'back', reason: '', lookAgainOn: null, city: 'San Antonio' }))
    expect(await screen.findByText('Larkspur Builders may be offered on the list again.')).toBeTruthy()
    expect(onAnswered).toHaveBeenCalledTimes(1)
  })

  it('keeps a name whose day has come under Answered until it has a new job, with Put back', () => {
    // Passed on Aug 1 and due again Nov 1. Larkspur has applied for nothing since, so it is not offered again.
    draw({ answers: [answer({ look_again_on: '2026-11-01', answered_at: '2026-08-01T15:00:00Z' })] })
    expect(called()).not.toContain('larkspurbuilders')
    fireEvent.click(screen.getByRole('button', { name: /^Answered 1/ }))
    const larkspur = document.querySelector('[data-call-answered="larkspurbuilders"]') as HTMLElement
    expect(within(larkspur).getByText('Not for us, Too far for us. Sam, Aug 1. Off the list until it applies for a new job.')).toBeTruthy()
    expect(within(larkspur).getByRole('button', { name: 'Put Larkspur Builders back on the list' })).toBeTruthy()
  })

  it('draws the three presses in a row under the name on a phone', () => {
    draw({ isMobile: true })
    const first = document.querySelector('[data-call-row="ridgewaybuilders"]') as HTMLElement
    expect(first.style.gridTemplateColumns).toBe('26px minmax(0, 1fr)')
    expect(within(first).getByRole('button', { name: 'Pursue Ridgeway Builders' })).toBeTruthy()
  })
})

describe('Ask for, once a name is looked up', () => {
  const fact = (over: Partial<LookupRow>): LookupRow => ({ id: 'f-phone', builder_key: 'ridgewaybuilders', fact: 'phone', value: '(210) 555-0142', detail: '', source_url: 'https://ridgewaybuilders.example/contact', looked_up_on: '2026-11-18', looked_up_by: 'dev', looked_up_how: 'agent', city: 'San Antonio', created_at: '2026-11-18T18:00:00Z', ...over })
  const FACTS = [
    fact({ id: 'f-kind', fact: 'kind', value: 'builder', source_url: 'https://ridgewaybuilders.example/about' }),
    fact({}),
    fact({ id: 'f-person', fact: 'person', value: 'Dana Whitlock', detail: 'Director of Preconstruction', source_url: 'https://ridgewaybuilders.example/team' }),
  ]
  const first = () => document.querySelector('[data-call-row="ridgewaybuilders"]') as HTMLElement

  it('draws each fact grey with its page and day, tags the name as an outline, and leaves the other names as they were', () => {
    draw({ lookups: FACTS })
    const row = first()
    expect(within(row).getByText('Looked up, not checked')).toBeTruthy()
    expect(within(row).getByText('Looked up: a builder').getAttribute('data-tag')).toBe('looked-up')
    expect([...row.querySelectorAll('[data-lookup-fact]')].map((el) => [el.getAttribute('data-lookup-fact'), el.getAttribute('data-lookup-state')])).toEqual([
      ['kind', 'unchecked'],
      ['phone', 'unchecked'],
      ['person', 'unchecked'],
    ])
    expect(row.querySelectorAll('[data-value="looked-up"]')).toHaveLength(3)
    expect(row.querySelector('[data-value="worked-out"]')).toBeNull()
    expect(within(row).getByRole('link', { name: '(210) 555-0142' }).getAttribute('href')).toBe('tel:+12105550142')
    expect(within(row).getByRole('link', { name: 'ridgewaybuilders.example/team' }).getAttribute('href')).toBe('https://ridgewaybuilders.example/team')
    expect(within(row).getByText(/Director of Preconstruction/)).toBeTruthy()
    expect(within(row).getByText(/Nobody was called or written to\./)).toBeTruthy()
    expect(within(row).queryByText('Nobody looked this name up yet.')).toBeNull()
    const second = document.querySelector('[data-call-row="tallpinebuilders"]') as HTMLElement
    expect(within(second).getByText('Nobody looked this name up yet.')).toBeTruthy()
  })

  it('keeps a press of Checked on one fact, with a toast, and reads the lookups again', async () => {
    draw({ lookups: FACTS })
    fireEvent.click(within(first()).getByRole('button', { name: 'Checked: the office phone of Ridgeway Builders' }))
    await waitFor(() => expect(marketIo.recordLookupCheck).toHaveBeenCalledWith({ lookupId: 'f-phone', verdict: 'checked' }))
    await waitFor(() => expect(onLookupChecked).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Checked the office phone of Ridgeway Builders.')).toBeTruthy()
    expect(marketIo.recordCallAnswer).not.toHaveBeenCalled()
  })

  it('says why a press was not kept, and reads nothing again', async () => {
    marketIo.recordLookupCheck.mockRejectedValue(new Error('Could not keep the check: the network is down'))
    draw({ lookups: FACTS })
    fireEvent.click(within(first()).getByRole('button', { name: 'Wrong: the person to ask for of Ridgeway Builders' }))
    expect(await screen.findByText('Could not keep the check: the network is down')).toBeTruthy()
    expect(onLookupChecked).not.toHaveBeenCalled()
  })

  it('draws a checked fact plain bold with who and when, and a fact marked wrong as a line with Put back', async () => {
    const checks: LookupCheckRow[] = [
      { id: 'c1', lookup_id: 'f-phone', verdict: 'checked', said_by: 'u1', said_at: '2026-11-19T15:00:00Z' },
      { id: 'c2', lookup_id: 'f-person', verdict: 'wrong', said_by: 'u2', said_at: '2026-11-19T16:00:00Z' },
    ]
    draw({ lookups: FACTS, checks })
    const row = first()
    expect(within(row).getByText('1 of 2 checked')).toBeTruthy()
    const phone = row.querySelector('[data-lookup-fact="phone"]') as HTMLElement
    expect(phone.getAttribute('data-lookup-state')).toBe('checked')
    expect(phone.querySelector('[data-value="worked-out"]')?.textContent).toBe('(210) 555-0142')
    expect(phone.textContent).toContain('Checked by you, Nov 19')
    const person = row.querySelector('[data-lookup-fact="person"]') as HTMLElement
    expect(person.getAttribute('data-lookup-state')).toBe('wrong')
    expect(person.textContent).toContain('Marked wrong by Sam, Nov 19.')
    // The wrong value is off the row.
    expect(within(row).queryByText(/Dana Whitlock/)).toBeNull()
    fireEvent.click(within(person).getByRole('button', { name: 'Put back: the person to ask for of Ridgeway Builders' }))
    await waitFor(() => expect(marketIo.recordLookupCheck).toHaveBeenCalledWith({ lookupId: 'f-person', verdict: 'back' }))
    fireEvent.click(within(phone).getByRole('button', { name: 'Not right: the office phone of Ridgeway Builders' }))
    await waitFor(() => expect(marketIo.recordLookupCheck).toHaveBeenLastCalledWith({ lookupId: 'f-phone', verdict: 'wrong' }))
    // A gap brings the Google press back.
    expect(within(row).getByRole('link', { name: 'Search Google for Ridgeway Builders' })).toBeTruthy()
  })

  it('says a kind could not be told and what was not found, and guesses nothing', () => {
    draw({ lookups: [fact({ id: 'f-kind', fact: 'kind', value: 'unknown', source_url: '' }), fact({})] })
    const row = first()
    expect(row.querySelector('[data-lookup-fact="kind"]')?.textContent).toBe('Could not tell from a public page. Looked Nov 18.')
    expect(row.querySelector('[data-tag="looked-up"]')).toBeNull()
    expect(within(row).getByText('No person to ask for was found on a public business page.')).toBeTruthy()
    expect(within(row).getByText('opens a search for what is missing.')).toBeTruthy()
  })

  it('still draws the list when the lookups cannot be read, and no row claims nobody looked', () => {
    draw({ lookupsError: 'Could not read what was looked up about the builders: the network is down' })
    expect(called()).toHaveLength(5)
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('Could not read what was looked up about the builders: the network is down')).toBeTruthy()
    expect(within(alert).getByText('The list still draws. No name shows who to ask for until this read comes back.')).toBeTruthy()
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(within(first()).getByText('What was looked up could not be read.')).toBeTruthy()
    expect(screen.queryByText('Nobody looked this name up yet.')).toBeNull()
  })
})
