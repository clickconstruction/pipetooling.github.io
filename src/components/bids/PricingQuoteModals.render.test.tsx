// @vitest-environment jsdom
/**
 * The windows behind the Pricing header's quote doors (region P6 of the Pricing map). The
 * eight windows are stubbed to a button per door, so what is pinned is the wrapper's own
 * wiring: which windows need a bid, what each is handed, and how they open each other.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PricingQuoteModals } from './PricingQuoteModals'
import type { PricingQuoteDesk } from '../../hooks/usePricingQuoteDesk'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'

vi.mock('../../lib/bidPackageLabel', () => ({ bidPackageLabel: (bid: { id: string }) => `LABEL ${bid.id}` }))

type AnyProps = Record<string, unknown>
const seen: Record<string, AnyProps> = {}
/** The props a stubbed window was last rendered with. */
function got(name: string): AnyProps {
  const props = seen[name]
  if (!props) throw new Error(`${name} did not render`)
  return props
}
function stub(name: string, doors: string[]) {
  return (props: AnyProps) => {
    seen[name] = props
    return (
      <div data-testid={name}>
        {`${name}:${props.open ? 'open' : 'closed'}`}
        {doors.map((d) => (
          <button key={d} type="button" onClick={() => (props[d] as (arg?: unknown) => void)?.({ lines: [], text: 'scope' })}>
            {`${name}.${d}`}
          </button>
        ))}
      </div>
    )
  }
}
vi.mock('./SpecSectionAuditModal', () => ({ SpecSectionAuditModal: stub('audit', ['onClose']) }))
vi.mock('./PrepareFixtureCopyModal', () => ({ PrepareFixtureCopyModal: stub('copy', ['onClose', 'onRfqMinted', 'onSendByEmail']) }))
vi.mock('./RfqDeskModal', () => ({ RfqDeskModal: stub('desk', ['onClose', 'onCompare', 'onNewRequest', 'onChanged']) }))
vi.mock('./RfqComposeModal', () => ({ RfqComposeModal: stub('compose', ['onClose', 'onSent']) }))
vi.mock('./PlugInQuotesModal', () => ({ PlugInQuotesModal: stub('plugIn', ['onClose', 'onSaved']) }))
vi.mock('./PlugInScheduleModal', () => ({ PlugInScheduleModal: stub('schedule', ['onClose', 'onSaved']) }))
vi.mock('./PriceWithRobotModal', () => ({ PriceWithRobotModal: stub('robot', ['onClose', 'onChanged', 'onOpenCompare']) }))
vi.mock('./QuoteCompareModal', () => ({ QuoteCompareModal: stub('compare', ['onClose', 'onPlugIn', 'onPlugInSchedule', 'onCostsApplied']) }))

function makeDesk(over: Partial<PricingQuoteDesk> = {}): PricingQuoteDesk {
  return {
    rfqChip: { kind: 'none' },
    openRobotChip: vi.fn(async () => {}),
    activePriceMatrixRequest: null,
    priceMatrixSupported: true,
    reloadPriceMatrixRequests: vi.fn(),
    d22AuditOpen: false,
    setD22AuditOpen: vi.fn(),
    prepareCopyOpen: false,
    setPrepareCopyOpen: vi.fn(),
    plugInQuoteOpen: false,
    setPlugInQuoteOpen: vi.fn(),
    plugInScheduleOpen: false,
    setPlugInScheduleOpen: vi.fn(),
    priceWithRobotOpen: false,
    setPriceWithRobotOpen: vi.fn(),
    quotesCompareOpen: false,
    setQuotesCompareOpen: vi.fn(),
    rfqDeskOpen: false,
    setRfqDeskOpen: vi.fn(),
    composeScope: null,
    setComposeScope: vi.fn(),
    openRfqHouseIds: new Set<string>(),
    bumpQuoteNonce: vi.fn(),
    ...over,
  }
}

const bid = { id: 'b1', plans_link: 'https://plans.example/b1' } as unknown as BidWithBuilder
const countRows = [
  { id: 'c1', fixture: 'WC-1', count: 4, unit: 'ea' },
  { id: 'c2', fixture: 'LAV-1', count: 2, unit: null },
] as unknown as BidCountRow[]

function mount(desk: PricingQuoteDesk, over: Partial<Parameters<typeof PricingQuoteModals>[0]> = {}) {
  const onCostsApplied = vi.fn()
  render(
    <PricingQuoteModals
      desk={desk}
      selectedBidForPricing={bid}
      ledgerPrefixMap={{} as never}
      pricingCountRows={countRows}
      selectedPricingVersionId="pv1"
      canPackageAndSendBidPricing
      takeoffMaterialsByCountRowId={{ c1: 120 }}
      taxPercent={8.25}
      currentTotals={{ totalRevenue: 1000, totalCost: 600 }}
      onCostsApplied={onCostsApplied}
      {...over}
    />,
  )
  return { onCostsApplied }
}

afterEach(() => {
  cleanup()
  for (const k of Object.keys(seen)) delete seen[k]
})

describe('PricingQuoteModals', () => {
  it('with no bid only the Division 22 audit renders', () => {
    mount(makeDesk({ d22AuditOpen: true }), { selectedBidForPricing: null })
    expect(screen.getByTestId('audit').textContent).toContain('audit:open')
    for (const name of ['copy', 'desk', 'compose', 'plugIn', 'schedule', 'robot', 'compare']) expect(screen.queryByTestId(name)).toBeNull()
  })

  it('with a bid, seven windows render closed and compose waits for a scope', () => {
    mount(makeDesk())
    for (const name of ['audit', 'copy', 'desk', 'plugIn', 'schedule', 'robot', 'compare']) expect(screen.getByTestId(name).textContent).toContain(`${name}:closed`)
    expect(screen.queryByTestId('compose')).toBeNull()
  })

  it('hands each window the bid, its label and the count rows — with units only where they are read', () => {
    mount(makeDesk({ composeScope: { lines: [], text: 'x' }, openRfqHouseIds: new Set(['h1']) }))
    expect(got('copy').bidLabel).toBe('LABEL b1')
    expect(got('copy').rows).toEqual([
      { id: 'c1', fixture: 'WC-1', count: 4, unit: 'ea' },
      { id: 'c2', fixture: 'LAV-1', count: 2, unit: null },
    ])
    expect(got('copy').quoteLink).toEqual({ bidId: 'b1', bidVersionId: 'pv1' })
    expect(got('desk').rows).toEqual([
      { id: 'c1', fixture: 'WC-1', count: 4 },
      { id: 'c2', fixture: 'LAV-1', count: 2 },
    ])
    expect(got('compose').plansLink).toBe('https://plans.example/b1')
    expect([...(got('compose').openRfqHouseIds as Set<string>)]).toEqual(['h1'])
    expect(got('compose').bidVersionId).toBe('pv1')
    expect(got('compare').taxPercent).toBe(8.25)
    expect(got('compare').currentTotals).toEqual({ totalRevenue: 1000, totalCost: 600 })
    expect(got('compare').takeoffMaterialsByCountRowId).toEqual({ c1: 120 })
    expect(got('robot').supported).toBe(true)
  })

  it('without the permission the fixture copy has no quote link and no email door', () => {
    mount(makeDesk(), { canPackageAndSendBidPricing: false })
    expect(got('copy').quoteLink).toBeUndefined()
    expect(got('copy').onSendByEmail).toBeUndefined()
  })

  it('the fixture copy: a minted request bumps; Send by email closes the copy and hands compose the scope', () => {
    const desk = makeDesk()
    mount(desk)
    fireEvent.click(screen.getByText('copy.onRfqMinted'))
    expect(desk.bumpQuoteNonce).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('copy.onSendByEmail'))
    expect(desk.setPrepareCopyOpen).toHaveBeenCalledWith(false)
    expect(desk.setComposeScope).toHaveBeenCalledWith({ lines: [], text: 'scope' })
  })

  it('the desk: Compare and New request each close the desk and open the other window', () => {
    const desk = makeDesk({ rfqDeskOpen: true })
    mount(desk)
    fireEvent.click(screen.getByText('desk.onCompare'))
    expect(desk.setRfqDeskOpen).toHaveBeenLastCalledWith(false)
    expect(desk.setQuotesCompareOpen).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByText('desk.onNewRequest'))
    expect(desk.setPrepareCopyOpen).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByText('desk.onChanged'))
    expect(desk.bumpQuoteNonce).toHaveBeenCalledTimes(1)
  })

  it('compose: sent bumps and opens the desk; close clears the scope', () => {
    const desk = makeDesk({ composeScope: { lines: [], text: 'x' } })
    mount(desk)
    fireEvent.click(screen.getByText('compose.onSent'))
    expect(desk.bumpQuoteNonce).toHaveBeenCalledTimes(1)
    expect(desk.setRfqDeskOpen).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByText('compose.onClose'))
    expect(desk.setComposeScope).toHaveBeenCalledWith(null)
  })

  it('plug in: a saved quote bumps and opens the compare; a saved schedule only bumps', () => {
    const desk = makeDesk()
    mount(desk)
    fireEvent.click(screen.getByText('plugIn.onSaved'))
    expect(desk.bumpQuoteNonce).toHaveBeenCalledTimes(1)
    expect(desk.setQuotesCompareOpen).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByText('schedule.onSaved'))
    expect(desk.bumpQuoteNonce).toHaveBeenCalledTimes(2)
    expect(desk.setQuotesCompareOpen).toHaveBeenCalledTimes(1)
  })

  it('the robot window: a change reloads the requests and bumps; Open compare goes through the robot chip', () => {
    const chip = { kind: 'robot' as const, tone: 'green' as const, label: 'Matrix ready', requestId: 'm1', status: 'ready' as const }
    const desk = makeDesk({ rfqChip: chip, activePriceMatrixRequest: { id: 'm1' } as never })
    mount(desk)
    fireEvent.click(screen.getByText('robot.onChanged'))
    expect(desk.reloadPriceMatrixRequests).toHaveBeenCalledTimes(1)
    expect(desk.bumpQuoteNonce).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('robot.onOpenCompare'))
    expect(desk.setPriceWithRobotOpen).toHaveBeenCalledWith(false)
    expect(desk.openRobotChip).toHaveBeenCalledWith(chip)
  })

  it('the robot window: Open compare with no active request only closes the window', () => {
    const desk = makeDesk()
    mount(desk)
    fireEvent.click(screen.getByText('robot.onOpenCompare'))
    expect(desk.setPriceWithRobotOpen).toHaveBeenCalledWith(false)
    expect(desk.openRobotChip).not.toHaveBeenCalled()
  })

  it('the compare: Plug in and Plug in schedule each close it and open theirs; applied costs reach the tab', () => {
    const desk = makeDesk({ quotesCompareOpen: true })
    const { onCostsApplied } = mount(desk)
    fireEvent.click(screen.getByText('compare.onPlugIn'))
    expect(desk.setQuotesCompareOpen).toHaveBeenLastCalledWith(false)
    expect(desk.setPlugInQuoteOpen).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByText('compare.onPlugInSchedule'))
    expect(desk.setPlugInScheduleOpen).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByText('compare.onCostsApplied'))
    expect(onCostsApplied).toHaveBeenCalledTimes(1)
  })
})
