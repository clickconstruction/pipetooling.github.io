// @vitest-environment jsdom
/**
 * Money → Bill day → From the trades (Messages cut 9, wave 2): the screen over the prototype's demo draws on Thu Oct 22,
 * after Wendi's walk. The top reads the river, the ring at 3 of 7 and Today's three; the rows sit by where each trade
 * stands; Lone Star's lines read $27,180 at what Wendi saw; the asks are each their own text; Nothing this period is a
 * dev's; the Draws presses show only when the Draws window opens for the reader. The reads are mocked; the kernels are real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/gc/billDay/billDayIo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/gc/billDay/billDayIo')>()
  return {
    ...real,
    loadLineChecks: vi.fn(),
    loadBillDayNothing: vi.fn(),
    loadWhereOnSite: vi.fn(),
    loadBillDayCutoff: vi.fn(),
    loadJobSuperintendent: vi.fn(),
    sayNothingThisPeriod: vi.fn(),
    putBackNothing: vi.fn(),
  }
})
vi.mock('../../lib/gc/tradePortalLinksIo', () => ({ loadTradePortalLinks: vi.fn() }))

import { loadBillDayCutoff, loadBillDayNothing, loadJobSuperintendent, loadLineChecks, loadWhereOnSite, sayNothingThisPeriod, type LineCheckRow } from '../../lib/gc/billDay/billDayIo'
import { NO_DRAWS, type DrawTables } from '../../lib/gc/drawRows'
import { loadTradePortalLinks } from '../../lib/gc/tradePortalLinksIo'
import { billDayJob, billDayState, WENDI_WALK, WHERE_ON_SITE } from '../../test/fixtures/billDayDemo'
import { installDomShims } from '../../test/renderSmokeMocks'
import { GcCompanyOpenerContext } from './gcCompanyOpener'
import { GcBillDayTrades, type BillDayTradesProps } from './GcBillDayTrades'

installDomShims()

const state = billDayState('2026-10-22')
const stoneoak = billDayJob(state, 'stoneoak')
const helotes = billDayJob(state, 'helotes')
const drawTables: DrawTables = {
  ...NO_DRAWS,
  sowLines: state.projects.flatMap((p) => p.packages.flatMap((k) => (k.sow?.sov ?? []).map((l, i) => ({ id: l.id, sow_id: k.sow?.id ?? '', position: i, scope_item_id: null })))),
}
const walkRows: LineCheckRow[] = WENDI_WALK.map((c, i) => ({
  id: `c${i}`,
  draw_id: c.drawId,
  sow_line_id: c.sovId,
  we_see_pct: c.weSee,
  stored_on_site: c.onSite,
  photo_url: c.photo ? 'https://drive.example.test/photo' : null,
  note: c.note,
  checked_by: c.by,
  checked_at: c.at,
  seq: i + 1,
}))

beforeEach(() => {
  vi.mocked(loadLineChecks).mockResolvedValue(walkRows)
  vi.mocked(loadBillDayNothing).mockResolvedValue([])
  vi.mocked(loadWhereOnSite).mockResolvedValue(Object.entries(WHERE_ON_SITE).map(([id, where]) => ({ id, scope_item_id: null, where_on_site: where })))
  vi.mocked(loadBillDayCutoff).mockResolvedValue(6)
  vi.mocked(loadJobSuperintendent).mockResolvedValue({ name: 'Wendi', phone: '(210) 555-0190' })
  vi.mocked(loadTradePortalLinks).mockResolvedValue({ links: [{ company_id: 'bd-hillside', token: 'tok-hill', created_at: '2026-09-01T00:00:00Z', revoked_at: null }], visits: {} })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function show(over: Partial<BillDayTradesProps> = {}) {
  const openPartner = vi.fn()
  const props: BillDayTradesProps = {
    state,
    jobs: [stoneoak, helotes],
    projectId: 'stoneoak',
    onPickJob: vi.fn(),
    drawTables,
    canWrite: true,
    onOpenDraws: vi.fn(),
    onOpenBill: vi.fn(),
    onToOwner: vi.fn(),
    ...over,
  }
  render(
    <GcCompanyOpenerContext.Provider value={{ openPartner }}>
      <GcBillDayTrades {...props} />
    </GcCompanyOpenerContext.Provider>,
  )
  return { props, openPartner }
}

const row = (packageId: string) => document.querySelector(`[data-bill-day-row="${packageId}"]`) as HTMLElement

describe('GcBillDayTrades (Money → Bill day → From the trades)', () => {
  it('reads the top: the river into the owner’s number, the dates with today, the ring at 3 of 7 and Today’s three', async () => {
    show()
    await waitFor(() => expect(document.querySelector('[data-bill-day-top]')).not.toBeNull())
    expect(document.body.textContent).toContain("The trades' draws · 6 · $170,055 as it stands")
    expect([...document.querySelectorAll('[data-bill-day-river] button')].map((b) => b.textContent)).toEqual(['$86,985', '$34,560', '$35,010', '$13,500'])
    expect([...document.querySelectorAll('[data-mark]')].map((m) => m.getAttribute('data-mark'))).toEqual(['tradesBy', 'today', 'walk', 'billDay', 'ownerPays'])
    expect(document.querySelector('[data-bill-day-ring]')?.textContent).toContain('3 of 7')
    expect(document.querySelector('[data-bill-day-ring]')?.textContent).toContain('Can it go? Not yet.')
    const today = document.querySelector('[data-bill-day-today]') as HTMLElement
    expect(today.textContent).toContain('Ask the 3 not in · due Mon Oct 19')
    expect(today.textContent).toContain("Rio Paving's draw, sent back Thu Oct 1")
    expect(today.textContent).toContain('Conditional waivers · 3 of 6 in')
  })

  it('folds the dates and the gates until asked', async () => {
    show()
    await waitFor(() => expect(document.querySelector('[data-bill-day-top]')).not.toBeNull())
    expect(document.querySelector('[data-bill-day-dates]')).toBeNull()
    expect(document.querySelector('[data-bill-day-gates]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'The dates in full ›' }))
    expect(document.querySelector('[data-bill-day-dates]')?.textContent).toContain('Mon Oct 19')
    fireEvent.click(screen.getByRole('button', { name: 'the gates ›' }))
    expect(document.querySelectorAll('[data-gate]')).toHaveLength(7)
    expect(document.querySelector('[data-gate="lastCertificate"]')?.getAttribute('data-gate-ok')).toBe('yes')
  })

  it('sits each trade in its group, with See their page opening its portal', async () => {
    const { openPartner } = show()
    await waitFor(() => expect(document.querySelectorAll('[data-bill-day-row]')).toHaveLength(6))
    expect([...document.querySelectorAll('[data-bill-day-row]')].map((r) => r.getAttribute('data-row-state'))).toEqual(['back', 'notin', 'notin', 'notin', 'waiting', 'approved'])
    expect(within(row('so-lv')).getByText('we pay by Oct 10')).toBeTruthy()
    fireEvent.click(within(row('so-paving')).getByRole('button', { name: 'See their page' }))
    expect(openPartner).toHaveBeenCalledWith('bd-rio', { tab: 'portal' })
    expect(document.querySelector('[data-bill-day-group="ours"]')?.textContent).toContain('$27,900 this period on J1082, 62% done')
  })

  it('opens Lone Star’s lines at what Wendi saw: $27,180, the prototype’s number', async () => {
    show()
    await waitFor(() => expect(row('so-mech')).not.toBeNull())
    fireEvent.click(within(row('so-mech')).getByRole('button', { name: 'Open the lines' }))
    const lines = document.querySelector('[data-bill-day-lines="ls-2"]') as HTMLElement
    expect(lines.textContent).toContain('$27,180')
    expect(lines.textContent).toContain('they asked $35,010')
    expect(lines.textContent).toContain('at 75%, not $29,000 at 90%')
    expect(lines.textContent).toContain('CO 1')
    expect(lines.textContent).toContain('Wendi saw the lines on site Thu Oct 22.')
    expect(lines.querySelector('a[href="https://drive.example.test/photo"]')).not.toBeNull()
  })

  it('asks each trade not in with its own text, the link last, and holds one with no portal link', async () => {
    show()
    await waitFor(() => expect(document.querySelector('[data-bill-day-today]')).not.toBeNull())
    fireEvent.click(within(document.querySelector('[data-bill-day-today]') as HTMLElement).getByRole('button', { name: 'Ask the 3 not in' }))
    const panel = document.querySelector('[data-bill-day-ask]') as HTMLElement
    expect(panel.querySelectorAll('[data-bill-day-text]')).toHaveLength(3)
    const hill = panel.querySelector('[data-bill-day-text="so-site"]') as HTMLElement
    expect(hill.textContent).toContain('Greg, pay application 4 on Stone Oak Pharmacy closes Mon Oct 19.')
    expect(hill.textContent).toContain('/t/tok-hill#draws')
    // On a desk it copies; a draft text is for a phone.
    expect(within(hill).queryByText('Draft text')).toBeNull()
    expect(within(hill).getByRole('button', { name: 'Copy' })).toBeTruthy()
    const kerr = panel.querySelector('[data-bill-day-text="so-elec"]') as HTMLElement
    expect(kerr.textContent).toContain('They have no portal link yet.')
    expect(within(kerr).queryByRole('button', { name: 'Copy' })).toBeNull()
  })

  it('asks Wendi to walk it with no dollar in the text', async () => {
    show()
    await waitFor(() => expect(document.querySelector('[data-bill-day-top]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'the gates ›' }))
    fireEvent.click(within(document.querySelector('[data-gate="checked"]') as HTMLElement).getByRole('button', { name: 'Ask Wendi to walk it' }))
    const text = document.querySelector('[data-bill-day-text="walk"]') as HTMLElement
    expect(text.textContent).toContain('Wendi, 1 draw to check on Stone Oak Pharmacy by Fri Oct 23.')
    expect(text.textContent).not.toContain('$')
  })

  it('lets a dev record Nothing this period, and nobody else', async () => {
    vi.mocked(sayNothingThisPeriod).mockResolvedValue('n1')
    show()
    await waitFor(() => expect(row('so-elec')).not.toBeNull())
    fireEvent.click(within(row('so-elec')).getByRole('button', { name: 'Nothing this period' }))
    expect((within(row('so-elec')).getByLabelText('Said by') as HTMLInputElement).value).toBe('Dana Kerr, by phone')
    fireEvent.click(within(row('so-elec')).getByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(sayNothingThisPeriod).toHaveBeenCalledWith('sow-kerr', '2026-10-25', 'Dana Kerr, by phone'))
    cleanup()
    show({ canWrite: false })
    await waitFor(() => expect(row('so-elec')).not.toBeNull())
    expect(within(row('so-elec')).queryByRole('button', { name: 'Nothing this period' })).toBeNull()
  })

  it('opens the Draws window for Approve and Send back only when it opens for the reader', async () => {
    const { props } = show()
    await waitFor(() => expect(row('so-mech')).not.toBeNull())
    fireEvent.click(within(row('so-mech')).getByRole('button', { name: 'Approve or send back in Draws' }))
    expect(props.onOpenDraws).toHaveBeenCalledWith('stoneoak')
    cleanup()
    show({ onOpenDraws: undefined })
    await waitFor(() => expect(row('so-mech')).not.toBeNull())
    expect(within(row('so-mech')).queryByRole('button', { name: 'Approve or send back in Draws' })).toBeNull()
  })

  it('says when no job is being built with a signed trade', () => {
    show({ jobs: [], projectId: null })
    expect(document.body.textContent).toContain('No job is being built with a signed trade yet.')
  })
})
